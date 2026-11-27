import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Home, Briefcase, Clock, LocateFixed, MapPin, Search } from 'lucide-react';
import { customerApi, geoApi } from './api.js';
import { getPosition } from './native.js';
import { loadLibrary, mapsConfigured, MAP_ID } from './maps/googleMaps.js';
import { useT, useToast } from './ui.jsx';
import '../styles/locpicker.css';

const RECENT_KEY = 'dialoo-recent-locs';
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } };
const saveRecent = (r) => { try { const list = [r, ...readRecent().filter((x) => x.address !== r.address)].slice(0, 5); localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* ignore */ } };
const FIELDS = ['houseNo', 'building', 'landmark', 'locality', 'city', 'district', 'state', 'pincode', 'country'];
const compose = (f) => [f.houseNo, f.building, f.landmark, f.locality, f.city, f.state && f.pincode ? `${f.state} - ${f.pincode}` : (f.state || f.pincode)].filter((x) => x && String(x).trim()).join(', ').slice(0, 255);
const moved = (a, b) => !a || !b || Math.hypot((a.lat - b.lat) * 111000, (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180)) > 30;

/**
 * Smart location selector (Swiggy / Uber style): search with Google Places Autocomplete (New), fixed centre pin over a draggable map,
 * "use current location", saved + recent addresses, structured address fields and a Home / Office / Other label.
 *
 * Cost control: autocomplete is debounced (400 ms by default, server-configurable), needs >= 3 characters and uses ONE session token
 * per search (a new token after a place is chosen); only the "location" field of a chosen place is requested; reverse geocoding
 * (through our server, capped + cached) runs once when the map becomes idle after the user moved it, never while it is moving.
 * props: initial {lat,lng}, saved [], debounceMs, onConfirm(result), canSave
 */
export default function LocationPicker({ initial, saved = [], debounceMs = 400, onConfirm, canSave = true }) {
  const t = useT(); const toast = useToast();
  const mapEl = useRef(null); const S = useRef({ interacted: false, lastRev: null, token: null, seq: 0 });
  const [ready, setReady] = useState(false); const [noMap, setNoMap] = useState(!mapsConfigured());
  const [center, setCenter] = useState(initial || null); const [busy, setBusy] = useState(false);
  const [q, setQ] = useState(''); const [sugs, setSugs] = useState([]); const [searching, setSearching] = useState(false);
  const [f, setF] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, '']))); const [placeId, setPlaceId] = useState(null); const [cityId, setCityId] = useState(null); const [serviceable, setServiceable] = useState(true);
  const [label, setLabel] = useState('HOME'); const [save, setSave] = useState(false); const [recent] = useState(readRecent);
  const [err, setErr] = useState('');

  const applyPlace = useCallback((p) => {
    setPlaceId(p.placeId || null); setCityId(p.cityId || null); setServiceable(p.serviceable !== false);
    setF((cur) => ({ ...cur, locality: p.locality || '', city: p.city || p.cityName || '', district: p.district || '', state: p.state || '', pincode: p.pincode || '', country: p.country || (p.cityName ? 'India' : '') }));
  }, []);

  const reverse = useCallback(async (pos) => {
    const my = ++S.current.seq; setBusy(true); setErr('');
    try { const p = await geoApi.reverse(pos.lat, pos.lng); if (my === S.current.seq) { S.current.lastRev = pos; applyPlace(p); } }
    catch { if (my === S.current.seq) setErr(t('Could not read the address for this spot. You can type it below.', 'इस जगह का पता नहीं मिला। नीचे खुद लिख सकते हैं।')); }
    finally { if (my === S.current.seq) setBusy(false); }
  }, [applyPlace]); // eslint-disable-line

  // ---- map: one instance; reverse geocode only when it goes idle after the user moved it ----
  useEffect(() => {
    if (noMap) return undefined;
    let dead = false; let map = null;
    (async () => {
      try {
        const { Map } = await loadLibrary('maps');
        if (dead || !mapEl.current) return;
        const c = initial || { lat: 26.85, lng: 80.95 };
        map = new Map(mapEl.current, { center: c, zoom: initial ? 17 : 12, mapId: MAP_ID, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false });
        S.current.map = map;
        map.addListener('dragstart', () => { S.current.interacted = true; });
        map.addListener('zoom_changed', () => { S.current.interacted = true; });
        map.addListener('idle', () => {
          const m = map.getCenter(); const pos = { lat: m.lat(), lng: m.lng() };
          setCenter(pos);
          if (S.current.interacted && moved(S.current.lastRev, pos)) { S.current.interacted = false; reverse(pos); }
        });
        setReady(true);
        if (initial) reverse(initial);
      } catch { if (!dead) setNoMap(true); }
    })();
    return () => { dead = true; };
  }, []); // eslint-disable-line

  const goTo = useCallback((pos, zoom = 17) => {
    setCenter(pos);
    const m = S.current.map;
    if (m) { S.current.interacted = true; m.setZoom(zoom); m.panTo(pos); } else reverse(pos);
  }, [reverse]);

  // ---- Places Autocomplete (New): debounced, session token ----
  useEffect(() => {
    if (noMap || q.trim().length < 3) { setSugs([]); return undefined; }
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = await loadLibrary('places');
        if (!S.current.token) S.current.token = new AutocompleteSessionToken();
        const req = { input: q.trim(), sessionToken: S.current.token, includedRegionCodes: ['in'], language: document.documentElement.lang === 'hi' ? 'hi' : 'en' };
        if (center) req.locationBias = { center, radius: 30000 };
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
        setSugs((suggestions || []).filter((s) => s.placePrediction).slice(0, 6).map((s) => ({ text: s.placePrediction.text.toString(), main: s.placePrediction.mainText?.toString(), sub: s.placePrediction.secondaryText?.toString(), pred: s.placePrediction })));
      } catch { setSugs([]); } finally { setSearching(false); }
    }, debounceMs);
    return () => clearTimeout(id);
  }, [q, noMap]); // eslint-disable-line

  const choose = async (s) => {
    setSugs([]); setQ(s.text);
    try {
      const place = s.pred.toPlace(); await place.fetchFields({ fields: ['location'] });   // only the location: cheapest Place Details tier
      S.current.token = null;                                                               // the session ends with the selection
      goTo({ lat: place.location.lat(), lng: place.location.lng() });
    } catch { toast(t('Could not open that place. Try another.', 'यह जगह नहीं खुली। दूसरी चुनें।'), 'err'); }
  };

  const useCurrent = async () => {
    setBusy(true); setErr('');
    try { const p = await getPosition(); goTo({ lat: p.lat, lng: p.lng }); }
    catch (e) { setBusy(false); setErr(e.code === 'DENIED' ? t('Location is off. Turn it on in settings, or search / pick on the map.', 'लोकेशन बंद है। सेटिंग्स में चालू करें, या खोजें / मैप पर चुनें।') : t('Could not get your location. Try again outdoors.', 'लोकेशन नहीं मिली। बाहर खुले में फिर कोशिश करें।')); }
  };

  const pickSaved = (a) => {
    if (a.latitude != null) goTo({ lat: Number(a.latitude), lng: Number(a.longitude) });
    setF((cur) => ({ ...cur, houseNo: a.house_no || '', building: a.building || '', landmark: a.landmark || '', locality: a.locality || '', district: a.district || '', state: a.state || '', pincode: a.pincode || '', country: a.country || cur.country }));
    setPlaceId(a.place_id || null); if (a.label) setLabel(['HOME', 'OFFICE'].includes(a.label) ? a.label : 'OTHER');
  };

  const confirm = async () => {
    const address = compose(f) || '';
    if (!center) return setErr(t('Choose a location first.', 'पहले लोकेशन चुनें।'));
    if (address.length < 6) return setErr(t('Please complete the address (area, city).', 'कृपया पता पूरा करें (इलाका, शहर)।'));
    const res = { lat: center.lat, lng: center.lng, address, placeId, cityId, serviceable, label, fields: f, place: { address, locality: f.locality, pincode: f.pincode, cityId, serviceable, cityName: f.city } };
    if (save && canSave) {
      try { await customerApi.addAddress({ label, addressLine: address, isDefault: false, latitude: center.lat, longitude: center.lng, placeId, houseNo: f.houseNo, building: f.building, landmark: f.landmark, locality: f.locality, district: f.district, state: f.state, pincode: f.pincode, country: f.country }); }
      catch (e) { toast(e.message, 'err'); }
    }
    saveRecent({ lat: center.lat, lng: center.lng, address, label });
    onConfirm(res);
  };

  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  return (
    <div className="lp">
      {!noMap && (
        <div className="lp-search">
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search area, landmark or address', 'इलाका, लैंडमार्क या पता खोजें')} aria-label={t('Search address', 'पता खोजें')} autoComplete="off" />
          {searching && <span className="lp-spin" aria-hidden="true" />}
          {sugs.length > 0 && <ul className="lp-sugs" role="listbox">{sugs.map((s, i) => <li key={i} role="option"><button type="button" onClick={() => choose(s)}><MapPin size={15} aria-hidden="true" /><span><b>{s.main || s.text}</b><em>{s.sub}</em></span></button></li>)}</ul>}
        </div>
      )}
      {!noMap && <div className="lp-mapwrap"><div className="lp-map" ref={mapEl} role="application" aria-label={t('Move the map to place the pin', 'पिन लगाने के लिए मैप हिलाएँ')} /><div className="lp-pin" aria-hidden="true"><MapPin size={38} fill="var(--orange)" color="#fff" /></div>{!ready && <div className="lp-loading">{t('Loading map…', 'मैप लोड हो रहा है…')}</div>}</div>}
      {noMap && <p className="muted small">{t('Map is not available right now. Use current location or type your address.', 'मैप अभी उपलब्ध नहीं है। मौजूदा लोकेशन इस्तेमाल करें या पता लिखें।')}</p>}
      <button type="button" className="btn outline block locate-btn" onClick={useCurrent} disabled={busy}><LocateFixed size={17} aria-hidden="true" /> {busy ? t('Please wait…', 'कृपया रुकें…') : t('Use my current location', 'मेरी मौजूदा लोकेशन इस्तेमाल करें')}</button>

      {(saved.length > 0 || recent.length > 0) && (
        <div className="chip-row scroll lp-chips">
          {saved.map((a) => <button type="button" key={`s${a.id}`} className="chip" onClick={() => pickSaved(a)}>{a.label === 'OFFICE' ? <Briefcase size={13} aria-hidden="true" /> : <Home size={13} aria-hidden="true" />} {a.label}</button>)}
          {recent.map((r, i) => <button type="button" key={`r${i}`} className="chip" title={r.address} onClick={() => { goTo({ lat: r.lat, lng: r.lng }); }}><Clock size={13} aria-hidden="true" /> {r.address.split(',').slice(0, 2).join(',')}</button>)}
        </div>
      )}
      {err && <p className="error" role="alert">{err}</p>}
      {!serviceable && <p className="error">{t('Dialoo is not in this area yet. You can still save the address.', 'Dialoo अभी इस इलाके में नहीं है। फिर भी पता सेव कर सकते हैं।')}</p>}

      <div className="two"><div className="field"><label>{t('House / Flat no.', 'मकान / फ़्लैट नं.')}</label><input value={f.houseNo} onChange={set('houseNo')} maxLength={60} /></div><div className="field"><label>{t('Building / Street', 'बिल्डिंग / गली')}</label><input value={f.building} onChange={set('building')} maxLength={160} /></div></div>
      <div className="field"><label>{t('Landmark (optional)', 'लैंडमार्क (वैकल्पिक)')}</label><input value={f.landmark} onChange={set('landmark')} maxLength={120} /></div>
      <div className="two"><div className="field"><label>{t('Locality', 'इलाका')}</label><input value={f.locality} onChange={set('locality')} maxLength={120} /></div><div className="field"><label>{t('City', 'शहर')}</label><input value={f.city} onChange={set('city')} maxLength={80} /></div></div>
      <div className="two"><div className="field"><label>{t('District', 'ज़िला')}</label><input value={f.district} onChange={set('district')} maxLength={80} /></div><div className="field"><label>{t('State', 'राज्य')}</label><input value={f.state} onChange={set('state')} maxLength={80} /></div></div>
      <div className="two"><div className="field"><label>{t('PIN code', 'पिन कोड')}</label><input inputMode="numeric" value={f.pincode} onChange={set('pincode')} maxLength={10} /></div><div className="field"><label>{t('Country', 'देश')}</label><input value={f.country} onChange={set('country')} maxLength={60} /></div></div>
      <div className="seg lp-label" role="group" aria-label={t('Address label', 'पते का लेबल')}>{[['HOME', t('Home', 'घर')], ['OFFICE', t('Office', 'ऑफ़िस')], ['OTHER', t('Other', 'अन्य')]].map(([v, l]) => <button type="button" key={v} className={label === v ? 'on' : ''} onClick={() => setLabel(v)}>{l}</button>)}</div>
      {canSave && <label className="lp-save"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> {t('Save this address', 'यह पता सेव करें')}</label>}
      <button type="button" className="btn primary block" onClick={confirm} disabled={busy}>{t('Confirm this location', 'यह लोकेशन कन्फ़र्म करें')}</button>
    </div>
  );
}
