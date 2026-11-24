import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/track.css';

// Leaflet + OpenStreetMap tiles (free). Markers are CSS/emoji divIcons, so no image assets are needed.
const pin = (html, cls) => L.divIcon({ className: `trk-pin ${cls}`, html: `<span>${html}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] });
const PARTNER_ICON = pin('🛵', 'partner');
const HOME_ICON = pin('🏠', 'home');

function glide(marker, to, state, ms = 1400) {
  const from = marker.getLatLng();
  cancelAnimationFrame(state.raf);
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms), e = k * (2 - k);
    marker.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]);
    if (k < 1) state.raf = requestAnimationFrame(step);
  };
  state.raf = requestAnimationFrame(step);
}

/** props: dest {lat,lng}, provider {lat,lng}, route [[lat,lng],...] */
export default function TrackMap({ dest, provider, route }) {
  const el = useRef(null);
  const st = useRef({ fitted: false, raf: 0 });

  useEffect(() => {
    const map = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([dest?.lat ?? provider?.lat ?? 26.85, dest?.lng ?? provider?.lng ?? 80.95], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    st.current.map = map;
    const fix = setTimeout(() => map.invalidateSize(), 120);
    return () => { clearTimeout(fix); cancelAnimationFrame(st.current.raf); map.remove(); st.current = { fitted: false, raf: 0 }; };
  }, []); // eslint-disable-line

  // destination marker
  useEffect(() => {
    const s = st.current; if (!s.map || !dest) return;
    if (!s.home) s.home = L.marker([dest.lat, dest.lng], { icon: HOME_ICON, keyboard: false, zIndexOffset: 400 }).addTo(s.map);
    else s.home.setLatLng([dest.lat, dest.lng]);
  }, [dest?.lat, dest?.lng]); // eslint-disable-line

  // route line (orange, like Swiggy / Zomato)
  useEffect(() => {
    const s = st.current; if (!s.map) return;
    if (!route || route.length < 2) { if (s.line) { s.line.remove(); s.line = null; } return; }
    if (!s.line) s.line = L.polyline(route, { color: '#F47A16', weight: 5, opacity: 0.95, lineJoin: 'round' }).addTo(s.map);
    else s.line.setLatLngs(route);
  }, [route]);

  // partner marker: glide to every new position, fit the map the first time, then keep the partner in view
  useEffect(() => {
    const s = st.current; if (!s.map || !provider) return;
    const to = [provider.lat, provider.lng];
    if (!s.partner) s.partner = L.marker(to, { icon: PARTNER_ICON, keyboard: false, zIndexOffset: 800 }).addTo(s.map);
    else glide(s.partner, to, s);
    if (!s.fitted) {
      s.fitted = true;
      const pts = [to]; if (dest) pts.push([dest.lat, dest.lng]);
      if (pts.length > 1) s.map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 17 }); else s.map.setView(to, 16);
    } else if (!s.map.getBounds().pad(-0.1).contains(to)) s.map.panTo(to, { animate: true });
  }, [provider?.lat, provider?.lng]); // eslint-disable-line

  return <div className="trk-map" ref={el} role="img" aria-label="Live map" />;
}
