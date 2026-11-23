import React, { useEffect, useState } from 'react';
import { adminApi } from '../../shared/api.js';
import { Empty, Sheet, Spinner, dateTime, money, timeAgo, useToast } from '../../shared/ui.jsx';
import { Card, Pager } from './OperationsPages.jsx';
import { ChevronLeft, ChevronRight, CircleCheck, Megaphone, Plus } from 'lucide-react';
import { CategoryIcon } from '../../shared/icons.jsx';

const useLoad = (fn, deps = []) => { const [d, setD] = useState(null); const toast = useToast(); const load = () => fn().then(setD).catch((e) => toast(e.message, 'err')); useEffect(() => { load(); }, deps); return [d, load]; }; // eslint-disable-line

/* ------------------------------------------------ Catalog ------------------------------------------------ */
export function CatalogPage() {
  const toast = useToast(); const [cats, loadC] = useLoad(adminApi.categories); const [svcs, loadS] = useLoad(adminApi.services); const [edit, setEdit] = useState(null); const [editS, setEditS] = useState(null);
  const saveCat = async () => { try { await adminApi.saveCategory(edit.id, { name: edit.name, icon: edit.icon, description: edit.description, displayOrder: Number(edit.display_order ?? 100), featured: !!edit.is_featured, active: edit.active !== false && edit.active !== 0, etaMinutes: Number(edit.eta_minutes || 45), baseVisitFee: Number(edit.base_visit_fee ?? 49) }); toast('Category saved', 'ok'); setEdit(null); loadC(); } catch (e) { toast(e.message, 'err'); } };
  const saveSvc = async () => { try { await adminApi.saveService(editS.id, { categoryId: Number(editS.category_id), name: editS.name, basePrice: Number(editS.base_price || 0), durationMinutes: Number(editS.duration_minutes || 60), active: editS.is_active !== false && editS.is_active !== 0 }); toast('Service saved', 'ok'); setEditS(null); loadS(); } catch (e) { toast(e.message, 'err'); } };
  if (!cats || !svcs) return <Spinner />;
  return (
    <div className="adm-stack">
      <Card title="Categories" action={<button className="adm-btn sm" onClick={() => setEdit({ name: '', icon: '🛠️', display_order: 100, eta_minutes: 45, base_visit_fee: 49, active: true })}><Plus size={15} aria-hidden="true" /> Add category</button>} className="flush">
        <div className="table-wrap"><table className="adm-table"><thead><tr><th>Order</th><th>Category</th><th>ETA</th><th>Visit fee</th><th>Providers</th><th>Services</th><th>Status</th><th /></tr></thead><tbody>
          {cats.map((c) => <tr key={c.id}><td>{c.display_order}</td><td><b><CategoryIcon slug={c.slug} name={c.name} size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />{c.name}</b><small>{c.description}</small></td><td>{c.eta_minutes} min</td><td>{money(c.base_visit_fee)}</td><td>{c.providers}</td><td>{c.services}</td><td>{c.active ? <span className="badge green">active</span> : <span className="badge grey">hidden</span>}</td><td><button className="adm-btn sm ghost" onClick={() => setEdit({ ...c })}>Edit</button></td></tr>)}</tbody></table></div></Card>
      <Card title="Services" action={<button className="adm-btn sm" onClick={() => setEditS({ name: '', category_id: cats[0]?.id, base_price: 199, duration_minutes: 60, is_active: true })}>+ Add service</button>} className="flush">
        <div className="table-wrap"><table className="adm-table"><thead><tr><th>Service</th><th>Category</th><th>Base price</th><th>Duration</th><th>Status</th><th /></tr></thead><tbody>
          {svcs.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td>{s.category}</td><td>{money(s.base_price)}</td><td>{s.duration_minutes} min</td><td>{s.is_active ? <span className="badge green">active</span> : <span className="badge grey">hidden</span>}</td><td><button className="adm-btn sm ghost" onClick={() => setEditS({ ...s })}>Edit</button></td></tr>)}</tbody></table></div></Card>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit category' : 'New category'}>{edit && <div className="adm-form">
        <label>Name<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label><label>Icon (stored value, app shows its own icon)<input value={edit.icon || ''} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} /></label>
        <label>Description<input value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
        <div className="adm-two"><label>Display order<input type="number" value={edit.display_order} onChange={(e) => setEdit({ ...edit, display_order: e.target.value })} /></label><label>ETA (minutes)<input type="number" value={edit.eta_minutes} onChange={(e) => setEdit({ ...edit, eta_minutes: e.target.value })} /></label></div>
        <label>Base visit fee (₹)<input type="number" value={edit.base_visit_fee} onChange={(e) => setEdit({ ...edit, base_visit_fee: e.target.value })} /></label>
        <label className="chk"><input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Visible to customers</label><label className="chk"><input type="checkbox" checked={!!edit.is_featured} onChange={(e) => setEdit({ ...edit, is_featured: e.target.checked })} /> Featured</label>
        <button className="adm-btn" disabled={edit.name.trim().length < 2} onClick={saveCat}>Save</button></div>}</Sheet>
      <Sheet open={!!editS} onClose={() => setEditS(null)} title={editS?.id ? 'Edit service' : 'New service'}>{editS && <div className="adm-form">
        <label>Name<input value={editS.name} onChange={(e) => setEditS({ ...editS, name: e.target.value })} /></label>
        <label>Category<select value={editS.category_id} disabled={!!editS.id} onChange={(e) => setEditS({ ...editS, category_id: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="adm-two"><label>Base price (₹)<input type="number" value={editS.base_price} onChange={(e) => setEditS({ ...editS, base_price: e.target.value })} /></label><label>Duration (min)<input type="number" value={editS.duration_minutes} onChange={(e) => setEditS({ ...editS, duration_minutes: e.target.value })} /></label></div>
        <label className="chk"><input type="checkbox" checked={!!editS.is_active} onChange={(e) => setEditS({ ...editS, is_active: e.target.checked })} /> Active</label><button className="adm-btn" disabled={editS.name.trim().length < 2} onClick={saveSvc}>Save</button></div>}</Sheet>
    </div>
  );
}

/* ------------------------------------------------ Offers & banners ------------------------------------------------ */
export function OffersPage() {
  const toast = useToast(); const [coupons, loadC] = useLoad(adminApi.coupons); const [banners, loadB] = useLoad(adminApi.banners); const [cf, setCf] = useState(null); const [bf, setBf] = useState(null);
  const saveC = async () => { try { await adminApi.addCoupon({ code: cf.code, description: cf.description, discountType: cf.discountType, discountValue: Number(cf.discountValue), maxDiscount: cf.maxDiscount ? Number(cf.maxDiscount) : null, minOrder: Number(cf.minOrder || 0), firstBookingOnly: !!cf.first, usageLimit: cf.usageLimit ? Number(cf.usageLimit) : null, perUserLimit: Number(cf.perUserLimit || 1), validDays: Number(cf.validDays || 90) }); toast('Coupon created', 'ok'); setCf(null); loadC(); } catch (e) { toast(e.message, 'err'); } };
  const saveB = async () => { try { await adminApi.saveBanner(bf.id, { title: bf.title, subtitle: bf.subtitle, emoji: bf.emoji, gradient: bf.gradient, ctaLabel: bf.cta_label, targetCategorySlug: bf.target_category_slug || null, couponCode: bf.coupon_code || null, displayOrder: Number(bf.display_order || 100), active: bf.is_active !== false && bf.is_active !== 0 }); toast('Banner saved', 'ok'); setBf(null); loadB(); } catch (e) { toast(e.message, 'err'); } };
  if (!coupons || !banners) return <Spinner />;
  return (
    <div className="adm-stack">
      <Card title="Coupons" action={<button className="adm-btn sm" onClick={() => setCf({ code: '', description: '', discountType: 'FLAT', discountValue: 50, minOrder: 0, perUserLimit: 1, validDays: 90 })}>+ New coupon</button>} className="flush">
        <div className="table-wrap"><table className="adm-table"><thead><tr><th>Code</th><th>Offer</th><th>Min order</th><th>Used</th><th>Valid till</th><th>Status</th></tr></thead><tbody>
          {coupons.map((c) => <tr key={c.id}><td><b>{c.code}</b><small>{c.description}</small></td><td>{c.discount_type === 'PERCENT' ? `${Number(c.discount_value)}%${c.max_discount ? ` up to ${money(c.max_discount)}` : ''}` : money(c.discount_value)}{c.first_booking_only ? <small>first booking only</small> : null}</td><td>{money(c.min_order)}</td><td>{c.used_count}{c.usage_limit ? `/${c.usage_limit}` : ''}</td><td>{c.valid_until ? dateTime(c.valid_until) : '—'}</td>
            <td><label className="switch-sm"><input type="checkbox" checked={!!c.is_active} onChange={async (e) => { try { await adminApi.couponActive(c.id, e.target.checked); loadC(); } catch (x) { toast(x.message, 'err'); } }} /><span /></label></td></tr>)}</tbody></table></div></Card>
      <Card title="Home banners" action={<button className="adm-btn sm" onClick={() => setBf({ title: '', subtitle: '', emoji: '🎉', gradient: '#164ecb,#1f68ed', cta_label: 'Book now', display_order: 100, is_active: true })}><Plus size={15} aria-hidden="true" /> New banner</button>}>
        <div className="banner-list">{banners.map((b) => { const [c1, c2] = (b.gradient || '').split(','); return (
          <div key={b.id} className="banner-prev" style={{ background: `linear-gradient(120deg, ${c1}, ${c2 || c1})`, opacity: b.is_active ? 1 : 0.45 }}><div><b>{b.title}</b><small>{b.subtitle}</small></div><span><Megaphone size={22} aria-hidden="true" /></span>
            <div className="bp-actions"><button onClick={() => setBf({ ...b })}>Edit</button><button onClick={async () => { if (window.confirm('Delete this banner?')) { await adminApi.deleteBanner(b.id); loadB(); } }}>Delete</button></div></div>); })}</div></Card>
      <Sheet open={!!cf} onClose={() => setCf(null)} title="New coupon">{cf && <div className="adm-form">
        <label>Code (letters/numbers)<input value={cf.code} onChange={(e) => setCf({ ...cf, code: e.target.value.toUpperCase() })} maxLength={30} /></label><label>Description<input value={cf.description} onChange={(e) => setCf({ ...cf, description: e.target.value })} /></label>
        <div className="adm-two"><label>Type<select value={cf.discountType} onChange={(e) => setCf({ ...cf, discountType: e.target.value })}><option value="FLAT">Flat ₹</option><option value="PERCENT">Percent %</option></select></label><label>Value<input type="number" value={cf.discountValue} onChange={(e) => setCf({ ...cf, discountValue: e.target.value })} /></label></div>
        <div className="adm-two"><label>Max discount (₹, for %)<input type="number" value={cf.maxDiscount || ''} onChange={(e) => setCf({ ...cf, maxDiscount: e.target.value })} /></label><label>Min order (₹)<input type="number" value={cf.minOrder} onChange={(e) => setCf({ ...cf, minOrder: e.target.value })} /></label></div>
        <div className="adm-two"><label>Total usage limit<input type="number" value={cf.usageLimit || ''} onChange={(e) => setCf({ ...cf, usageLimit: e.target.value })} /></label><label>Per-user limit<input type="number" value={cf.perUserLimit} onChange={(e) => setCf({ ...cf, perUserLimit: e.target.value })} /></label></div>
        <label>Valid for (days)<input type="number" value={cf.validDays} onChange={(e) => setCf({ ...cf, validDays: e.target.value })} /></label><label className="chk"><input type="checkbox" checked={!!cf.first} onChange={(e) => setCf({ ...cf, first: e.target.checked })} /> First booking only</label>
        <button className="adm-btn" disabled={cf.code.length < 3 || !cf.discountValue} onClick={saveC}>Create coupon</button></div>}</Sheet>
      <Sheet open={!!bf} onClose={() => setBf(null)} title={bf?.id ? 'Edit banner' : 'New banner'}>{bf && <div className="adm-form">
        <label>Title<input value={bf.title} onChange={(e) => setBf({ ...bf, title: e.target.value })} /></label><label>Subtitle<input value={bf.subtitle || ''} onChange={(e) => setBf({ ...bf, subtitle: e.target.value })} /></label>
        <div className="adm-two"><label>Icon (stored value)<input value={bf.emoji || ''} onChange={(e) => setBf({ ...bf, emoji: e.target.value })} /></label><label>Button text<input value={bf.cta_label || ''} onChange={(e) => setBf({ ...bf, cta_label: e.target.value })} /></label></div>
        <label>Gradient colours (two hex, comma separated)<input value={bf.gradient || ''} onChange={(e) => setBf({ ...bf, gradient: e.target.value })} /></label>
        <div className="adm-two"><label>Opens category (slug)<input value={bf.target_category_slug || ''} onChange={(e) => setBf({ ...bf, target_category_slug: e.target.value })} placeholder="electrician" /></label><label>Coupon to copy<input value={bf.coupon_code || ''} onChange={(e) => setBf({ ...bf, coupon_code: e.target.value.toUpperCase() })} /></label></div>
        <div className="adm-two"><label>Order<input type="number" value={bf.display_order} onChange={(e) => setBf({ ...bf, display_order: e.target.value })} /></label><label className="chk"><input type="checkbox" checked={!!bf.is_active} onChange={(e) => setBf({ ...bf, is_active: e.target.checked })} /> Active</label></div>
        <button className="adm-btn" disabled={bf.title.trim().length < 2} onClick={saveB}>Save banner</button></div>}</Sheet>
    </div>
  );
}

/* ------------------------------------------------ Broadcast ------------------------------------------------ */
export function NotifyPage() {
  const toast = useToast(); const [f, setF] = useState({ title: '', body: '', audience: 'ALL' }); const [hist, loadH] = useLoad(adminApi.broadcasts); const [busy, setBusy] = useState(false);
  const send = async () => { if (!window.confirm(`Send this notification to ${f.audience.toLowerCase()}?`)) return; setBusy(true); try { const r = await adminApi.broadcast(f); toast(`Sent to ${r.recipients} users`, 'ok'); setF({ title: '', body: '', audience: 'ALL' }); loadH(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  return (
    <div className="adm-cols">
      <Card title="Send a notification"><div className="adm-form">
        <label>Audience<select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="ALL">Everyone</option><option value="CUSTOMERS">Customers</option><option value="PROVIDERS">Providers</option><option value="ADMINS">Staff</option></select></label>
        <label>Title<input maxLength={160} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label><label>Message<textarea rows="4" maxLength={500} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
        <button className="adm-btn" disabled={busy || f.title.trim().length < 3 || f.body.trim().length < 3} onClick={send}>Send now</button><p className="muted small">Appears in each user’s notification bell within seconds.</p></div></Card>
      <Card title="Recent broadcasts">{!hist ? <Spinner /> : hist.length === 0 ? <p className="muted">Nothing sent yet.</p> : hist.map((h) => <div className="list-col" key={h.id}><b>{h.title}</b><span>{h.body}</span><small>{h.audience} · {h.recipients} recipients · {h.sender || 'system'} · {timeAgo(h.created_at)}</small></div>)}</Card>
    </div>
  );
}

/* ------------------------------------------------ Emergencies ------------------------------------------------ */
export function EmergenciesPage({ can }) {
  const toast = useToast(); const [rows, load] = useLoad(adminApi.emergencies);
  const set = async (id, s) => { try { await adminApi.emergencyStatus(id, s); toast('Updated; customer notified', 'ok'); load(); } catch (e) { toast(e.message, 'err'); } };
  if (!rows) return <Spinner />;
  if (!rows.length) return <Empty icon={<CircleCheck size={26} aria-hidden="true" />} title="No emergency requests" />;
  return <Card className="flush"><div className="table-wrap"><table className="adm-table"><thead><tr><th>Code</th><th>Type</th><th>Customer</th><th>Where</th><th>Status</th><th>Raised</th><th /></tr></thead><tbody>
    {rows.map((e) => <tr key={e.id}><td><b>{e.public_code}</b></td><td>{e.emergency_type}<small>{e.description}</small></td><td>{e.customer_name}<small><a href={`tel:${e.contact_phone}`}>{e.contact_phone}</a></small></td><td>{e.address}</td><td><span className={`badge ${e.status === 'RECEIVED' ? 'red' : e.status === 'IN_PROGRESS' ? 'amber' : 'green'}`}>{e.status}</span></td><td>{timeAgo(e.created_at)}</td>
      <td>{can('BOOKING_MANAGE') && <select value="" onChange={(x) => x.target.value && set(e.id, x.target.value)}><option value="">Update…</option>{['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CLOSED'].map((s) => <option key={s}>{s}</option>)}</select>}</td></tr>)}</tbody></table></div></Card>;
}

/* ------------------------------------------------ Security & audit ------------------------------------------------ */
export function SecurityPage({ can }) {
  const toast = useToast(); const [page, setPage] = useState(0); const [filter, setFilter] = useState(''); const [audit, loadA] = useLoad(() => adminApi.audit({ page, size: 25, action: filter }), [page]); const [logins] = useLoad(adminApi.logins); const [sessions, loadS] = useLoad(() => (can('STAFF_MANAGE') ? adminApi.sessions() : Promise.resolve([])));
  const revoke = async (id) => { try { await adminApi.revokeSession(id); toast('Session revoked', 'ok'); loadS(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div className="adm-stack">
      {can('STAFF_MANAGE') && <Card title="Active admin sessions" className="flush">{!sessions ? <Spinner /> : <div className="table-wrap"><table className="adm-table"><thead><tr><th>Staff</th><th>IP</th><th>Device</th><th>Signed in</th><th>Last seen</th><th /></tr></thead><tbody>
        {sessions.map((s) => <tr key={s.id}><td><b>{s.full_name}</b><small>{s.role} · {s.phone}</small></td><td>{s.ip_address}</td><td className="ua">{s.user_agent}</td><td>{dateTime(s.created_at)}</td><td>{timeAgo(s.last_seen_at)}</td><td><button className="adm-btn sm danger-o" onClick={() => revoke(s.id)}>Revoke</button></td></tr>)}</tbody></table></div>}</Card>}
      <Card title="Recent admin sign-in attempts" className="flush">{!logins ? <Spinner /> : <div className="table-wrap"><table className="adm-table"><thead><tr><th>When</th><th>Identifier</th><th>IP</th><th>Result</th></tr></thead><tbody>
        {logins.map((l, i) => <tr key={i}><td>{dateTime(l.created_at)}</td><td>{l.identifier}</td><td>{l.ip_address}</td><td>{l.success ? <span className="badge green">success</span> : <span className="badge red">{l.reason || 'failed'}</span>}</td></tr>)}</tbody></table></div>}</Card>
      <Card title="Audit log" action={<form onSubmit={(e) => { e.preventDefault(); setPage(0); loadA(); }}><input className="mini" placeholder="Filter action…" value={filter} onChange={(e) => setFilter(e.target.value)} /></form>} className="flush">
        {!audit ? <Spinner /> : <><div className="table-wrap"><table className="adm-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Detail</th><th>IP</th></tr></thead><tbody>
          {audit.items.map((a) => <tr key={a.id}><td>{dateTime(a.created_at)}</td><td>{a.actor || 'system'}<small>{a.actor_phone}</small></td><td><b>{a.action}</b></td><td>{a.entity_type} {a.entity_id}</td><td className="wrap">{a.detail}</td><td>{a.ip_address}</td></tr>)}</tbody></table></div>
          <div className="adm-pager"><span>Page {page + 1}</span><div><button disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={15} aria-hidden="true" /> Prev</button><button disabled={audit.items.length < 25} onClick={() => setPage(page + 1)}>Next <ChevronRight size={15} aria-hidden="true" /></button></div></div></>}</Card>
    </div>
  );
}

/* ------------------------------------------------ Settings ------------------------------------------------ */
export function SettingsPage({ can }) {
  const toast = useToast(); const [s, load] = useLoad(adminApi.settings); const [plans, loadP] = useLoad(adminApi.plans); const [vals, setVals] = useState({});
  const flag = async (k, v) => { try { await adminApi.setFlag(k, v); toast(`${k} ${v ? 'enabled' : 'disabled'}`, 'ok'); load(); } catch (e) { toast(e.message, 'err'); } };
  const save = async (k) => { try { await adminApi.setSetting(k, vals[k]); toast('Saved', 'ok'); setVals((x) => { const n = { ...x }; delete n[k]; return n; }); load(); } catch (e) { toast(e.message, 'err'); } };
  const savePlan = async (p) => { try { await adminApi.savePlan(p.id, { price: Number(p.price), features: p.features, active: !!p.active }); toast('Plan saved', 'ok'); loadP(); } catch (e) { toast(e.message, 'err'); } };
  const [edits, setEdits] = useState({});
  if (!s || !plans) return <Spinner />;
  return (
    <div className="adm-stack">
      <Card title="Feature flags (city rollout switches)">{s.flags.map((f) => <div className="list-row" key={f.flag_key}><div><b>{f.flag_key}</b><small>{f.description}</small></div><label className="switch-sm"><input type="checkbox" checked={!!f.is_enabled} onChange={(e) => flag(f.flag_key, e.target.checked)} /><span /></label></div>)}</Card>
      <Card title="System settings">{s.settings.map((x) => <div className="list-row" key={x.setting_key}><div><b>{x.setting_key}</b><small>{x.description}</small></div><div className="inline"><input value={vals[x.setting_key] ?? x.setting_value} onChange={(e) => setVals({ ...vals, [x.setting_key]: e.target.value })} />{vals[x.setting_key] !== undefined && vals[x.setting_key] !== x.setting_value && <button className="adm-btn sm" onClick={() => save(x.setting_key)}>Save</button>}</div></div>)}</Card>
      <Card title="Provider subscription plans" className="flush"><div className="table-wrap"><table className="adm-table"><thead><tr><th>Plan</th><th>Price / month (₹)</th><th>Features</th><th>Subscribers</th><th>Active</th><th /></tr></thead><tbody>
        {plans.map((p) => { const e = edits[p.id] || p; return <tr key={p.id}><td><b>{p.name}</b></td><td><input className="mini" type="number" value={e.price} onChange={(x) => setEdits({ ...edits, [p.id]: { ...e, price: x.target.value } })} /></td><td><input value={e.features || ''} onChange={(x) => setEdits({ ...edits, [p.id]: { ...e, features: x.target.value } })} /></td><td>{p.subscribers}</td>
          <td><input type="checkbox" checked={!!e.active} onChange={(x) => setEdits({ ...edits, [p.id]: { ...e, active: x.target.checked } })} /></td><td>{edits[p.id] && <button className="adm-btn sm" onClick={() => savePlan(edits[p.id])}>Save</button>}</td></tr>; })}</tbody></table></div></Card>
    </div>
  );
}
