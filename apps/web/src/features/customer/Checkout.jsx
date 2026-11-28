import React, { useEffect, useRef, useState } from 'react';
import { catalogApi, customerApi } from '../../shared/api.js';
import { go } from '../../shared/router.js';
import { Sheet, money, useT, useToast } from '../../shared/ui.jsx';
import { haptic } from '../../shared/native.js';
import AddressForm from '../../shared/AddressForm.jsx';
import { composeAddress, emptyAddress, fromSaved, mergePlace, savePayload, validateAddress } from '../../shared/addressFields.js';
import { CalendarClock, Clock, MapPin, MapPinned, TicketPercent, Zap } from 'lucide-react';
import { ProviderAvatar } from '../../shared/parts.jsx';

/** Flipkart-style checkout: pick service, address, time, coupon, see the bill, place booking. */
export default function Checkout({ target, user, loc, onLocate, onPick, onClose, onDone }) {
  const t = useT(); const toast = useToast();
  const p = target?.provider;
  const [cat, setCat] = useState(null); const [services, setServices] = useState([]); const [serviceId, setServiceId] = useState(target?.serviceId || '');
  const [addresses, setAddresses] = useState([]); const [fields, setFields] = useState(emptyAddress()); const [errs, setErrs] = useState({});
  const [savedId, setSavedId] = useState(null); const [saveMode, setSaveMode] = useState(''); const [saveLabel, setSaveLabel] = useState('HOME'); const [placeId, setPlaceId] = useState(null);
  const address = composeAddress(fields);
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
    setFields(emptyAddress()); setErrs({}); setSavedId(null); setSaveMode(''); setPlaceId(null);
    customerApi.addresses().then((a) => {
      setAddresses(a); const d = a.find((x) => x.is_default) || a[0];
      if (d) chooseSaved(d);
      else if (loc?.place) { setFields((f) => mergePlace(f, loc.place)); setCoords(loc.pos || null); }   // GPS area/PIN only; house no. is always asked
    }).catch(() => {});
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
  const chooseSaved = (a) => { setFields(fromSaved(a)); setCoords(a.latitude != null ? { lat: Number(a.latitude), lng: Number(a.longitude) } : null); setSavedId(a.id); setPlaceId(a.place_id || null); setSaveLabel(a.label || 'HOME'); setSaveMode(''); setErrs({}); };
  const editFields = (v) => { setFields(v); setErrs({}); if (savedId && !saveMode) setSaveMode('update'); };
  const useMyLocation = async () => {
    setLocBusy(true); setErr('');
    try { const r = await onLocate(); if (r?.place) { setFields((f) => mergePlace(f, r.place)); setErrs({}); setPlaceId(r.place.placeId || null); } setCoords(r?.pos || null); if (!r?.place?.address) setErr(t('Got your GPS spot, but could not read the street address. Please type it.', 'GPS मिल गया पर पता नहीं पढ़ पाए। कृपया पता लिखें।')); }
    catch { /* toast shown by onLocate */ } finally { setLocBusy(false); }
  };
  // Opens the map with everything already typed, so a location set earlier can be adjusted (pin moved, fields edited) and confirmed again.
  const pickOnMap = async () => {
    if (!onPick) return;
    const r = await onPick({ forBooking: true, initial: coords, startAt: loc?.pos || null, fields, label: saveLabel });
    if (r) { setFields(r.fields); setCoords(r.pinned ? { lat: r.lat, lng: r.lng } : null); setPlaceId(r.placeId || null); setErrs({}); setErr(''); if (savedId && !saveMode) setSaveMode('update'); }
  };
  const place = async () => {
    setErr('');
    const ve = validateAddress(fields, t); setErrs(ve);
    if (Object.keys(ve).length) return setErr(t('Please fill the fields marked with * in the address.', 'पते में * वाले फ़ील्ड भरें।'));
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
      try {   // optional: keep the address for next time (never blocks the booking)
        if (saveMode === 'new') await customerApi.addAddress(savePayload(fields, saveLabel, coords, placeId));
        else if (saveMode === 'update' && savedId) await customerApi.updateAddress(savedId, { ...savePayload(fields, saveLabel, coords, placeId), isDefault: false });
      } catch { /* ignore */ }
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

      <div className="field"><label>{t('Service address', 'सर्विस का पता')} <span className="req" aria-hidden="true">*</span></label>
        {addresses.length > 0 && <div className="chip-row scroll">{addresses.map((a) => <button type="button" key={a.id} className={`chip ${savedId === a.id ? 'on' : ''}`} onClick={() => chooseSaved(a)}>{a.label}</button>)}</div>}
        <div className="chip-row">
          <button type="button" className="chip locate-chip" disabled={locBusy} onClick={useMyLocation}><MapPin size={15} aria-hidden="true" /> {locBusy ? t('Detecting…', 'पता लगा रहे हैं…') : t('Use current location', 'मौजूदा लोकेशन')}</button>
          {onPick && <button type="button" className="chip locate-chip" onClick={pickOnMap}><MapPinned size={15} aria-hidden="true" /> {coords ? t('Change on map', 'मैप पर बदलें') : t('Set location on map', 'मैप पर लोकेशन सेट करें')}</button>}
        </div>
        {coords
          ? <div className="pin-card ok" role="status"><span>📍 {t('Map pin is set. The partner will navigate to it and you can track arrival.', 'मैप पिन सेट है। पार्टनर इसी पर आएगा और आप उनका आना ट्रैक कर पाएँगे।')}</span>{onPick && <button type="button" className="btn outline sm" onClick={pickOnMap}>{t('Adjust', 'बदलें')}</button>}</div>
          : <div className="pin-card warn" role="status"><span>{t('No map pin yet (optional). Add one so the partner finds you faster and you can track them live.', 'अभी मैप पिन नहीं है (वैकल्पिक)। पिन लगाएँ ताकि पार्टनर जल्दी पहुँचे और आप लाइव ट्रैक कर सकें।')}</span>{onPick && <button type="button" className="btn outline sm" onClick={pickOnMap}>{t('Set pin', 'पिन लगाएँ')}</button>}</div>}
        <AddressForm value={fields} onChange={editFields} errors={errs} />
        <div className="save-addr">
          {savedId
            ? <label><input type="checkbox" checked={saveMode === 'update'} onChange={(e) => setSaveMode(e.target.checked ? 'update' : '')} /> {t('Update this saved address with my changes', 'मेरे बदलावों के साथ यह सेव पता अपडेट करें')}</label>
            : <label><input type="checkbox" checked={saveMode === 'new'} onChange={(e) => setSaveMode(e.target.checked ? 'new' : '')} /> {t('Save this address for next time', 'अगली बार के लिए यह पता सेव करें')}</label>}
          {saveMode && <div className="seg" role="group" aria-label={t('Address label', 'पते का लेबल')}>{[['HOME', t('Home', 'घर')], ['OFFICE', t('Office', 'ऑफ़िस')], ['OTHER', t('Other', 'अन्य')]].map(([v, l]) => <button type="button" key={v} className={saveLabel === v ? 'on' : ''} onClick={() => setSaveLabel(v)}>{l}</button>)}</div>}
        </div>
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
