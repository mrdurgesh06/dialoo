import React, { useEffect, useRef, useState } from 'react';
import { adminApi, adminSession, getOtpConfig } from '../../shared/api.js';
import { Bell, NotificationList } from '../../shared/parts.jsx';
import { LangContext, Sheet, ToastHost, Spinner } from '../../shared/ui.jsx';
import { BookingsPage, Overview, ProvidersPage, UsersPage } from './OperationsPages.jsx';
import { CatalogPage, EmergenciesPage, NotifyPage, OffersPage, SecurityPage, SettingsPage } from './ManagementPages.jsx';
import LocationsPage from './LocationsPage.jsx';
import './admin.css';
import { Check, Circle, ClipboardList, Eye, EyeOff, FolderTree, HardHat, LayoutDashboard, MapPin, Megaphone, Menu, Settings, ShieldCheck, Siren, TicketPercent, Users } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';

const IDLE_LOGOUT_MS = 20 * 60 * 1000; // sign out after 20 minutes without any activity
const EXTEND_EVERY_MS = 5 * 60 * 1000;

export default function AdminApp() {
  return <LangContext.Provider value={{ lang: 'en', t: (en) => en }}><ToastHost><Gate /></ToastHost></LangContext.Provider>;
}

function Gate() {
  const [user, setUser] = useState(null); const [state, setState] = useState(adminSession.get() ? 'loading' : 'login'); const [notice, setNotice] = useState('');
  useEffect(() => { if (state === 'loading') adminApi.me().then((u) => { setUser(u); setState('app'); }).catch(() => { adminSession.set(null); setState('login'); }); }, []); // eslint-disable-line
  useEffect(() => { const on = () => { setUser(null); setState('login'); setNotice('Your session ended. Please sign in again.'); }; window.addEventListener('dialoo-admin-expired', on); return () => window.removeEventListener('dialoo-admin-expired', on); }, []);
  const logout = async (msg) => { try { await adminApi.logout(); } catch { /* ignore */ } adminSession.set(null); setUser(null); setNotice(msg || ''); setState('login'); };
  if (state === 'loading') return <div className="adm-center"><Spinner /></div>;
  if (state === 'login') return <AdminLogin notice={notice} onDone={(u) => { setUser(u); setNotice(''); setState('app'); }} />;
  return <AdminShell user={user} onLogout={logout} />;
}

const RULES = [
  ['At least 12 characters', (p) => p.length >= 12], ['A small letter (a-z)', (p) => /[a-z]/.test(p)], ['A CAPITAL letter (A-Z)', (p) => /[A-Z]/.test(p)],
  ['A number (0-9)', (p) => /[0-9]/.test(p)], ['A symbol (@ # $ ! …)', (p) => /[^A-Za-z0-9]/.test(p)],
];
const strong = (p) => RULES.every(([, f]) => f(p));
function PwRules({ pw }) { return <ul className="adm-rules">{RULES.map(([t, f]) => <li key={t} className={f(pw) ? 'ok' : ''}>{f(pw) ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />} {t}</li>)}</ul>; }

function AdminLogin({ onDone, notice }) {
  // steps: pwd -> otp -> (change) ; forgot -> reset
  const [step, setStep] = useState('pwd'); const [id, setId] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [mfa, setMfa] = useState(null); const [otp, setOtp] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false); const [wait, setWait] = useState(0);
  const [fid, setFid] = useState(''); const [reset, setReset] = useState(null); const [np, setNp] = useState(''); const [np2, setNp2] = useState(''); const [changeToken, setChangeToken] = useState('');
  useEffect(() => { if (wait <= 0) return undefined; const i = setInterval(() => setWait((w) => w - 1), 1000); return () => clearInterval(i); }, [wait]);
  const fail = (e) => { setErr(e.message); if (e.status === 429 && e.retryAfter) setWait(Math.min(e.retryAfter, 900)); };
  const go = (s) => { setStep(s); setErr(''); setOk(''); setOtp(''); setNp(''); setNp2(''); };
  const finish = (r) => { adminSession.set(r.token); onDone(r.user); };
  const run = (fn) => async (e) => { e.preventDefault(); setErr(''); setBusy(true); try { await fn(); } catch (x) { fail(x); } finally { setBusy(false); } };

  const submitPwd = run(async () => {
    const r = await adminApi.login(id.trim(), pw);
    if (r.mfaRequired && r.otpMode === 'msg91-widget') {
      const { msg91Send } = await import('../../shared/msg91.js');
      await msg91Send(await getOtpConfig(), r.mobile); // OTP is sent by the MSG91 widget
      setMfa(r); go('otp');
    } else if (r.mfaRequired) { setMfa(r); go('otp'); } else finish(r);
  });
  const submitOtp = run(async () => {
    try {
      let r;
      if (mfa.otpMode === 'msg91-widget') {
        const { msg91Verify } = await import('../../shared/msg91.js');
        r = await adminApi.verifyWidget(mfa.mfaToken, await msg91Verify(await getOtpConfig(), otp));
      } else r = await adminApi.verify(mfa.mfaToken, otp);
      if (r.mustChangePassword) { setChangeToken(r.changeToken); go('change'); } else finish(r);
    } catch (x) { if (/expired|start again/i.test(x.message)) { go('pwd'); setPw(''); } throw x; }
  });
  const submitForgot = run(async () => { const r = await adminApi.forgot(fid.trim()); setReset(r); go('reset'); });
  const submitReset = run(async () => {
    if (np !== np2) throw new Error('The two passwords do not match.');
    try { await adminApi.resetPassword(reset.resetToken, otp, np); setPw(''); go('pwd'); setOk('Password changed. Please sign in with your new password.'); }
    catch (x) { if (/expired|start again/i.test(x.message)) go('forgot'); throw x; }
  });
  const submitChange = run(async () => {
    if (np !== np2) throw new Error('The two passwords do not match.');
    try { finish(await adminApi.changeInitial(changeToken, np)); } catch (x) { if (/expired|sign in again/i.test(x.message)) { go('pwd'); setPw(''); } throw x; }
  });
  const onSubmit = { pwd: submitPwd, otp: submitOtp, forgot: submitForgot, reset: submitReset, change: submitChange }[step];
  const disabled = busy || wait > 0 || (step === 'otp' && otp.length !== 6) || (step === 'reset' && (otp.length !== 6 || !strong(np))) || (step === 'change' && !strong(np));
  const label = { pwd: 'Continue', otp: 'Sign in', forgot: 'Send verification code', reset: 'Set new password', change: 'Save password & sign in' }[step];
  const newPwFields = (<>
    <label>New password<span className="pw"><input type={show ? 'text' : 'password'} value={np} onChange={(e) => setNp(e.target.value)} autoComplete="new-password" required /><button type="button" onClick={() => setShow(!show)} aria-label="Show password">{show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></span></label>
    <PwRules pw={np} />
    <label>Confirm new password<input type={show ? 'text' : 'password'} value={np2} onChange={(e) => setNp2(e.target.value)} autoComplete="new-password" required /></label>
  </>);
  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={onSubmit} autoComplete="off">
        <img src="/dialoo-logo.jpeg" alt="Dialoo" /><span className="adm-tag">Secure admin console</span>
        {notice && step === 'pwd' && <p className="adm-warn">{notice}</p>}
        {ok && <p className="adm-okmsg">{ok}</p>}
        {step === 'pwd' && (<>
          <h1>Admin sign in</h1><p className="muted">Authorised staff only. All sign-ins are logged.</p>
          <label>Mobile number or email<input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required /></label>
          <label>Password<span className="pw"><input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setShow(!show)} aria-label="Show password">{show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></span></label>
          <button type="button" className="adm-link right" onClick={() => { setFid(id.includes('@') || /^\d{10}$/.test(id) ? id : ''); go('forgot'); }}>Forgot password?</button>
        </>)}
        {step === 'otp' && (<>
          <h1>Verify it’s you</h1><p className="muted">Enter the 6-digit code sent to {mfa.maskedPhone}.</p>
          {mfa.devOtp && <p className="adm-dev">Dev mode: your code is <b>{mfa.devOtp}</b> (SMS is not configured)</p>}
          <label>One-time code<input className="otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} autoFocus autoComplete="one-time-code" required /></label>
          <button type="button" className="adm-link" onClick={() => go('pwd')}><ArrowLeft size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Back</button>
        </>)}
        {step === 'forgot' && (<>
          <h1>Forgot password?</h1><p className="muted">Enter your registered <b>mobile number or email</b>. We will send a 6-digit code to the mobile number saved on your admin account.</p>
          <label>Mobile number or email<input value={fid} onChange={(e) => setFid(e.target.value)} autoFocus required /></label>
          <button type="button" className="adm-link" onClick={() => go('pwd')}><ArrowLeft size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Back to sign in</button>
        </>)}
        {step === 'reset' && (<>
          <h1>Set a new password</h1><p className="muted">If the account exists, a code was sent to {reset.maskedPhone}. Enter it below and choose a new password.</p>
          {reset.devOtp && <p className="adm-dev">Dev mode: your code is <b>{reset.devOtp}</b> (SMS is not configured)</p>}
          <label>6-digit code<input className="otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} autoFocus autoComplete="one-time-code" required /></label>
          {newPwFields}
          <button type="button" className="adm-link" onClick={() => go('forgot')}><ArrowLeft size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Start again</button>
        </>)}
        {step === 'change' && (<>
          <h1>Choose your own password</h1><p className="muted">You signed in with a temporary password. For security, set a new password now. Only you should know it.</p>
          {newPwFields}
        </>)}
        {err && <p className="adm-error" role="alert">{err}{wait > 0 ? ` (${Math.ceil(wait / 60)} min)` : ''}</p>}
        <button className="adm-btn" disabled={disabled}>{busy ? 'Please wait…' : label}</button>
        <small className="muted">Not an admin? <a href="/">Go to Dialoo</a></small>
      </form>
    </div>
  );
}

const NAV = [
  ['overview', LayoutDashboard, 'Overview', 'DASHBOARD_VIEW'], ['bookings', ClipboardList, 'Bookings', 'BOOKING_VIEW'], ['providers', HardHat, 'Providers', 'PROVIDER_VIEW'], ['users', Users, 'Users', 'USER_VIEW'],
  ['catalog', FolderTree, 'Catalog', 'CATALOG_MANAGE'], ['locations', MapPin, 'Locations', 'LOCATION_MANAGE'], ['offers', TicketPercent, 'Offers & banners', 'COUPON_MANAGE'], ['emergencies', Siren, 'Emergencies', 'BOOKING_VIEW'],
  ['notify', Megaphone, 'Broadcast', 'NOTIFY_BROADCAST'], ['security', ShieldCheck, 'Security & audit', 'AUDIT_VIEW'], ['settings', Settings, 'Settings', 'SETTINGS_MANAGE'],
];

function AdminShell({ user, onLogout }) {
  const [page, setPage] = useState(() => window.location.hash.replace('#', '') || 'overview'); const [bell, setBell] = useState(false); const [menu, setMenu] = useState(false);
  const last = useRef(Date.now()); const lastExtend = useRef(Date.now()); const [warn, setWarn] = useState(false);
  const perms = user.permissions || []; const can = (p) => perms.includes(p);
  const items = NAV.filter((n) => can(n[3]));
  useEffect(() => { window.location.hash = page; }, [page]);
  useEffect(() => {
    const touch = () => { last.current = Date.now(); setWarn(false); };
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(async () => {
      const idle = Date.now() - last.current;
      if (idle > IDLE_LOGOUT_MS) { onLogout('You were signed out after 20 minutes of inactivity.'); return; }
      setWarn(idle > IDLE_LOGOUT_MS - 2 * 60 * 1000);
      if (idle < EXTEND_EVERY_MS && Date.now() - lastExtend.current > EXTEND_EVERY_MS) {
        try { const r = await adminApi.extend(); adminSession.set(r.token); lastExtend.current = Date.now(); } catch { /* 401 handler will log out */ }
      }
    }, 20000);
    return () => { ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((e) => window.removeEventListener(e, touch)); clearInterval(timer); };
  }, []); // eslint-disable-line
  const open = (n) => { setBell(false); if (n.entity_type === 'BOOKING') setPage('bookings'); else if (n.entity_type === 'PROVIDER') setPage('providers'); else if (n.entity_type === 'EMERGENCY') setPage('emergencies'); };
  const Page = { overview: Overview, bookings: BookingsPage, providers: ProvidersPage, users: UsersPage, catalog: CatalogPage, locations: LocationsPage, offers: OffersPage, emergencies: EmergenciesPage, notify: NotifyPage, security: SecurityPage, settings: SettingsPage }[page] || Overview;
  return (
    <div className="adm">
      <aside className={`adm-side ${menu ? 'open' : ''}`}>
        <div className="adm-brand"><img src="/dialoo-logo.jpeg" alt="Dialoo" /><span>Admin</span></div>
        <nav>{items.map(([k, Icon, label]) => <button key={k} className={page === k ? 'on' : ''} aria-current={page === k ? 'page' : undefined} onClick={() => { setPage(k); setMenu(false); }}><span><Icon size={18} aria-hidden="true" /></span>{label}</button>)}</nav>
        <div className="adm-me"><b>{user.full_name}</b><small>{user.role.replace('_', ' ')}</small><button onClick={() => onLogout()}>Sign out</button></div>
      </aside>
      <div className="adm-main">
        <header className="adm-top"><button className="adm-burger" onClick={() => setMenu(!menu)} aria-label="Menu"><Menu size={20} aria-hidden="true" /></button><h2>{items.find((i) => i[0] === page)?.[2] || 'Overview'}</h2><span className="grow" /><Bell api={adminApi} signedIn onOpen={() => setBell(true)} /></header>
        {warn && <div className="adm-warn bar">You will be signed out soon due to inactivity. Move your mouse to stay signed in.</div>}
        <div className="adm-body"><Page can={can} user={user} go={setPage} /></div>
      </div>
      <Sheet open={bell} onClose={() => setBell(false)} title="Notifications"><NotificationList api={adminApi} onNavigate={open} /></Sheet>
    </div>
  );
}
