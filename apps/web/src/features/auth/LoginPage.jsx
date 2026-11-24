import React, {useEffect, useRef, useState} from 'react';
import {ShieldCheck, Smartphone, ArrowLeft, ArrowRight, Lock, CheckCircle2, Pencil, Languages, Eye, EyeOff, MapPin, BadgeCheck, Zap, UserRound, HardHat} from 'lucide-react';
import {authApi} from '../../shared/api.js';
import './login.css';

const COPY = {
  en: {
    title: 'Welcome to Dialoo', sub: 'Log in or sign up with your mobile number. No password needed.',
    mobile: 'Mobile number', mobilePh: '10-digit mobile number', send: 'Send OTP', sending: 'Sending…',
    otpTitle: 'Verify your number', otpSub: 'Enter the 6-digit code sent to', verify: 'Verify & continue', verifying: 'Verifying…',
    change: 'Change number', resendIn: 'Resend OTP in', resend: 'Resend OTP', expires: 'Code is valid for 5 minutes.',
    nameTitle: 'One last step', nameSub: 'What should we call you?', name: 'Your name', namePh: 'Full name', cont: 'Continue', skip: 'Skip for now',
    usePwd: 'Log in with password instead', useOtp: 'Use OTP instead', pwd: 'Password', pwdPh: 'Enter your password', login: 'Log in', loggingIn: 'Logging in…',
    guest: 'Continue as guest', or: 'or', terms: 'By continuing you agree to Dialoo’s Terms of Use and Privacy Policy.',
    badMobile: 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.', badOtp: 'Enter all 6 digits of the OTP.', devHint: 'Development mode — your OTP is', fill: 'Autofill',
    p1: 'Verified local professionals near you', p2: 'Book in a few taps, in Hindi or English', p3: 'Your number stays private and secure',
    brandTag: 'Local help, when you need it.', needHelp: 'Need help?', secure: 'Secured with one-time password',
  },
  hi: {
    title: 'Dialoo में आपका स्वागत है', sub: 'अपने मोबाइल नंबर से लॉग इन या साइन अप करें। पासवर्ड की ज़रूरत नहीं।',
    mobile: 'मोबाइल नंबर', mobilePh: '10 अंकों का मोबाइल नंबर', send: 'OTP भेजें', sending: 'भेजा जा रहा है…',
    otpTitle: 'अपना नंबर वेरिफ़ाई करें', otpSub: 'इस नंबर पर भेजा गया 6 अंकों का कोड डालें', verify: 'वेरिफ़ाई करें', verifying: 'जाँच हो रही है…',
    change: 'नंबर बदलें', resendIn: 'दोबारा OTP भेजें', resend: 'OTP दोबारा भेजें', expires: 'कोड 5 मिनट तक मान्य है।',
    nameTitle: 'बस एक आख़िरी स्टेप', nameSub: 'हम आपको किस नाम से बुलाएँ?', name: 'आपका नाम', namePh: 'पूरा नाम', cont: 'आगे बढ़ें', skip: 'अभी छोड़ें',
    usePwd: 'पासवर्ड से लॉग इन करें', useOtp: 'OTP से लॉग इन करें', pwd: 'पासवर्ड', pwdPh: 'अपना पासवर्ड डालें', login: 'लॉग इन', loggingIn: 'लॉग इन हो रहा है…',
    guest: 'गेस्ट की तरह देखें', or: 'या', terms: 'आगे बढ़कर आप Dialoo की उपयोग की शर्तें और गोपनीयता नीति से सहमत होते हैं।',
    badMobile: '6, 7, 8 या 9 से शुरू होने वाला सही 10 अंकों का नंबर डालें।', badOtp: 'OTP के सभी 6 अंक डालें।', devHint: 'डेवलपमेंट मोड — आपका OTP है', fill: 'भरें',
    p1: 'आपके पास के वेरिफ़ाइड लोकल प्रोफेशनल', p2: 'हिंदी या English में, बस कुछ टैप में बुकिंग', p3: 'आपका नंबर सुरक्षित और निजी रहता है',
    brandTag: 'ज़रूरत के समय, लोकल मदद।', needHelp: 'मदद चाहिए?', secure: 'वन-टाइम पासवर्ड से सुरक्षित',
  },
};

export default function LoginPage({lang, setLang, onSuccess: onSuccessRaw, onGuest}) {
  const t = COPY[lang] || COPY.en;
  const [intent, setIntent] = useState(() => localStorage.getItem('dialoo-intent') === 'provider' ? 'provider' : 'customer');
  const pick = (v) => { setIntent(v); localStorage.setItem('dialoo-intent', v); };
  const onSuccess = (u) => onSuccessRaw(u, intent);
  const hi = lang === 'hi';
  const [step, setStep] = useState('mobile'); // mobile | otp | name
  const [mode, setMode] = useState('otp');    // otp | password
  const [mobile, setMobile] = useState('');
  const [resetMode, setResetMode] = useState(false); const [resetOtp, setResetOtp] = useState(''); const [newPassword, setNewPassword] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState(''); const [showPwd, setShowPwd] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [shake, setShake] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [devOtp, setDevOtp] = useState('');
  const [pending, setPending] = useState(null); // verify response held while asking for name
  const boxes = useRef([]);

  useEffect(() => { if (resendIn <= 0) return; const id = setTimeout(() => setResendIn(s => s - 1), 1000); return () => clearTimeout(id); }, [resendIn]);
  useEffect(() => { if (step === 'otp') setTimeout(() => boxes.current[0]?.focus(), 60); }, [step]);

  const validMobile = /^[6-9][0-9]{9}$/.test(mobile);
  const otpValue = digits.join('');
  function fail(msg) { setError(msg); setShake(true); setTimeout(() => setShake(false), 450); }

  async function sendOtp(e) {
    e?.preventDefault(); setError('');
    if (!validMobile) return fail(t.badMobile);
    setBusy(true);
    try {
      const r = await authApi.requestOtp(mobile);
      setDevOtp(r.devOtp || ''); setDigits(['', '', '', '', '', '']); setResendIn(r.resendInSeconds || 30); setStep('otp');
    } catch (err) {
      if (err.status === 429 && err.retryAfter && err.retryAfter <= 120) { setResendIn(err.retryAfter); setStep('otp'); setDigits(['', '', '', '', '', '']); }
      if (err.status !== 429) setDevOtp('');
      fail(err.message);
    } finally { setBusy(false); }
  }

  async function verify(code = otpValue) {
    setError('');
    if (code.length !== 6) return fail(t.badOtp);
    setBusy(true);
    try {
      const r = await authApi.verifyOtp(mobile, code);
      if (r.isNewUser) { setPending(r); setStep('name'); } else onSuccess(r.user);
    } catch (err) { setDigits(['', '', '', '', '', '']); setTimeout(() => boxes.current[0]?.focus(), 30); fail(err.message); }
    finally { setBusy(false); }
  }

  function setDigit(i, v) {
    const d = v.replace(/[^0-9]/g, '').slice(-1); setError('');
    const next = [...digits]; next[i] = d; setDigits(next);
    if (d && i < 5) boxes.current[i + 1]?.focus();
    if (d && i === 5 && next.every(Boolean)) verify(next.join(''));
  }
  function onKey(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) { boxes.current[i - 1]?.focus(); }
    if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) boxes.current[i + 1]?.focus();
    if (e.key === 'Enter') verify();
  }
  function onPaste(e) {
    const p = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 6); if (!p) return; e.preventDefault();
    const next = ['', '', '', '', '', ''].map((_, i) => p[i] || ''); setDigits(next);
    boxes.current[Math.min(p.length, 5)]?.focus(); if (p.length === 6) verify(p);
  }

  async function passwordLogin(e) {
    e.preventDefault(); setError('');
    if (!(validMobile || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mobile.trim()))) return fail('Enter a valid mobile number or email address.');
    if (!password) return fail(t.pwdPh);
    setBusy(true);
    try { const r = await authApi.login({phone: mobile, password}); onSuccess(r.user); }
    catch (err) { fail(err.message); } finally { setBusy(false); }
  }

  async function saveName(e) {
    e?.preventDefault(); setBusy(true);
    try { if (name.trim().length >= 2) { await authApi.updateMe({fullName: name.trim()}); onSuccess({...pending.user, full_name: name.trim()}); } else onSuccess(pending.user); }
    catch (err) { fail(err.message); } finally { setBusy(false); }
  }

  const spinner = <span className="lg-spin" aria-hidden="true"/>;

  return (
    <div className="lg-page">
      <aside className="lg-brand">
        <img className="lg-logo" src="/dialoo-logo.jpeg" alt="Dialoo"/>
        <div className="lg-brand-copy">
          <h2>{t.brandTag}</h2>
          <ul>
            <li><BadgeCheck size={20}/>{t.p1}</li>
            <li><Zap size={20}/>{t.p2}</li>
            <li><ShieldCheck size={20}/>{t.p3}</li>
          </ul>
        </div>
        <div className="lg-brand-foot">A product by <b>NarayaniX</b> · © 2026 Dialoo</div>
      </aside>

      <main className="lg-side">
        <div className="lg-top">
          <img className="lg-logo-mobile" src="/dialoo-logo.jpeg" alt="Dialoo"/>
          <button type="button" className="lg-lang" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label="Change language"><Languages size={16}/>{lang === 'en' ? 'हिन्दी' : 'English'}</button>
        </div>

        <div className={'lg-card' + (shake ? ' lg-shake' : '')}>
          {step === 'mobile' && !resetMode && (
            <form onSubmit={mode === 'otp' ? sendOtp : passwordLogin} noValidate>
              <div className="lg-icon"><Smartphone size={26}/></div>
              <h1>{t.title}</h1>
              <p className="lg-sub">{t.sub}</p>
              <div className="lg-role" role="radiogroup" aria-label={hi ? 'लॉगिन का प्रकार' : 'Login as'}>
                <button type="button" role="radio" aria-checked={intent === 'customer'} className={intent === 'customer' ? 'on' : ''} onClick={() => pick('customer')}><span><UserRound size={22} aria-hidden="true"/></span><b>{hi ? 'कंज़्यूमर' : 'Consumer'}</b><em>{hi ? 'सर्विस खोजें और बुक करें' : 'Find & book services'}</em></button>
                <button type="button" role="radio" aria-checked={intent === 'provider'} className={intent === 'provider' ? 'on' : ''} onClick={() => pick('provider')}><span><HardHat size={22} aria-hidden="true"/></span><b>{hi ? 'Dialoo पार्टनर' : 'Dialoo Partner'}</b><em>{hi ? 'Dialoo के साथ कमाएँ' : 'Earn with Dialoo'}</em></button>
              </div>

              <label className="lg-label" htmlFor="lg-mobile">{mode === 'otp' ? t.mobile : 'Mobile number or email address'}</label>
              <div className={'lg-phone' + (error && !validMobile ? ' lg-invalid' : '')}>
                {mode === 'otp' && <span className="lg-cc">+91</span>}
                <input id="lg-mobile" type={mode === 'otp' ? 'tel' : 'text'} inputMode={mode === 'otp' ? 'numeric' : 'email'} autoComplete={mode === 'otp' ? 'tel-national' : 'username'} maxLength={190} autoFocus
                  value={mobile} onChange={e => { setMobile(mode === 'otp' ? e.target.value.replace(/[^0-9]/g, '').slice(0, 10) : e.target.value.slice(0, 190)); setError(''); }} placeholder={mode === 'otp' ? t.mobilePh : 'Mobile number or email address'}/>
                {validMobile && <CheckCircle2 className="lg-ok" size={18}/>}
              </div>

              {mode === 'password' && <>
                <label className="lg-label" htmlFor="lg-pwd">{t.pwd}</label>
                <div className="lg-pwd">
                  <Lock size={17}/>
                  <input id="lg-pwd" type={showPwd ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} placeholder={t.pwdPh}/>
                  <button type="button" onClick={() => setShowPwd(!showPwd)} aria-label="Show or hide password">{showPwd ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
                </div>
              </>}

              <div className="lg-error" role="alert" aria-live="polite">{error}</div>
              <button className="lg-primary" type="submit" disabled={busy}>
                {busy ? <>{spinner}{mode === 'otp' ? t.sending : t.loggingIn}</> : <>{mode === 'otp' ? t.send : t.login}<ArrowRight size={17}/></>}
              </button>
              <button type="button" className="lg-link" onClick={() => { setMode(mode === 'otp' ? 'password' : 'otp'); setError(''); }}>{mode === 'otp' ? t.usePwd : t.useOtp}</button>
              {mode === 'password' && <button type="button" className="lg-link" onClick={() => { setResetMode(true); setError(''); setResetOtp(''); setNewPassword(''); }}>Forgot password?</button>}

              <div className="lg-divider"><span>{t.or}</span></div>
              <button type="button" className="lg-ghost" onClick={onGuest}><MapPin size={16}/>{t.guest}</button>
            </form>
          )}

          {resetMode && step === 'mobile' && (
            <form onSubmit={async e => { e.preventDefault(); setError(''); if(!validMobile) return fail(t.badMobile); setBusy(true); try { const r=await authApi.requestPasswordReset(mobile); setDevOtp(r.devOtp||''); setResendIn(r.resendInSeconds||30); setResetMode(false); setStep('reset'); } catch(err){ fail(err.message||'Could not request password reset'); } finally{setBusy(false);} }}>
              <button type="button" className="lg-back" onClick={()=>{setResetMode(false);setError('');}}><ArrowLeft size={16}/> Back to login</button>
              <div className="lg-icon"><Lock size={26}/></div><h1>Forgot password</h1><p className="lg-sub">We’ll send a reset code to your registered mobile number.</p>
              <label className="lg-label">Registered mobile number</label><div className="lg-phone"><span className="lg-cc">+91</span><input type="tel" inputMode="numeric" maxLength={10} value={mobile} onChange={e=>setMobile(e.target.value.replace(/[^0-9]/g,'').slice(0,10))} placeholder="10-digit mobile number"/></div>
              <div className="lg-error" role="alert">{error}</div><button className="lg-primary" disabled={busy}>{busy?'Sending…':'Send reset OTP'}<ArrowRight size={17}/></button>
            </form>
          )}
          {step === 'reset' && (
            <form onSubmit={async e=>{e.preventDefault();setError('');if(!/^[0-9]{6}$/.test(resetOtp))return fail('Enter the 6-digit OTP.');if(newPassword.length<8)return fail('Password must be at least 8 characters.');setBusy(true);try{await authApi.resetPassword(mobile,resetOtp,newPassword);setStep('mobile');setMode('password');setResetMode(false);setPassword('');setResetOtp('');setNewPassword('');setError('Password reset. Please log in with your new password.');}catch(err){fail(err.message||'Password reset failed');}finally{setBusy(false);}}}>
              <button type="button" className="lg-back" onClick={()=>{setStep('mobile');setResetMode(true);setError('');}}><ArrowLeft size={16}/> Back</button>
              <div className="lg-icon lg-icon-green"><ShieldCheck size={26}/></div><h1>Reset password</h1><p className="lg-sub">Enter the code sent to +91 {mobile} and choose a new password.</p>
              {devOtp && <div className="lg-dev">Development OTP: <b>{devOtp}</b></div>}
              <label className="lg-label">6-digit OTP</label><input className="lg-reset-input" inputMode="numeric" maxLength={6} value={resetOtp} onChange={e=>setResetOtp(e.target.value.replace(/[^0-9]/g,'').slice(0,6))} placeholder="123456"/>
              <label className="lg-label">New password</label><input className="lg-reset-input" type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={8} placeholder="At least 8 characters"/>
              <div className="lg-error" role="alert">{error}</div><button className="lg-primary" disabled={busy}>{busy?'Resetting…':'Reset password'}<ArrowRight size={17}/></button>
            </form>
          )}
          {step === 'otp' && (
            <div>
              <button type="button" className="lg-back" onClick={() => { setStep('mobile'); setError(''); }}><ArrowLeft size={16}/>{t.change}</button>
              <div className="lg-icon lg-icon-green"><ShieldCheck size={26}/></div>
              <h1>{t.otpTitle}</h1>
              <p className="lg-sub">{t.otpSub} <b className="lg-num">+91 {mobile.slice(0, 5)} {mobile.slice(5)}</b>
                <button type="button" className="lg-edit" onClick={() => setStep('mobile')} aria-label={t.change}><Pencil size={13}/></button></p>

              <div className="lg-otp" onPaste={onPaste} role="group" aria-label="One-time password">
                {digits.map((d, i) => (
                  <input key={i} ref={el => boxes.current[i] = el} className={d ? 'filled' : ''} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1}
                    autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1}`} value={d} disabled={busy}
                    onChange={e => setDigit(i, e.target.value)} onKeyDown={e => onKey(i, e)} onFocus={e => e.target.select()}/>
                ))}
              </div>

              {devOtp && <div className="lg-dev">{t.devHint} <b>{devOtp}</b><button type="button" onClick={() => { setDigits(devOtp.split('')); verify(devOtp); }}>{t.fill}</button></div>}

              <div className="lg-error" role="alert" aria-live="polite">{error}</div>
              <button className="lg-primary" type="button" onClick={() => verify()} disabled={busy || otpValue.length !== 6}>
                {busy ? <>{spinner}{t.verifying}</> : <>{t.verify}<ArrowRight size={17}/></>}
              </button>

              <div className="lg-resend">
                {resendIn > 0 ? <span>{t.resendIn} <b>0:{String(resendIn).padStart(2, '0')}</b></span>
                  : <button type="button" className="lg-link" onClick={sendOtp} disabled={busy}>{t.resend}</button>}
              </div>
              <p className="lg-note">{t.expires}</p>
            </div>
          )}

          {step === 'name' && (
            <form onSubmit={saveName}>
              <div className="lg-icon lg-icon-green"><CheckCircle2 size={26}/></div>
              <h1>{t.nameTitle}</h1>
              <p className="lg-sub">{t.nameSub}</p>
              <label className="lg-label" htmlFor="lg-name">{t.name}</label>
              <div className="lg-pwd"><input id="lg-name" autoFocus autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder={t.namePh} maxLength={120}/></div>
              <div className="lg-error" role="alert" aria-live="polite">{error}</div>
              <button className="lg-primary" type="submit" disabled={busy}>{busy ? <>{spinner}</> : <>{t.cont}<ArrowRight size={17}/></>}</button>
              <button type="button" className="lg-link" onClick={() => onSuccess(pending.user)}>{t.skip}</button>
            </form>
          )}
        </div>

        <p className="lg-terms">{t.terms}</p>
        <p className="lg-secure"><Lock size={12}/> {t.secure}</p>
      </main>
    </div>
  );
}
