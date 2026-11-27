import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Maximize2, Minimize2, Minus, Navigation, Plus, Route as RouteIcon } from 'lucide-react';
import { loadLibrary, mapsAuthFailed, mapsConfigured, MAP_ID } from './maps/googleMaps.js';
import { useT } from './ui.jsx';
import '../styles/track.css';

const el = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };

/**
 * Google Map for live tracking. ONE map instance for the lifetime of the screen: updates only move markers / replace the polyline,
 * so a GPS update never reloads the map (no extra map loads billed, no flicker, the user's zoom is respected).
 *
 * props
 *   dest      {lat,lng}                   customer's address (home pin)
 *   provider  {lat,lng,heading,updatedAt} partner position; the marker glides to every new fix
 *   route     [[lat,lng],...]             polyline (orange)
 *   gpsMs     expected gap between fixes, used to pace the glide
 *   stale     true -> marker is greyed (last known position)
 *   height    css height
 */
export default function TrackMap({ dest, provider, route, gpsMs = 10000, stale = false, height }) {
  const t = useT();
  const host = useRef(null); const wrap = useRef(null);
  const st = useRef({ raf: 0, lastAt: 0, fitted: false, follow: true });
  const [ready, setReady] = useState(false); const [err, setErr] = useState(null);
  const [follow, setFollow] = useState(true); const [full, setFull] = useState(false);

  // ---- create the map once ----
  useEffect(() => {
    let dead = false; const s = st.current;
    if (!mapsConfigured()) { setErr('NO_KEY'); return undefined; }
    (async () => {
      try {
        const { Map, Polyline } = await loadLibrary('maps'); const { AdvancedMarkerElement } = await loadLibrary('marker');
        if (dead || !host.current) return;
        const c = dest || provider || { lat: 26.85, lng: 80.95 };
        s.map = new Map(host.current, { center: { lat: c.lat, lng: c.lng }, zoom: 15, mapId: MAP_ID, disableDefaultUI: true, gestureHandling: 'greedy', clickableIcons: false, keyboardShortcuts: false });
        s.Marker = AdvancedMarkerElement; s.Polyline = Polyline;
        s.map.addListener('dragstart', () => { s.follow = false; setFollow(false); });   // the user took control of the camera
        if (mapsAuthFailed()) throw new Error('auth');
        setReady(true);
      } catch (e) { if (!dead) setErr(mapsAuthFailed() ? 'AUTH' : 'LOAD'); }
    })();
    const onAuth = () => setErr('AUTH'); window.addEventListener('dialoo-maps-auth-failed', onAuth);
    return () => {
      dead = true; cancelAnimationFrame(s.raf); window.removeEventListener('dialoo-maps-auth-failed', onAuth);
      if (s.home) s.home.map = null; if (s.partner) s.partner.map = null; if (s.line) s.line.setMap(null);
      st.current = { raf: 0, lastAt: 0, fitted: false, follow: true };
    };
  }, []); // eslint-disable-line

  // ---- destination marker ----
  useEffect(() => {
    const s = st.current; if (!ready || !dest) return;
    if (!s.home) s.home = new s.Marker({ map: s.map, position: dest, content: el('trk-pin home', '<span>🏠</span>'), zIndex: 400, title: t('Your address', 'आपका पता') });
    else s.home.position = dest;
  }, [ready, dest?.lat, dest?.lng]); // eslint-disable-line

  // ---- route line ----
  useEffect(() => {
    const s = st.current; if (!ready) return;
    const path = (route || []).map(([lat, lng]) => ({ lat, lng }));
    if (path.length < 2) { if (s.line) { s.line.setMap(null); s.line = null; } return; }
    if (!s.line) s.line = new s.Polyline({ map: s.map, path, strokeColor: '#F47A16', strokeOpacity: 0.95, strokeWeight: 5, geodesic: true });
    else s.line.setPath(path);
  }, [ready, route]);

  const fit = useCallback(() => {
    const s = st.current; if (!s.map || !window.google) return;
    const b = new window.google.maps.LatLngBounds(); let n = 0;
    if (provider) { b.extend({ lat: provider.lat, lng: provider.lng }); n++; }
    if (dest) { b.extend({ lat: dest.lat, lng: dest.lng }); n++; }
    if (n > 1) s.map.fitBounds(b, 56); else if (n === 1) { s.map.setCenter(provider ? { lat: provider.lat, lng: provider.lng } : dest); s.map.setZoom(16); }
  }, [provider?.lat, provider?.lng, dest?.lat, dest?.lng]); // eslint-disable-line

  // ---- partner marker: glide between fixes, never recreate ----
  useEffect(() => {
    const s = st.current; if (!ready || !provider) return;
    const to = { lat: provider.lat, lng: provider.lng }, now = performance.now();
    if (!s.partner) {
      const node = el('trk-pin partner', '<i class="arrow"></i><span>🛵</span>');
      s.partnerNode = node; s.cur = to;
      s.partner = new s.Marker({ map: s.map, position: to, content: node, zIndex: 800, title: t('Dialoo Partner', 'Dialoo पार्टनर') });
    } else {
      const from = s.cur || to, ms = Math.max(800, Math.min(now - (s.lastAt || now - gpsMs), gpsMs * 1.2));
      cancelAnimationFrame(s.raf);
      const t0 = now;
      const step = (tn) => {
        const k = Math.min(1, (tn - t0) / ms);
        s.cur = { lat: from.lat + (to.lat - from.lat) * k, lng: from.lng + (to.lng - from.lng) * k };
        s.partner.position = s.cur;
        if (k < 1) s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    }
    s.lastAt = now;
    if (s.partnerNode) {
      const arrow = s.partnerNode.querySelector('.arrow');
      if (arrow && provider.heading != null) { arrow.style.display = 'block'; arrow.style.transform = `rotate(${provider.heading}deg)`; }
      s.partnerNode.classList.toggle('stale', !!stale);
    }
    if (!s.fitted) { s.fitted = true; fit(); }
    else if (s.follow) {
      const b = s.map.getBounds();
      if (!b || !b.contains(to)) s.map.panTo(to);   // pan only when the partner leaves the view: no constant camera movement
    }
  }, [ready, provider?.lat, provider?.lng, provider?.heading, stale]); // eslint-disable-line

  const toggleFollow = () => { const v = !st.current.follow; st.current.follow = v; setFollow(v); if (v && provider) st.current.map.panTo({ lat: provider.lat, lng: provider.lng }); };
  const zoom = (d) => { const m = st.current.map; if (m) m.setZoom((m.getZoom() || 15) + d); };
  const toggleFull = () => setFull((f) => !f);
  useEffect(() => { const m = st.current.map; if (m && window.google) setTimeout(() => window.google.maps.event.trigger(m, 'resize'), 120); }, [full]);

  if (err) {
    const msg = err === 'NO_KEY' ? t('Map is not configured yet. Live distance and arrival time still update below.', 'मैप अभी सेट नहीं है। नीचे दूरी और पहुँचने का समय फिर भी अपडेट होगा।')
      : err === 'AUTH' ? t('Map could not be shown (map key problem). Live distance and arrival time still update below.', 'मैप नहीं दिख सका (मैप कुंजी की समस्या)। नीचे दूरी और समय अपडेट होता रहेगा।')
        : t('Map could not load. Check your internet. Live distance and time still update below.', 'मैप लोड नहीं हुआ। इंटरनेट जाँचें। नीचे दूरी और समय अपडेट होता रहेगा।');
    return <div className="trk-map trk-map-off" style={height ? { height } : undefined} role="status">{msg}</div>;
  }
  return (
    <div className={`trk-mapwrap ${full ? 'full' : ''}`} ref={wrap}>
      <div className="trk-map" ref={host} style={!full && height ? { height } : undefined} role="img" aria-label={t('Live map', 'लाइव मैप')} />
      <div className="trk-ctl" role="group" aria-label={t('Map controls', 'मैप कंट्रोल')}>
        <button type="button" onClick={() => zoom(1)} aria-label={t('Zoom in', 'ज़ूम इन')}><Plus size={18} aria-hidden="true" /></button>
        <button type="button" onClick={() => zoom(-1)} aria-label={t('Zoom out', 'ज़ूम आउट')}><Minus size={18} aria-hidden="true" /></button>
        <button type="button" onClick={fit} aria-label={t('Show whole route', 'पूरा रूट दिखाएँ')}><RouteIcon size={18} aria-hidden="true" /></button>
        <button type="button" className={follow ? 'on' : ''} onClick={toggleFollow} aria-pressed={follow} aria-label={t('Follow partner', 'पार्टनर को फ़ॉलो करें')}><Navigation size={18} aria-hidden="true" /></button>
        <button type="button" onClick={() => { if (dest) st.current.map.panTo(dest); }} aria-label={t('Centre on address', 'पते पर केंद्रित करें')}><Crosshair size={18} aria-hidden="true" /></button>
        <button type="button" onClick={toggleFull} aria-label={full ? t('Exit full screen', 'फ़ुल स्क्रीन बंद') : t('Full screen', 'फ़ुल स्क्रीन')}>{full ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}</button>
      </div>
    </div>
  );
}
