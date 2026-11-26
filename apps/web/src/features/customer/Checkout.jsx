import React, { useEffect, useRef, useState } from 'react';
import { catalogApi, customerApi } from '../../shared/api.js';
import { go } from '../../shared/router.js';
import { Sheet, money, useT, useToast } from '../../shared/ui.jsx';
import { haptic } from '../../shared/native.js';
import { CalendarClock, Clock, MapPin, TicketPercent, Zap } from 'lucide-react';
import { ProviderAvatar } from '../../shared/parts.jsx';

/** Flipkart-style checkout: pick service, address, time, coupon, see the bill, place booking. */
export default function Checkout({ target, user, loc, onLocate, onClose, onDone }) {
  const t = useT(); const toast = useToast();
  const p = target?.provider;
  const [cat, setCat] = useState(null); const [services, setServices] = useState([]); const [serviceId, setServiceId] = useState(target?.serviceId || '');
  const [addresses, setAddresses] = useState([]); const [address, setAddress] = useState('');
  const [name, setName] = useState(user?.full_name || ''); const [phone, setPhone] = useState(user?.phone || '');
  const [coords, setCoords] = useState(null); const [locBusy, setLocBusy] = useState(false);
  const [when, setWhen] = useState('NOW'); const [slot, setSlot] = useState(''); const [notes, setNotes] = useState(''); const [urgent, setUrgent] = useState(false);
  const [code, setCode] = useState(''); const [coupons, setCoupons] = useState([]); const [bill, setBill] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const timer = useRef();

  useEffect(() => {
    if (!p) return;
    setServiceId(target?.serviceId || ''); setCode(''); setBill(null); setErr(''); setWhen('NOW'); setSlot(''); setNotes('');
    catalogApi.provider(p.id).then((d) => setServices(d.services || [])).catch(() => setServices([]));
    setCoords(null);
    customerApi.addresses().then((a) => { setAddresses(a); const d = a.find((x) => x.is_default) || a[0]; if (d) setAddress(d.address_line); else if (loc?.place?.address) { setAddress(loc.place.address); setCoords(loc.pos || null); } else setAddress(''); }).catch(() => { if (loc?.place?.address) { setAddress(loc.place.address); setCoords(loc.pos || null); } });
    catalogApi.coupons().then(setCoupons).catch(() => {});
    setName(user?.full_name || ''); setPhone(user?.phone || '');
  }, [p?.id]); // eslint-disable-line

  useEffect(() => {
    if (!p) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      customerApi.preview({ providerId: p.id, serviceId: serviceId || null, couponCode: code || null }).then(setBill).catch((e) => setErr(e.message));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [p?.id, serviceId, code]);

  if (!p) return null;
  const useMyLocation = async () => {
    setLocBusy(true); setErr('');
    try { const r = await onLocate(); if (r?.place?.address) setAddress(r.place.address); setCoords(r?.pos || null); if (!r?.place?.address) setErr(t('Got your GPS spot, but could not read the street address. Please type it.', 'GPS मिल गया पर पता नहीं पढ़ पाए। कृपया पता लिखें।')); }
    catch { /* toast shown by onLocate */ } finally { setLocBusy(false); }
  };
  const place = async () => {
    setErr('');
    if (address.trim().length < 6) return setErr(t('Please enter your full address.', 'कृपया पूरा पता लिखें।'));
    if (when === 'LATER' && !slot) return setErr(t('Choose a date and time.', 'तारीख और समय चुनें।'));
    if (when === 'LATER' && new Date(slot) < new Date()) return setErr(t('Choose a future time.', 'भविष्य का समय चुनें।'));
    setBusy(true);
    try {
      const b = await customerApi.book({
        providerId: p.id, serviceId: serviceId || null, serviceAddress: address.trim(), description: notes.trim() || null,
        scheduledAt: when === 'LATER' ? slot : null, urgency: urgent || when === 'NOW' ? 'URGENT' : 'NORMAL',
        couponCode: bill?.couponApplied ? code.trim().toUpperCase() : null, contactName: name, contactPhone: phone,
        latitude: coords?.lat ?? null, longitude: coords?.lng ?? null,
      });
      haptic('medium'); toast(t('Booking placed! Waiting for the Dialoo Partner to accept.', 'बुकिंग हो गई! Dialoo पार्टनर के स्वीकार करने का इंतज़ार।'), 'ok');
      onDone?.(); onClose(); go(`/booking/${b.id}`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!p} onClose={onClose} title={t('Confirm booking', 'बुकिंग कन्फ़र्म करें')}>
      <div className="co-provider"><ProviderAvatar p={p} /><div><b>{p.business_name}</b><span className="muted">{p.category} · <Clock size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> ~{p.eta_minutes || 45} {t('min', 'मिनट')}</span></div></div>

      {services.length > 0 && (
        <div className="field"><label>{t('Select service', 'सर्विस चुनें')}</label>
          <div className="radio-list">
            <label className={`radio ${serviceId === '' ? 'on' : ''}`}><input type="radio" checked={serviceId === ''} onChange={() => setServiceId('')} /><span>{t('General visit / not sure', 'सामान्य विज़िट / पता नहीं')}</span><b>{money(p.price_from)}</b></label>
            {services.map((s) => <label key={s.id} className={`radio ${String(serviceId) === String(s.id) ? 'on' : ''}`}><input type="radio" checked={String(serviceId) === String(s.id)} onChange={() => setServiceId(s.id)} /><span>{s.name}</span><b>{money(s.price)}</b></label>)}
          </div>
        </div>
      )}

      <div className="field"><label htmlFor="co-addr">{t('Service address', 'सर्विस का पता')}</label>
        {addresses.length > 0 && <div className="chip-row scroll">{addresses.map((a) => <button type="button" key={a.id} className={`chip ${address === a.address_line ? 'on' : ''}`} onClick={() => setAddress(a.address_line)}>{a.label}</button>)}</div>}
        <button type="button" className="chip locate-chip" disabled={locBusy} onClick={useMyLocation}><MapPin size={15} aria-hidden="true" /> {locBusy ? t('Detecting…', 'पता लगा रहे हैं…') : t('Use current location', 'मौजूदा लोकेशन')}</button>
        <textarea id="co-addr" rows="2" value={address} onChange={(e) => { setAddress(e.target.value); setCoords(null); }} placeholder={t('House no, street, landmark, area', 'मकान नं., गली, लैंडमार्क, इलाका')} />
      </div>
      <div className="two">
        <div className="field"><label>{t('Contact name', 'संपर्क नाम')}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>{t('Phone', 'फ़ोन')}</label><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>

      <div className="field"><label>{t('When do you need it?', 'कब चाहिए?')}</label>
        <div className="seg"><button type="button" className={when === 'NOW' ? 'on' : ''} onClick={() => setWhen('NOW')}><Zap size={15} aria-hidden="true" />{t('Now', 'अभी')}</button><button type="button" className={when === 'LATER' ? 'on' : ''} onClick={() => setWhen('LATER')}><CalendarClock size={15} aria-hidden="true" />{t('Schedule', 'शेड्यूल')}</button></div>
        {when === 'LATER' && <input type="datetime-local" value={slot} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={(e) => setSlot(e.target.value)} />}
      </div>
      <div className="field"><label>{t('Notes for Dialoo Partner (optional)', 'Dialoo पार्टनर के लिए नोट (वैकल्पिक)')}</label><textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Describe the problem', 'समस्या बताएँ')} /></div>

      <div className="field"><label>{t('Coupon', 'कूपन')}</label>
        <div className="coupon-box"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME50" maxLength={30} /></div>
        {coupons.length > 0 && <div className="chip-row scroll">{coupons.slice(0, 4).map((c) => <button type="button" key={c.code} className={`chip ${code === c.code ? 'on' : ''}`} onClick={() => setCode(code === c.code ? '' : c.code)}><TicketPercent size={14} aria-hidden="true" />{c.code}</button>)}</div>}
        {bill?.couponMessage && <p className={bill.couponApplied ? 'ok' : 'error'}>{bill.couponMessage}</p>}
      </div>

      {bill && (
        <div className="bill">
          <div><span>{t('Service charge', 'सर्विस चार्ज')}</span><span>{money(bill.serviceAmount)}</span></div>
          <div><span>{t('Visit & platform fee', 'विज़िट व प्लेटफ़ॉर्म फ़ीस')}</span><span>{money(bill.visitFee)}</span></div>
          <div><span>{t('Taxes', 'टैक्स')}</span><span>{money(bill.taxAmount)}</span></div>
          {Number(bill.discount) > 0 && <div className="save"><span>{t('Coupon discount', 'कूपन छूट')}</span><span>− {money(bill.discount)}</span></div>}
          <div className="total"><span>{t('To pay after service', 'सर्विस के बाद देय')}</span><span>{money(bill.total)}</span></div>
          <p className="muted small">{t('Final amount may change if extra work or material is needed — agree with the Dialoo Partner first.', 'अतिरिक्त काम/सामान होने पर अंतिम राशि बदल सकती है — पहले Dialoo पार्टनर से सहमति लें।')}</p>
        </div>
      )}
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary block" disabled={busy || !bill} onClick={place}>{busy ? t('Placing…', 'बुक हो रही है…') : `${t('Place booking', 'बुकिंग करें')} · ${bill ? money(bill.total) : ''}`}</button>
    </Sheet>
  );
}
