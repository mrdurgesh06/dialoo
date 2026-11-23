import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from '../../shared/api.js';
import { Empty, Sheet, Spinner, StatusBadge, dateTime, money, timeAgo, useToast, usePolling } from '../../shared/ui.jsx';
import { ArrowRight, ChartColumn, ChevronLeft, ChevronRight, CircleCheck, Sparkles, Star, TicketPercent } from 'lucide-react';
import { CategoryIcon } from '../../shared/icons.jsx';

export function Pager({ page, setPage, total, size = 25 }) {
  const pages = Math.max(1, Math.ceil((total || 0) / size));
  return <div className="adm-pager"><span>{total || 0} records</span><div><button disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={15} aria-hidden="true" /> Prev</button><b>{page + 1} / {pages}</b><button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next <ChevronRight size={15} aria-hidden="true" /></button></div></div>;
}
export const Card = ({ title, action, children, className = '' }) => <section className={`adm-card ${className}`}>{(title || action) && <div className="adm-card-h"><h3>{title}</h3>{action}</div>}{children}</section>;

/* ------------------------------------------------ Overview ------------------------------------------------ */
export function Overview({ go, can }) {
  const [d, setD] = useState(null); const [live, setLive] = useState([]); const [err, setErr] = useState('');
  usePolling(async () => {
    try { setD(await adminApi.dashboard()); if (can('BOOKING_VIEW')) setLive((await adminApi.bookings({ size: 8 })).items); setErr(''); } catch (e) { setErr(e.message); }
  }, 15000);
  if (err && !d) return <p className="adm-error">{err}</p>;
  if (!d) return <Spinner />;
  const max = Math.max(1, ...d.daily.map((x) => Number(x.bookings)));
  const totalStatus = d.statusBreakdown.reduce((a, s) => a + Number(s.n), 0) || 1;
  const kpi = (label, value, sub, tone, to) => <button className={`kpi-card ${tone || ''}`} onClick={() => to && go(to)}><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</button>;
  return (
    <div className="adm-stack">
      <div className="kpi-grid">
        {kpi('New bookings (need action)', d.bookingsNew, 'waiting for provider', Number(d.bookingsNew) > 0 ? 'hot' : '', 'bookings')}
        {kpi('Active jobs', d.bookingsActive, 'accepted / on the way / working', '', 'bookings')}
        {kpi('Bookings today', d.bookingsToday, `${d.bookings} all-time`, '', 'bookings')}
        {kpi('GMV today', money(d.gmvToday), `${money(d.gmvTotal)} all-time`, 'green')}
        {kpi('Providers pending', d.providersPending, 'awaiting approval', Number(d.providersPending) > 0 ? 'hot' : '', 'providers')}
        {kpi('Providers online', `${d.providersOnline}/${d.providersApproved}`, 'approved providers', '', 'providers')}
        {kpi('Users', d.users, `+${d.newUsers7d} this week`, '', 'users')}
        {kpi('Open emergencies', d.emergenciesOpen, `${d.projectsOpen} open projects`, Number(d.emergenciesOpen) > 0 ? 'hot' : '', 'emergencies')}
      </div>
      <div className="adm-cols">
        <Card title="Bookings — last 14 days">
          <div className="bars">{d.daily.length === 0 ? <Empty icon={<ChartColumn size={26} aria-hidden="true" />} title="No data yet" /> : d.daily.map((x) => (
            <div key={x.day} className="bar-col" title={`${x.day}: ${x.bookings} bookings, ${x.completed} completed, ${money(x.gmv)}`}><i style={{ height: `${(Number(x.bookings) / max) * 100}%` }}><u style={{ height: `${Number(x.bookings) ? (Number(x.completed) / Number(x.bookings)) * 100 : 0}%` }} /></i><em>{String(x.day).slice(5)}</em><b>{x.bookings}</b></div>
          ))}</div><p className="muted small">Dark = completed, light = all bookings that day.</p>
        </Card>
        <Card title="Status breakdown">{d.statusBreakdown.map((s) => <div className="hbar" key={s.status}><span><StatusBadge status={s.status} /></span><div><i style={{ width: `${(Number(s.n) / totalStatus) * 100}%` }} /></div><b>{s.n}</b></div>)}{d.statusBreakdown.length === 0 && <p className="muted">No bookings yet.</p>}</Card>
      </div>
      {can('BOOKING_VIEW') && <Card title="Live bookings" action={<button className="adm-link" onClick={() => go('bookings')}>View all <ArrowRight size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /></button>}>
        <table className="adm-table"><thead><tr><th>Code</th><th>Customer</th><th>Provider</th><th>Amount</th><th>Status</th><th>Placed</th></tr></thead><tbody>
          {live.map((b) => <tr key={b.id}><td><b>{b.booking_code}</b></td><td>{b.customer_name}<small>{b.customer_phone}</small></td><td>{b.business_name}<small>{b.category}</small></td><td>{money(b.total_amount)}</td><td><StatusBadge status={b.status} /></td><td>{timeAgo(b.created_at)}</td></tr>)}
          {live.length === 0 && <tr><td colSpan="6" className="muted center">No bookings yet — they will appear here live.</td></tr>}
        </tbody></table></Card>}
      <div className="adm-cols">
        <Card title="Top providers (30 days)">{d.topProviders.map((p) => <div className="list-row" key={p.id}><b>{p.business_name}</b><span><Star size={13} fill="currentColor" aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {Number(p.average_rating).toFixed(1)}</span><span>{p.bookings} bookings</span></div>)}</Card>
        <Card title="Popular categories">{d.topCategories.map((c) => <div className="list-row" key={c.name}><b><CategoryIcon slug={c.slug} name={c.name} size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />{c.name}</b><span>{c.bookings} bookings</span></div>)}</Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------ Bookings ------------------------------------------------ */
const STATUSES = ['', 'REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'];
export function BookingsPage({ can }) {
  const toast = useToast();
  const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [page, setPage] = useState(0); const [data, setData] = useState(null); const [sel, setSel] = useState(null); const seen = useRef(0); const [fresh, setFresh] = useState(0);
  const load = () => adminApi.bookings({ status, q, page, size: 25 }).then((r) => {
    const top = r.items[0]?.id || 0; if (seen.current && top > seen.current && page === 0 && !status && !q) { const n = r.items.filter((x) => x.id > seen.current).length; setFresh(n); toast(`${n} new booking${n > 1 ? 's' : ''} received`, 'info'); }
    if (page === 0 && !status && !q) seen.current = Math.max(seen.current, top); setData(r);
  }).catch((e) => toast(e.message, 'err'));
  useEffect(() => { setData(null); load(); }, [status, page]); // eslint-disable-line
  usePolling(load, 10000, [status, page, q]);
  return (
    <div className="adm-stack">
      <div className="adm-toolbar">
        <div className="chips">{STATUSES.map((s) => <button key={s || 'all'} className={status === s ? 'on' : ''} onClick={() => { setStatus(s); setPage(0); }}>{s ? s.replace('_', ' ').toLowerCase() : 'all'}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setData(null); load(); }}><input placeholder="Search code, customer, phone, provider…" value={q} onChange={(e) => setQ(e.target.value)} /><button>Search</button></form>
      </div>
      {fresh > 0 && <div className="adm-info"><Sparkles size={15} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> {fresh} new since you opened this page <button className="adm-link" onClick={() => setFresh(0)}>dismiss</button></div>}
      {!data ? <Spinner /> : (
        <Card className="flush"><div className="table-wrap"><table className="adm-table hover"><thead><tr><th>Code</th><th>Customer</th><th>Provider</th><th>Category</th><th>Amount</th><th>Status</th><th>Placed</th></tr></thead><tbody>
          {data.items.map((b) => <tr key={b.id} onClick={() => setSel(b.id)}><td><b>{b.booking_code}</b>{b.urgency === 'URGENT' && <span className="urgent-tag">URGENT</span>}</td><td>{b.customer_name}<small>{b.customer_phone}</small></td><td>{b.business_name}<small>{b.provider_phone}</small></td><td>{b.category}</td><td>{money(b.total_amount)}{b.coupon_code && <small><TicketPercent size={12} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {b.coupon_code}</small>}</td><td><StatusBadge status={b.status} /></td><td>{dateTime(b.created_at)}<small>{timeAgo(b.created_at)}</small></td></tr>)}
          {data.items.length === 0 && <tr><td colSpan="7" className="center muted">No bookings match.</td></tr>}</tbody></table></div>
          <Pager page={page} setPage={setPage} total={data.total} /></Card>)}
      <BookingDetail id={sel} onClose={() => setSel(null)} can={can} onChanged={load} />
    </div>
  );
}

function BookingDetail({ id, onClose, can, onChanged }) {
  const toast = useToast(); const [b, setB] = useState(null); const [reason, setReason] = useState(''); const [ask, setAsk] = useState(false);
  useEffect(() => { setB(null); setAsk(false); setReason(''); if (id) adminApi.booking(id).then(setB).catch((e) => toast(e.message, 'err')); }, [id]); // eslint-disable-line
  const cancel = async () => { try { await adminApi.cancelBooking(id, reason); toast('Booking cancelled; all parties notified', 'ok'); onClose(); onChanged(); } catch (e) { toast(e.message, 'err'); } };
  const cancellable = b && ['REQUESTED', 'ACCEPTED', 'ON_THE_WAY'].includes(b.status);
  return (
    <Sheet open={!!id} onClose={onClose} title={b ? `Booking ${b.booking_code}` : 'Booking'} wide>
      {!b ? <Spinner /> : <div className="adm-detail">
        <div className="row between"><StatusBadge status={b.status} /><b>{money(b.final_amount || b.total_amount)}</b></div>
        <div className="adm-two"><div><h4>Customer</h4><p><b>{b.customer.full_name}</b></p><p><a href={`tel:${b.customer.phone}`}>{b.customer.phone}</a></p><p className="muted">{b.service_address}</p></div>
          <div><h4>Provider</h4><p><b>{b.business_name}</b></p><p><a href={`tel:${b.provider_phone}`}>{b.provider_phone}</a></p><p className="muted">ID {b.provider_public_id}</p></div></div>
        <dl className="adm-dl"><dt>Service</dt><dd>{b.service_name || b.category}</dd><dt>Notes</dt><dd>{b.description || '—'}</dd><dt>Schedule</dt><dd>{b.scheduled_at ? dateTime(b.scheduled_at) : 'ASAP'}</dd>
          <dt>Bill</dt><dd>Service {money(b.service_amount)} + fee {money(b.visit_fee)} + tax {money(b.tax_amount)} − discount {money(b.discount_amount)} {b.coupon_code ? `(${b.coupon_code})` : ''}</dd><dt>Payment</dt><dd>{b.payment_status}</dd>
          {b.cancel_reason && <><dt>Cancel reason</dt><dd>{b.cancel_reason}</dd></>}</dl>
        <h4>Timeline</h4><ul className="adm-timeline">{b.timeline.slice().reverse().map((e, i) => <li key={i}><b>{e.to_status}</b><span>{dateTime(e.created_at)} · {e.actor_role || 'system'}</span>{e.reason && <em>{e.reason}</em>}</li>)}</ul>
        {cancellable && can('BOOKING_MANAGE') && (ask ? <div><textarea rows="2" placeholder="Reason (sent to customer and provider)" value={reason} onChange={(e) => setReason(e.target.value)} /><button className="adm-btn danger" disabled={reason.trim().length < 3} onClick={cancel}>Confirm cancel</button></div> : <button className="adm-btn danger-o" onClick={() => setAsk(true)}>Cancel this booking</button>)}
      </div>}
    </Sheet>
  );
}

/* ------------------------------------------------ Providers ------------------------------------------------ */
export function ProvidersPage({ can }) {
  const toast = useToast(); const [status, setStatus] = useState('PENDING'); const [q, setQ] = useState(''); const [page, setPage] = useState(0); const [data, setData] = useState(null); const [act, setAct] = useState(null); const [note, setNote] = useState('');
  const load = () => adminApi.providers({ status, q, page, size: 20 }).then(setData).catch((e) => toast(e.message, 'err'));
  useEffect(() => { setData(null); load(); }, [status, page]); // eslint-disable-line
  usePolling(load, 20000, [status, page, q]);
  const decide = async () => { try { await adminApi.providerStatus(act.p.id, act.to, note); toast(`Provider ${act.to.toLowerCase()}; they were notified`, 'ok'); setAct(null); setNote(''); load(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div className="adm-stack">
      <div className="adm-toolbar"><div className="chips">{['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED', ''].map((s) => <button key={s || 'all'} className={status === s ? 'on' : ''} onClick={() => { setStatus(s); setPage(0); }}>{s ? s.toLowerCase() : 'all'}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setData(null); load(); }}><input placeholder="Search name, phone, Dialoo ID…" value={q} onChange={(e) => setQ(e.target.value)} /><button>Search</button></form></div>
      {!data ? <Spinner /> : data.items.length === 0 ? <Empty icon={<CircleCheck size={26} aria-hidden="true" />} title={status === 'PENDING' ? 'No pending applications' : 'No providers'} /> : (
        <div className="prov-grid">{data.items.map((p) => (
          <article className="adm-card prov" key={p.id}>
            <div className="row between"><h3>{p.business_name}</h3><span className={`badge ${p.status === 'APPROVED' ? 'green' : p.status === 'PENDING' ? 'amber' : 'red'}`}>{p.status}</span></div>
            <p className="muted">{p.category} · {p.city} · {p.years_experience || 0} yrs · from {money(p.price_from)}</p>
            <p>{p.full_name} · <a href={`tel:${p.phone}`}>{p.phone}</a></p><p className="muted small">{p.address}</p>{p.description && <p className="small">“{p.description}”</p>}
            <p className="muted small">ID {p.public_id} · <Star size={12} fill="currentColor" aria-hidden="true" style={{ verticalAlign: '-1px' }} /> {Number(p.average_rating).toFixed(1)} ({p.review_count}) · {p.completed_jobs_count} jobs · applied {timeAgo(p.created_at)}</p>
            {can('PROVIDER_APPROVE') && <div className="row gap wrap">
              {p.status !== 'APPROVED' && <button className="adm-btn sm" onClick={() => setAct({ p, to: 'APPROVED' })}>Approve</button>}
              {p.status === 'PENDING' && <button className="adm-btn danger-o sm" onClick={() => setAct({ p, to: 'REJECTED' })}>Reject</button>}
              {p.status === 'APPROVED' && <button className="adm-btn danger-o sm" onClick={() => setAct({ p, to: 'SUSPENDED' })}>Suspend</button>}</div>}
          </article>))}</div>)}
      {data && <Pager page={page} setPage={setPage} total={data.total} size={20} />}
      <Sheet open={!!act} onClose={() => setAct(null)} title={act ? `${act.to.toLowerCase()} — ${act.p.business_name}` : ''}>
        <textarea rows="3" placeholder={act?.to === 'APPROVED' ? 'Optional note' : 'Reason (shown to the provider)'} value={note} onChange={(e) => setNote(e.target.value)} />
        <button className={`adm-btn ${act?.to === 'APPROVED' ? '' : 'danger'}`} disabled={act?.to !== 'APPROVED' && note.trim().length < 3} onClick={decide}>Confirm {act?.to.toLowerCase()}</button>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------ Users ------------------------------------------------ */
export function UsersPage({ can, user }) {
  const toast = useToast(); const [role, setRole] = useState(''); const [q, setQ] = useState(''); const [page, setPage] = useState(0); const [data, setData] = useState(null);
  const load = () => adminApi.users({ role, q, page, size: 25 }).then(setData).catch((e) => toast(e.message, 'err'));
  useEffect(() => { setData(null); load(); }, [role, page]); // eslint-disable-line
  const toggle = async (u) => { try { await adminApi.setEnabled(u.id, !u.enabled); toast(u.enabled ? 'User disabled and signed out' : 'User enabled', 'ok'); load(); } catch (e) { toast(e.message, 'err'); } };
  const [staffOpen, setStaffOpen] = useState(false); const [sf, setSf] = useState({ fullName: '', phone: '', email: '', role: 'ADMIN' }); const [cred, setCred] = useState(null); const [busy, setBusy] = useState(false);
  const isStaff = (r) => ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'].includes(r);
  const createStaff = async () => { setBusy(true); try { const r = await adminApi.addStaff({ ...sf, email: sf.email.trim() }); setCred({ title: `${r.role.replace('_', ' ')} created`, phone: r.phone, pw: r.tempPassword }); setStaffOpen(false); setSf({ fullName: '', phone: '', email: '', role: 'ADMIN' }); load(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const resetPw = async (u) => { if (!window.confirm(`Create a new temporary password for ${u.full_name}? Their current password stops working and all their sessions end.`)) return; try { const r = await adminApi.resetStaffPassword(u.id); setCred({ title: `New temporary password for ${u.full_name}`, phone: u.phone, pw: r.tempPassword }); load(); } catch (e) { toast(e.message, 'err'); } };
  const changeRole = async (u, r) => { if (!window.confirm(`Change ${u.full_name} to ${r}? Their admin sessions will be revoked.`)) return; try { await adminApi.setRole(u.id, r); toast('Role updated', 'ok'); load(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div className="adm-stack">
      <div className="adm-toolbar"><div className="chips">{['', 'CUSTOMER', 'PROVIDER', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN'].map((s) => <button key={s || 'all'} className={role === s ? 'on' : ''} onClick={() => { setRole(s); setPage(0); }}>{s ? s.replace('_', ' ').toLowerCase() : 'all'}</button>)}</div>
        <div className="row gap wrap"><form onSubmit={(e) => { e.preventDefault(); setPage(0); setData(null); load(); }}><input placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} /><button>Search</button></form>
          {can('STAFF_MANAGE') && <button className="adm-btn sm" onClick={() => setStaffOpen(true)}>+ Add admin / staff</button>}</div></div>
      {!data ? <Spinner /> : <Card className="flush"><div className="table-wrap"><table className="adm-table"><thead><tr><th>User</th><th>Role</th><th>Bookings</th><th>Joined</th><th>Last login</th><th>Status</th><th /></tr></thead><tbody>
        {data.items.map((u) => <tr key={u.id}><td><b>{u.full_name}</b><small>{u.phone}{u.email ? ` · ${u.email}` : ''}</small></td>
          <td>{can('STAFF_MANAGE') && u.id !== user.id ? <select value={u.role} onChange={(e) => changeRole(u, e.target.value)}>{['CUSTOMER', 'PROVIDER', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN'].map((r) => <option key={r}>{r}</option>)}</select> : u.role}</td>
          <td>{u.bookings}</td><td>{dateTime(u.created_at)}</td><td>{u.last_login_at ? timeAgo(u.last_login_at) : '—'}</td><td>{Number(u.locked) ? <span className="badge amber">locked</span> : u.enabled ? <span className="badge green">active</span> : <span className="badge red">disabled</span>}</td>
          <td><div className="row gap wrap">{can('USER_MANAGE') && u.id !== user.id && <button className={`adm-btn sm ${u.enabled ? 'danger-o' : ''}`} onClick={() => toggle(u)}>{u.enabled ? 'Disable' : 'Enable'}</button>}
            {can('STAFF_MANAGE') && u.id !== user.id && isStaff(u.role) && <button className="adm-btn sm ghost" onClick={() => resetPw(u)}>Reset password</button>}</div></td></tr>)}</tbody></table></div>
        <Pager page={page} setPage={setPage} total={data.total} /></Card>}
      <Sheet open={staffOpen} onClose={() => setStaffOpen(false)} title="Add admin / staff"><div className="adm-form">
        <p className="muted small">Creates a sign-in for someone you trust. You will get a one-time temporary password to share privately; they must choose their own password at first sign-in, and every sign-in needs an OTP on their mobile.</p>
        <label>Full name<input value={sf.fullName} onChange={(e) => setSf({ ...sf, fullName: e.target.value })} /></label>
        <label>Mobile number (10 digits, receives the sign-in OTP)<input inputMode="numeric" maxLength={10} value={sf.phone} onChange={(e) => setSf({ ...sf, phone: e.target.value.replace(/\D/g, '') })} /></label>
        <label>Email (optional)<input type="email" value={sf.email} onChange={(e) => setSf({ ...sf, email: e.target.value })} /></label>
        <label>Role<select value={sf.role} onChange={(e) => setSf({ ...sf, role: e.target.value })}>
          <option value="SUPPORT">Support — view bookings, cancel/handle them</option><option value="ADMIN">Admin — providers, users, catalog, offers, locations, broadcast</option><option value="SUPER_ADMIN">Super admin — everything incl. settings and staff</option></select></label>
        {sf.role === 'SUPER_ADMIN' && <p className="adm-warn">Super admins have full control, including creating other admins. Give this role only to people you fully trust.</p>}
        <button className="adm-btn" disabled={busy || sf.fullName.trim().length < 2 || !/^[6-9][0-9]{9}$/.test(sf.phone)} onClick={createStaff}>{busy ? 'Creating…' : 'Create login'}</button></div></Sheet>
      <Sheet open={!!cred} onClose={() => setCred(null)} title={cred?.title || ''}>{cred && <div className="adm-detail">
        <p>Mobile: <b>{cred.phone}</b></p><p className="muted small">Temporary password (shown only once — copy it now):</p>
        <div className="temp-pw"><span>{cred.pw}</span><button onClick={() => { navigator.clipboard?.writeText(cred.pw); toast('Copied', 'ok'); }}>Copy</button></div>
        <p className="muted small">They sign in at /admin with this password, enter the OTP sent to their mobile, and then must set a new password.</p>
        <button className="adm-btn" onClick={() => setCred(null)}>I have saved it</button></div>}</Sheet>
    </div>
  );
}
