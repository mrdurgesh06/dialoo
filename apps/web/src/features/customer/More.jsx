import React, { useEffect, useState } from 'react';
import { authApi, catalogApi, customerApi } from '../../shared/api.js';
import { go } from '../../shared/router.js';
import { Empty, Spinner, money, useT, useToast, useRole } from '../../shared/ui.jsx';
import { ProviderCard } from '../../shared/parts.jsx';
import { Ambulance, CarFront, ChevronRight, ClipboardList, Construction, Ellipsis, Flame, Languages, Phone, Plus, ShieldAlert, Siren, Tractor, UserRound, X, Zap, FileText, Handshake } from 'lucide-react';

const EMG = [['MEDICAL', Ambulance, 'Medical', 'मेडिकल'], ['VEHICLE', CarFront, 'Vehicle breakdown', 'गाड़ी खराब'], ['HOME', Zap, 'Home emergency', 'घर की इमरजेंसी'], ['FIRE', Flame, 'Fire', 'आग'], ['POLICE', ShieldAlert, 'Police', 'पुलिस'], ['OTHER', Ellipsis, 'Other', 'अन्य']];

export function Emergency({ user, onNeedLogin }) {
  const t = useT(); const toast = useToast(); const [type, setType] = useState(''); const [f, setF] = useState({ address: '', contactPhone: user?.phone || '', description: '' }); const [res, setRes] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (res) return <Empty icon={<Siren size={26} aria-hidden="true" />} title={`${t('Request received', 'रिक्वेस्ट मिली')} · ${res.code}`} text={t('Our team has been alerted and will call you. If anyone is in immediate danger, call 112 now.', 'हमारी टीम को अलर्ट मिल गया है। जान का खतरा हो तो अभी 112 पर कॉल करें।')} action={<a className="btn danger" href="tel:112"><Phone size={16} aria-hidden="true" />{t('Call 112', '112 पर कॉल करें')}</a>} />;
  const submit = async () => {
    if (!user) return onNeedLogin(); setErr('');
    try { setBusy(true); setRes(await customerApi.emergency({ emergencyType: type, ...f })); toast(t('Emergency alert sent', 'इमरजेंसी अलर्ट भेजा गया'), 'ok'); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div>
      <div className="alert-banner"><Siren size={18} aria-hidden="true" /><span>{t('For immediate danger call 112 first.', 'जान का खतरा हो तो पहले 112 पर कॉल करें।')}</span> <a href="tel:112">112</a></div>
      <h1 className="page-title">{t('Emergency help', 'इमरजेंसी मदद')}</h1>
      <div className="cat-grid">{EMG.map(([key, Icon, en, hi]) => <button key={key} className={`cat ${type === key ? 'sel' : ''}`} aria-pressed={type === key} onClick={() => setType(key)}><span className="cat-ico"><Icon size={26} strokeWidth={1.9} aria-hidden="true" /></span><b>{t(en, hi)}</b></button>)}</div>
      {type && <div className="card form-card">
        <div className="field"><label>{t('Where are you?', 'आप कहाँ हैं?')}</label><textarea rows="2" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder={t('Address / landmark', 'पता / लैंडमार्क')} /></div>
        <div className="field"><label>{t('Phone', 'फ़ोन')}</label><input inputMode="tel" value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} /></div>
        <div className="field"><label>{t('What happened?', 'क्या हुआ?')}</label><textarea rows="2" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        {err && <p className="error">{err}</p>}
        <button className="btn danger block" disabled={busy || f.address.length < 5} onClick={submit}>{t('Send emergency request', 'इमरजेंसी रिक्वेस्ट भेजें')}</button>
        <p className="muted small">{t('Dialoo records your request and alerts our team. It does not replace 112 / ambulance services.', 'Dialoo आपकी रिक्वेस्ट दर्ज कर टीम को अलर्ट करता है। यह 112/एम्बुलेंस का विकल्प नहीं है।')}</p>
      </div>}
    </div>
  );
}

export function Rentals({ user, onNeedLogin, city }) {
  const t = useT(); const toast = useToast(); const [rows, setRows] = useState(null); const [add, setAdd] = useState(false); const [f, setF] = useState({ title: '', category: 'Tractor', description: '', city: city?.name || 'Sahaswan', pricePerDay: '' });
  const load = () => customerApi.rentals({ city: city?.name }).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, [city]); // eslint-disable-line
  const submit = async () => { if (!user) return onNeedLogin(); try { await customerApi.createRental({ ...f, pricePerDay: Number(f.pricePerDay) }); toast(t('Listing added', 'लिस्टिंग जुड़ी'), 'ok'); setAdd(false); load(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div>
      <div className="row between"><h1 className="page-title">{t('Equipment rentals', 'उपकरण किराये पर')}</h1><button className="btn primary sm" onClick={() => setAdd(!add)}>{add ? <X size={16} aria-hidden="true" /> : <><Plus size={16} aria-hidden="true" />{t('List yours', 'अपना जोड़ें')}</>}</button></div>
      {add && <div className="card form-card"><div className="two"><div className="field"><label>{t('Title', 'शीर्षक')}</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Mahindra 575 tractor" /></div><div className="field"><label>{t('Category', 'श्रेणी')}</label><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['Tractor', 'Trolley', 'Harvester', 'Generator', 'JCB', 'Water Tanker', 'Tools', 'Event Equipment'].map((c) => <option key={c}>{c}</option>)}</select></div></div>
        <div className="two"><div className="field"><label>{t('City', 'शहर')}</label><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div><div className="field"><label>{t('Price / day (₹)', 'कीमत / दिन (₹)')}</label><input type="number" min="1" value={f.pricePerDay} onChange={(e) => setF({ ...f, pricePerDay: e.target.value })} /></div></div>
        <div className="field"><label>{t('Details', 'विवरण')}</label><textarea rows="2" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div><button className="btn primary block" disabled={!f.title || !f.pricePerDay} onClick={submit}>{t('Publish listing', 'लिस्टिंग डालें')}</button></div>}
      {!rows ? <Spinner /> : rows.length === 0 ? <Empty icon={<Tractor size={26} aria-hidden="true" />} title={t('No rentals listed yet', 'अभी कोई रेंटल नहीं')} /> : <div className="grid">{rows.map((r) => <div key={r.id} className="card"><h3>{r.title}</h3><p className="muted">{r.category} · {r.city} · {r.owner_name}</p><p>{r.description}</p><b>{money(r.price_per_day)}/{t('day', 'दिन')}</b></div>)}</div>}
    </div>
  );
}

export function Projects({ user, onNeedLogin, city }) {
  const t = useT(); const toast = useToast(); const [rows, setRows] = useState(null); const [add, setAdd] = useState(false); const [f, setF] = useState({ title: '', category: 'Painting', scopeDescription: '', city: city?.name || 'Sahaswan', budgetMin: '', budgetMax: '', timeline: '' });
  const load = () => customerApi.projects({ city: city?.name }).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, [city]); // eslint-disable-line
  const submit = async () => { if (!user) return onNeedLogin(); try { await customerApi.createProject({ ...f, budgetMin: f.budgetMin ? Number(f.budgetMin) : null, budgetMax: f.budgetMax ? Number(f.budgetMax) : null }); toast(t('Project posted', 'प्रोजेक्ट डाला गया'), 'ok'); setAdd(false); load(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div>
      <div className="row between"><h1 className="page-title">{t('Projects', 'प्रोजेक्ट')}</h1><button className="btn primary sm" onClick={() => setAdd(!add)}>{add ? <X size={16} aria-hidden="true" /> : <><Plus size={16} aria-hidden="true" />{t('Post project', 'प्रोजेक्ट डालें')}</>}</button></div>
      {add && <div className="card form-card"><div className="field"><label>{t('Title', 'शीर्षक')}</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="2BHK house painting" /></div>
        <div className="two"><div className="field"><label>{t('Type', 'प्रकार')}</label><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['Painting', 'Construction', 'Renovation', 'Electrical', 'Plumbing', 'Interior', 'Masonry'].map((c) => <option key={c}>{c}</option>)}</select></div><div className="field"><label>{t('City', 'शहर')}</label><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div></div>
        <div className="two"><div className="field"><label>{t('Budget min (₹)', 'न्यूनतम बजट')}</label><input type="number" value={f.budgetMin} onChange={(e) => setF({ ...f, budgetMin: e.target.value })} /></div><div className="field"><label>{t('Budget max (₹)', 'अधिकतम बजट')}</label><input type="number" value={f.budgetMax} onChange={(e) => setF({ ...f, budgetMax: e.target.value })} /></div></div>
        <div className="field"><label>{t('Scope of work', 'काम का विवरण')}</label><textarea rows="3" value={f.scopeDescription} onChange={(e) => setF({ ...f, scopeDescription: e.target.value })} /></div>
        <div className="field"><label>{t('Timeline', 'समय-सीमा')}</label><input value={f.timeline} onChange={(e) => setF({ ...f, timeline: e.target.value })} placeholder="2 weeks" /></div><button className="btn primary block" disabled={!f.title || f.scopeDescription.length < 5} onClick={submit}>{t('Post project', 'प्रोजेक्ट डालें')}</button></div>}
      {!rows ? <Spinner /> : rows.length === 0 ? <Empty icon={<Construction size={26} aria-hidden="true" />} title={t('No open projects', 'कोई खुला प्रोजेक्ट नहीं')} /> : <div className="grid">{rows.map((p) => <div key={p.id} className="card"><h3>{p.title}</h3><p className="muted">{p.category} · {p.city} · {p.customer_name}</p><p>{p.scope_description}</p><b>{p.budget_min || p.budget_max ? `${money(p.budget_min)} – ${money(p.budget_max)}` : t('Budget open', 'बजट खुला')}</b></div>)}</div>}
    </div>
  );
}

export function Profile({ user, favs, onFav, onBook, onLogout, onNeedLogin, lang, setLang }) {
  const t = useT(); const { switchToPartner } = useRole(); const toast = useToast(); const [addrs, setAddrs] = useState([]); const [favRows, setFavRows] = useState([]); const [a, setA] = useState({ label: 'HOME', addressLine: '' });
  const loadAddr = () => customerApi.addresses().then(setAddrs).catch(() => {});
  useEffect(() => { if (user) loadAddr(); }, [user]); // eslint-disable-line
  useEffect(() => { Promise.all(favs.slice(0, 8).map((id) => catalogApi.provider(id).catch(() => null))).then((r) => setFavRows(r.filter(Boolean))); }, [favs]);
  if (!user) return <Empty icon={<UserRound size={26} aria-hidden="true" />} title={t('You are browsing as a guest', 'आप गेस्ट के रूप में हैं')} action={<button className="btn primary" onClick={onNeedLogin}>{t('Sign in / Sign up', 'साइन इन / साइन अप')}</button>} />;
  const addAddr = async () => { try { await customerApi.addAddress(a); setA({ label: 'HOME', addressLine: '' }); loadAddr(); toast(t('Address saved', 'पता सेव हुआ'), 'ok'); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div>
      <section className="card profile-head"><div className="avatar xl">{(user.full_name || 'U')[0].toUpperCase()}</div><div><h2>{user.full_name}</h2><p className="muted">{user.phone}{user.email ? ` · ${user.email}` : ''}</p></div></section>
      <div className="menu">
        <button onClick={() => go('/bookings')}><ClipboardList size={20} aria-hidden="true" />{t('My bookings', 'मेरी बुकिंग')}<i><ChevronRight size={18} aria-hidden="true" /></i></button>
        
        <button onClick={() => go('/rentals')}><Tractor size={20} aria-hidden="true" />{t('Equipment rentals', 'उपकरण किराये')}<i><ChevronRight size={18} aria-hidden="true" /></i></button>
        <button onClick={() => go('/projects')}><Construction size={20} aria-hidden="true" />{t('Projects', 'प्रोजेक्ट')}<i><ChevronRight size={18} aria-hidden="true" /></i></button>
        <button onClick={() => go('/emergency')}><Siren size={20} aria-hidden="true" />{t('Emergency help', 'इमरजेंसी मदद')}<i><ChevronRight size={18} aria-hidden="true" /></i></button>
        <button onClick={() => go('/terms')}><FileText size={20} aria-hidden="true" />{t('Terms & Privacy', 'शर्तें और गोपनीयता')}<i><ChevronRight size={18} aria-hidden="true" /></i></button>
        <button onClick={switchToPartner}><Handshake size={20} aria-hidden="true" />{t('Switch to Dialoo Partner login', 'Dialoo पार्टनर लॉगिन पर जाएँ')}<i><ChevronRight size={18} aria-hidden="true" /></i></button>
        <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}><Languages size={20} aria-hidden="true" />{lang === 'en' ? 'हिन्दी में बदलें' : 'Switch to English'}<i><ChevronRight size={18} aria-hidden="true" /></i></button>
      </div>
      <section className="card"><h3>{t('Saved addresses', 'सेव किए पते')}</h3>
        {addrs.map((x) => <div className="svc-row" key={x.id}><div><b>{x.label}</b> <span className="muted">{x.address_line}</span></div><button className="link danger" onClick={() => customerApi.deleteAddress(x.id).then(loadAddr)}>{t('Remove', 'हटाएँ')}</button></div>)}
        <div className="row gap wrap"><select value={a.label} onChange={(e) => setA({ ...a, label: e.target.value })}>{['HOME', 'OFFICE', 'FARM', 'SHOP', 'OTHER'].map((x) => <option key={x}>{x}</option>)}</select><input className="grow" value={a.addressLine} onChange={(e) => setA({ ...a, addressLine: e.target.value })} placeholder={t('Full address', 'पूरा पता')} /><button className="btn outline sm" disabled={a.addressLine.length < 5} onClick={addAddr}>{t('Save', 'सेव')}</button></div></section>
      <section><h3>{t('Favourites', 'पसंदीदा')}</h3>{favRows.length === 0 ? <p className="muted">{t('Tap the heart on any Dialoo Partner to save them here.', 'किसी Dialoo पार्टनर पर दिल का निशान दबाएँ।')}</p> : <div className="grid">{favRows.map((p) => <ProviderCard key={p.id} p={p} compact fav onFav={onFav} onBook={onBook} />)}</div>}</section>
      <button className="btn danger-outline block" onClick={onLogout}>{t('Log out', 'लॉग आउट')}</button>
    </div>
  );
}
