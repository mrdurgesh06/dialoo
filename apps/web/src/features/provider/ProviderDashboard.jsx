import React, { useEffect, useState } from 'react';
import { catalogApi, providerApi, customerApi } from '../../shared/api.js';
import { go } from '../../shared/router.js';
import { Empty, Sheet, Spinner, StatusBadge, dateTime, money, timeAgo, useT, useToast, usePolling } from '../../shared/ui.jsx';
import { ChatSheet } from '../customer/Tracking.jsx';
import { useShareLocation } from '../../shared/useShareLocation.js';
import { Ban, Banknote, CalendarClock, CarFront, CircleCheck, HardHat, Hourglass, Inbox, LockKeyhole, MapPin, MessageCircle, PartyPopper, Phone, Play, Star, Zap } from 'lucide-react';

export function BecomeProvider({ user, onNeedLogin, onLocate }) {
  const t = useT(); const toast = useToast();
  const [cats, setCats] = useState([]); const [cities, setCities] = useState([]); const [services, setServices] = useState([]); const [done, setDone] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [f, setF] = useState({ businessName: '', categoryId: '', city: '', address: '', priceFrom: '', yearsExperience: '', description: '', emergencyAvailable: false, serviceIds: [], latitude: null, longitude: null });
  const [locBusy, setLocBusy] = useState(false);
  const here = async () => { setLocBusy(true); try { const r = await onLocate(); setF((x) => ({ ...x, address: r?.place?.address && !x.address ? r.place.address : x.address, latitude: r?.pos?.lat ?? null, longitude: r?.pos?.lng ?? null })); toast(t('Shop location saved', 'दुकान की लोकेशन सेव हुई'), 'ok'); } catch { /* toast shown */ } finally { setLocBusy(false); } };
  useEffect(() => { catalogApi.categories().then(setCats); catalogApi.cities().then((c) => { setCities(c); if (c[0]) setF((x) => ({ ...x, city: x.city || c[0].name })); }); }, []);
  useEffect(() => { const c = cats.find((x) => String(x.id) === String(f.categoryId)); if (c) catalogApi.services(c.slug).then(setServices).catch(() => setServices([])); else setServices([]); setF((x) => ({ ...x, serviceIds: [] })); }, [f.categoryId]); // eslint-disable-line
  if (!user) return <Empty icon={<HardHat size={26} aria-hidden="true" />} title={t('Sign in to become a Dialoo Partner', 'Dialoo पार्टनर बनने के लिए साइन इन करें')} action={<button className="btn primary" onClick={onNeedLogin}>{t('Sign in', 'साइन इन')}</button>} />;
  if (done) return <Empty icon={<PartyPopper size={26} aria-hidden="true" />} title={t('Application submitted', 'आवेदन जमा हुआ')} text={`${t('Your Dialoo ID', 'आपका Dialoo ID')}: ${done.publicId}. ${t('We will notify you once the team approves your profile.', 'टीम के अप्रूव करते ही आपको सूचना मिलेगी।')}`} action={<button className="btn primary" onClick={() => go('/pro')}>{t('Open Dialoo Partner dashboard', 'Dialoo पार्टनर डैशबोर्ड')}</button>} />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.categoryId) return setErr(t('Choose your main service category.', 'मुख्य सर्विस श्रेणी चुनें।'));
    setBusy(true);
    try { const r = await providerApi.apply({ ...f, categoryId: Number(f.categoryId), priceFrom: Number(f.priceFrom), yearsExperience: Number(f.yearsExperience || 0) }); setDone(r); toast(t('Application submitted', 'आवेदन जमा हुआ'), 'ok'); }
    catch (er) { setErr(er.message); } finally { setBusy(false); }
  };
  return (
    <form className="card form-card" onSubmit={submit}>
      <h1 className="page-title">{t('Become a Dialoo Partner', 'Dialoo पार्टनर बनें')}</h1>
      <p className="muted">{t('Get discovered by consumers nearby. Profiles are reviewed before going live.', 'पास के कंज़्यूमरों तक पहुँचें। प्रोफाइल लाइव होने से पहले जाँची जाती है।')}</p>
      <div className="field"><label>{t('Business / your name', 'दुकान / आपका नाम')}</label><input required minLength={3} value={f.businessName} onChange={set('businessName')} placeholder="Ramesh Electrical Works" /></div>
      <div className="two"><div className="field"><label>{t('Category', 'श्रेणी')}</label><select required value={f.categoryId} onChange={set('categoryId')}><option value="">{t('Select…', 'चुनें…')}</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label>{t('City', 'शहर')}</label><select required value={f.city} onChange={set('city')}>{cities.map((c) => <option key={c.id}>{c.name}</option>)}</select></div></div>
      {services.length > 0 && <div className="field"><label>{t('Services you offer', 'आप कौन सी सर्विस देते हैं')}</label><div className="chip-row">{services.map((s) => <button type="button" key={s.id} className={`chip ${f.serviceIds.includes(s.id) ? 'on' : ''}`} onClick={() => setF({ ...f, serviceIds: f.serviceIds.includes(s.id) ? f.serviceIds.filter((x) => x !== s.id) : [...f.serviceIds, s.id] })}>{s.name}</button>)}</div></div>}
      <div className="field"><label>{t('Shop / work address', 'दुकान / काम का पता')}</label><input required minLength={5} value={f.address} onChange={set('address')} />
        <button type="button" className="chip locate-chip" disabled={locBusy} onClick={here}><MapPin size={15} aria-hidden="true" /> {f.latitude ? t('Location saved (tap to update)', 'लोकेशन सेव (अपडेट के लिए टैप)') : t('Use my current location (helps consumers find you)', 'मेरी मौजूदा लोकेशन (कंज़्यूमर आपको आसानी से ढूँढेंगे)')}</button></div>
      <div className="two"><div className="field"><label>{t('Starting price (₹)', 'शुरुआती कीमत (₹)')}</label><input required type="number" min="0" value={f.priceFrom} onChange={set('priceFrom')} /></div>
        <div className="field"><label>{t('Experience (years)', 'अनुभव (साल)')}</label><input type="number" min="0" max="70" value={f.yearsExperience} onChange={set('yearsExperience')} /></div></div>
      <div className="field"><label>{t('About your work', 'अपने काम के बारे में')}</label><textarea rows="3" maxLength={1000} value={f.description} onChange={set('description')} /></div>
      <label className="check"><input type="checkbox" checked={f.emergencyAvailable} onChange={set('emergencyAvailable')} /> {t('I can take emergency calls', 'मैं इमरजेंसी कॉल ले सकता हूँ')}</label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary block" disabled={busy}>{busy ? t('Submitting…', 'जमा हो रहा है…') : t('Submit for review', 'रिव्यू के लिए भेजें')}</button>
    </form>
  );
}

export default function ProviderDashboard({ user, onNeedLogin }) {
  const t = useT(); const toast = useToast();
  const [me, setMe] = useState(undefined); const [sum, setSum] = useState(null); const [rows, setRows] = useState([]); const [tab, setTab] = useState('new'); const [plans, setPlans] = useState([]); const [sub, setSub] = useState(null);
  const [startFor, setStartFor] = useState(null); const [doneFor, setDoneFor] = useState(null); const [rejectFor, setRejectFor] = useState(null); const [chatFor, setChatFor] = useState(null);

  const load = async () => {
    try { const m = await providerApi.me(); setMe(m); if (m.status === 'APPROVED') { const [s, b] = await Promise.all([providerApi.summary(), providerApi.bookings()]); setSum(s); setRows(b); } }
    catch { setMe(null); }
  };
  useEffect(() => { if (user) { load(); catalogApi.plans().then(setPlans); providerApi.subscription().then(setSub).catch(() => {}); } }, [user]); // eslint-disable-line
  usePolling(load, 8000, [user], !!user && me?.status === 'APPROVED');
  const sharing = useShareLocation(me?.status === 'APPROVED' ? rows.filter((r) => r.status === 'ON_THE_WAY').map((r) => r.id) : []);

  if (!user) return <Empty icon={<LockKeyhole size={26} aria-hidden="true" />} title={t('Sign in to open your dashboard', 'डैशबोर्ड के लिए साइन इन करें')} action={<button className="btn primary" onClick={onNeedLogin}>{t('Sign in', 'साइन इन')}</button>} />;
  if (me === undefined) return <Spinner />;
  if (me === null) return <Empty icon={<HardHat size={26} aria-hidden="true" />} title={t('You are not a Dialoo Partner yet', 'आप अभी Dialoo पार्टनर नहीं हैं')} action={<button className="btn primary" onClick={() => go('/become-provider')}>{t('Become a Dialoo Partner', 'Dialoo पार्टनर बनें')}</button>} />;
  if (me.status !== 'APPROVED') return <Empty icon={me.status === 'PENDING' ? <Hourglass size={26} aria-hidden="true" /> : <Ban size={26} aria-hidden="true" />} title={me.status === 'PENDING' ? t('Your profile is under review', 'आपकी प्रोफाइल रिव्यू में है') : `${t('Profile status', 'प्रोफाइल स्थिति')}: ${me.status}`} text={me.status === 'PENDING' ? t('You will get a notification once the Dialoo team approves you.', 'Dialoo टीम के अप्रूव करते ही सूचना मिलेगी।') : t('Please contact Dialoo support.', 'कृपया Dialoo सपोर्ट से संपर्क करें।')} />;

  const act = async (fn, okMsg) => { try { await fn(); toast(okMsg, 'ok'); load(); } catch (e) { toast(e.message, 'err'); } };
  const setStatus = (id, body, msg) => act(() => customerApi.setStatus(id, body), msg);
  const groups = { new: rows.filter((r) => r.status === 'REQUESTED'), active: rows.filter((r) => ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(r.status)), done: rows.filter((r) => !['REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(r.status)) };
  const list = groups[tab];

  return (
    <div className="pro">
      <div className="pro-head card">
        <div><h1>{me.business_name}</h1><p className="muted">{t('Dialoo ID', 'Dialoo ID')} {me.public_id} · <Star size={13} fill="currentColor" aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {Number(me.average_rating).toFixed(1)} ({me.review_count})</p></div>
        <label className={`switch ${sum?.available_now ? 'on' : ''}`}><input type="checkbox" checked={!!sum?.available_now} onChange={(e) => act(() => providerApi.setAvailability(e.target.checked), e.target.checked ? t('You are online', 'आप ऑनलाइन हैं') : t('You are offline', 'आप ऑफलाइन हैं'))} /><span /> <b>{sum?.available_now ? t('Online', 'ऑनलाइन') : t('Offline', 'ऑफलाइन')}</b></label>
      </div>
      {sharing.status !== 'idle' && (
        <div className={`share-banner ${sharing.status}`} role="status">
          {sharing.status === 'live' && <><span className="dot" aria-hidden="true" />{t('Live location is being shared with the consumer until you start the work.', 'काम शुरू करने तक आपकी लाइव लोकेशन कंज़्यूमर को दिख रही है।')}</>}
          {sharing.status === 'denied' && <>{t('Location permission is off. Allow location for Dialoo so the consumer can track you.', 'लोकेशन की अनुमति बंद है। कंज़्यूमर के ट्रैक करने के लिए Dialoo को लोकेशन की अनुमति दें।')}</>}
          {sharing.status === 'error' && <>{t('Could not send your location. Keep the app open and GPS on.', 'आपकी लोकेशन नहीं भेज सके। ऐप खुला और GPS चालू रखें।')}</>}
        </div>
      )}
      {sum && <div className="kpis">
        <div className="kpi hot"><span>{t('New requests', 'नई रिक्वेस्ट')}</span><b>{sum.new_requests}</b></div><div className="kpi"><span>{t('Active jobs', 'चालू काम')}</span><b>{sum.active_jobs}</b></div>
        <div className="kpi"><span>{t("Today's earnings", 'आज की कमाई')}</span><b>{money(sum.earnings_today)}</b></div><div className="kpi"><span>{t('Total earned', 'कुल कमाई')}</span><b>{money(sum.earnings_total)}</b></div>
        <div className="kpi"><span>{t('To collect', 'वसूलना बाकी')}</span><b>{money(sum.unpaid_total)}</b></div><div className="kpi"><span>{t('Jobs done', 'पूरे काम')}</span><b>{sum.completed_jobs_count}</b></div>
      </div>}
      <div className="seg"><button className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')}>{t('New', 'नई')} ({groups.new.length})</button><button className={tab === 'active' ? 'on' : ''} onClick={() => setTab('active')}>{t('Active', 'चालू')} ({groups.active.length})</button><button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>{t('History', 'इतिहास')}</button></div>
      {list.length === 0 ? <Empty icon={<Inbox size={26} aria-hidden="true" />} title={tab === 'new' ? t('No new requests', 'कोई नई रिक्वेस्ट नहीं') : t('Nothing here', 'यहाँ कुछ नहीं')} text={tab === 'new' && !sum?.available_now ? t('Go online to receive bookings.', 'बुकिंग पाने के लिए ऑनलाइन हों।') : ''} /> : list.map((r) => (
        <article key={r.id} className={`job ${r.urgency === 'URGENT' && r.status === 'REQUESTED' ? 'urgent' : ''}`}>
          <div className="row between"><b>#{r.booking_code}</b><StatusBadge status={r.status} /></div>
          <h3>{r.category_icon} {r.service_name || r.category} · {money(r.total_amount)}</h3>
          <p><b>{r.customer_name}</b> · {r.service_address}</p>
          {r.description && <p className="muted">“{r.description}”</p>}
          <p className="muted small">{r.scheduled_at ? <><CalendarClock size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {dateTime(r.scheduled_at)}</> : <><Zap size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {t('ASAP', 'तुरंत')}</>} · {timeAgo(r.created_at)}</p>
          <div className="row gap wrap">
            {r.status === 'REQUESTED' && <><button className="btn primary sm" onClick={() => setStatus(r.id, { status: 'ACCEPTED' }, t('Booking accepted', 'बुकिंग स्वीकार'))}>{t('Accept', 'स्वीकार')}</button><button className="btn danger-outline sm" onClick={() => setRejectFor(r)}>{t('Reject', 'अस्वीकार')}</button></>}
            {r.status === 'ACCEPTED' && <button className="btn primary sm" onClick={() => setStatus(r.id, { status: 'ON_THE_WAY' }, t('Marked on the way', 'रास्ते में'))}><CarFront size={16} aria-hidden="true" />{t('I am on the way', 'मैं निकल गया')}</button>}
            {r.status === 'ON_THE_WAY' && <button className="btn primary sm" onClick={() => setStartFor(r)}><Play size={16} aria-hidden="true" />{t('Start work (enter code)', 'काम शुरू (कोड डालें)')}</button>}
            {r.status === 'IN_PROGRESS' && <button className="btn primary sm" onClick={() => setDoneFor(r)}><CircleCheck size={16} aria-hidden="true" />{t('Complete job', 'काम पूरा करें')}</button>}
            {r.status === 'COMPLETED' && r.payment_status !== 'PAID' && <button className="btn outline sm" onClick={() => act(() => providerApi.paymentReceived(r.id), t('Payment recorded', 'भुगतान दर्ज'))}><Banknote size={16} aria-hidden="true" />{t('Mark paid', 'भुगतान मिला')}</button>}
            {r.status === 'COMPLETED' && r.payment_status === 'PAID' && <span className="ok"><Banknote size={16} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> {t('Paid', 'भुगतान मिला')}</span>}
            {['ACCEPTED', 'ON_THE_WAY'].includes(r.status) && <button className="btn danger-outline sm" onClick={() => setRejectFor({ ...r, cancel: true })}>{t('Cancel', 'रद्द')}</button>}
            {['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(r.status) && r.contact_phone && <a className="btn outline sm" href={`tel:${r.contact_phone}`}><Phone size={16} aria-hidden="true" />{t('Call consumer', 'कस्टमर को कॉल')}</a>}
            {!['REJECTED', 'EXPIRED', 'CANCELLED'].includes(r.status) && <button className="btn ghost sm" aria-label={t('Chat', 'चैट')} onClick={() => setChatFor(r.id)}><MessageCircle size={16} aria-hidden="true" /></button>}
          </div>
        </article>
      ))}

      <section className="card"><h3>{t('Your plan', 'आपका प्लान')}</h3>
        <p>{sub?.plan ? <><b>{sub.plan}</b> · {sub.status}{sub.current_period_end ? ` · ${t('till', 'तक')} ${new Date(sub.current_period_end).toLocaleDateString('en-IN')}` : ''}</> : t('No plan yet', 'कोई प्लान नहीं')}</p>
        <div className="plans">{plans.map((p) => <div key={p.id} className="plan"><b>{p.name}</b><span>{Number(p.price) ? `₹${Number(p.price)}/mo` : 'Free'}</span><small>{p.features}</small>
          <button className="btn outline sm" onClick={() => act(async () => { const r = await providerApi.choosePlan(p.id); if (r.message) toast(r.message, 'info'); providerApi.subscription().then(setSub); }, t('Request sent', 'अनुरोध भेजा'))}>{Number(p.price) ? t('Upgrade', 'अपग्रेड') : t('Select', 'चुनें')}</button></div>)}</div></section>

      <Sheet open={!!startFor} onClose={() => setStartFor(null)} title={t('Enter consumer start code', 'कस्टमर का स्टार्ट कोड डालें')}><CodeForm onSubmit={(code) => { setStatus(startFor.id, { status: 'IN_PROGRESS', startCode: code }, t('Work started', 'काम शुरू')); setStartFor(null); }} /></Sheet>
      <Sheet open={!!doneFor} onClose={() => setDoneFor(null)} title={t('Complete job', 'काम पूरा करें')}><AmountForm initial={doneFor?.total_amount} onSubmit={(amt) => { setStatus(doneFor.id, { status: 'COMPLETED', finalAmount: amt }, t('Job completed', 'काम पूरा')); setDoneFor(null); }} /></Sheet>
      <Sheet open={!!rejectFor} onClose={() => setRejectFor(null)} title={rejectFor?.cancel ? t('Cancel this job', 'यह काम रद्द करें') : t('Reject request', 'रिक्वेस्ट अस्वीकार')}><ReasonForm onSubmit={(reason) => { setStatus(rejectFor.id, { status: rejectFor.cancel ? 'CANCELLED' : 'REJECTED', reason }, t('Done', 'हो गया')); setRejectFor(null); }} /></Sheet>
      {chatFor && <ChatSheet open onClose={() => setChatFor(null)} bookingId={chatFor} />}
    </div>
  );
}

function CodeForm({ onSubmit }) { const t = useT(); const [c, setC] = useState(''); return <><input className="code-input" inputMode="numeric" maxLength={4} value={c} onChange={(e) => setC(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoFocus /><button className="btn primary block" disabled={c.length !== 4} onClick={() => onSubmit(c)}>{t('Start work', 'काम शुरू करें')}</button></>; }
function AmountForm({ initial, onSubmit }) { const t = useT(); const [a, setA] = useState(String(initial ?? '')); return <><label>{t('Final amount agreed with consumer (₹)', 'कंज़्यूमर से तय अंतिम राशि (₹)')}</label><input type="number" min="0" value={a} onChange={(e) => setA(e.target.value)} /><button className="btn primary block" disabled={a === ''} onClick={() => onSubmit(Number(a))}>{t('Mark complete', 'पूरा करें')}</button></>; }
function ReasonForm({ onSubmit }) { const t = useT(); const [r, setR] = useState(''); return <><textarea rows="3" value={r} onChange={(e) => setR(e.target.value)} placeholder={t('Reason (shown to consumer)', 'कारण (कंज़्यूमर को दिखेगा)')} /><button className="btn danger block" onClick={() => onSubmit(r)}>{t('Confirm', 'पक्का करें')}</button></>; }
