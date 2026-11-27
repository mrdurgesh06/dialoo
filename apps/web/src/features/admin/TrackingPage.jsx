import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from '../../shared/api.js';
import { loadLibrary, mapsConfigured, MAP_ID } from '../../shared/maps/googleMaps.js';
import { Sheet, Spinner, useToast } from '../../shared/ui.jsx';

const COLORS = { ON_THE_WAY: '#F47A16', AVAILABLE: '#22b573', BUSY: '#6b7280', LOCATION_UNAVAILABLE: '#d92d20' };
const Tile = ({ label, value, warn }) => <div className={`trk-tile ${warn ? 'warn' : ''}`}><b>{value ?? '–'}</b><span>{label}</span></div>;

/**
 * Admin > Live tracking (permission BOOKING_VIEW). Every view is written to the audit log by the server. Lists carry coordinates
 * rounded to ~11 m; the exact current position is only returned for one booking at a time, and no location history is exposed.
 */
export default function TrackingPage() {
  const toast = useToast();
  const [sum, setSum] = useState(null); const [partners, setPartners] = useState(null); const [sessions, setSessions] = useState(null);
  const [f, setF] = useState({ city: '', categoryId: '', state: '', status: '' }); const [detail, setDetail] = useState(null);
  const mapEl = useRef(null); const M = useRef({ markers: [] }); const [mapErr, setMapErr] = useState(!mapsConfigured());

  const load = async () => {
    try {
      const [s, p, ss] = await Promise.all([adminApi.trackingSummary(), adminApi.trackingPartners({ city: f.city, categoryId: f.categoryId, state: f.state }), adminApi.trackingSessions({ city: f.city, categoryId: f.categoryId, status: f.status })]);
      setSum(s); setPartners(p.items); setSessions(ss.items);
    } catch (e) { toast(e.message, 'err'); }
  };
  useEffect(() => { load(); const id = setInterval(() => document.visibilityState === 'visible' && load(), 15000); return () => clearInterval(id); }, [f.city, f.categoryId, f.state, f.status]); // eslint-disable-line

  useEffect(() => {      // one map for the page; markers are replaced, the map is never rebuilt
    if (mapErr) return undefined; let dead = false;
    (async () => {
      try {
        const { Map } = await loadLibrary('maps'); await loadLibrary('marker');
        if (dead || !mapEl.current) return;
        M.current.map = new Map(mapEl.current, { center: { lat: 26.85, lng: 80.95 }, zoom: 7, mapId: MAP_ID, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy' });
        setPartners((p) => (p ? [...p] : p));
      } catch { setMapErr(true); }
    })();
    return () => { dead = true; };
  }, []); // eslint-disable-line

  useEffect(() => {
    const m = M.current; if (!m.map || !partners || !window.google) return;
    m.markers.forEach((x) => { x.map = null; }); m.markers = [];
    const b = new window.google.maps.LatLngBounds(); let n = 0;
    partners.filter((p) => p.lat != null).forEach((p) => {
      const d = document.createElement('div'); d.style.cssText = `width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);background:${COLORS[p.state] || '#999'}`; d.title = `${p.name} · ${p.state}`;
      d.onclick = () => p.bookingId && openDetail(p.bookingId);
      m.markers.push(new window.google.maps.marker.AdvancedMarkerElement({ map: m.map, position: { lat: p.lat, lng: p.lng }, content: d })); b.extend({ lat: p.lat, lng: p.lng }); n++;
    });
    if (n > 1 && !m.fitted) { m.map.fitBounds(b, 48); m.fitted = true; }
  }, [partners]); // eslint-disable-line

  const openDetail = async (id) => { try { setDetail(await adminApi.trackingDetail(id)); } catch (e) { toast(e.message, 'err'); } };
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  return (
    <div className="adm-stack">
      {!sum ? <Spinner /> : (
        <div className="trk-tiles">
          <Tile label="Online partners" value={sum.onlinePartners} /><Tile label="Available" value={sum.availablePartners} />
          <Tile label="Active journeys" value={sum.activeJourneys} /><Tile label="Tracking sessions" value={sum.activeSessions} />
          <Tile label="Arrived (2 h)" value={sum.arrivedLast2h} /><Tile label={`Stale > ${sum.staleAfterSeconds}s`} value={sum.staleConnections} warn={sum.staleConnections > 0} />
        </div>
      )}
      <div className="adm-toolbar">
        <input placeholder="City" value={f.city} onChange={set('city')} />
        <input placeholder="Category id" inputMode="numeric" value={f.categoryId} onChange={set('categoryId')} />
        <select value={f.state} onChange={set('state')} aria-label="Partner state"><option value="">All partner states</option>{Object.keys(COLORS).map((s) => <option key={s}>{s}</option>)}</select>
        <select value={f.status} onChange={set('status')} aria-label="Session status"><option value="">All sessions</option><option>ACTIVE</option><option>ARRIVED</option><option>ENDED</option></select>
        <button className="adm-btn sm" onClick={load}>Refresh</button>
      </div>
      {mapErr ? <p className="muted">Map unavailable (set VITE_GOOGLE_MAPS_API_KEY). Tables below still work.</p> : <div className="trk-adminmap" ref={mapEl} role="img" aria-label="Live partner map" />}
      <p className="muted small">Positions are rounded to about 11 m. Opening a booking shows its exact current position and is recorded in the audit log. Legend: {Object.entries(COLORS).map(([k, c]) => <span key={k} style={{ marginRight: 10 }}><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: c, marginRight: 4 }} />{k}</span>)}</p>
      <h3>Sessions</h3>
      {!sessions ? <Spinner /> : (
        <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Booking</th><th>Partner</th><th>City</th><th>Category</th><th>Session</th><th>Link</th><th>Updated</th><th /></tr></thead><tbody>
          {sessions.length === 0 && <tr><td colSpan="8" className="muted">No sessions for this filter.</td></tr>}
          {sessions.map((s) => <tr key={s.id}><td>{s.booking_code}</td><td>{s.business_name}</td><td>{s.city || '–'}</td><td>{s.category}</td><td>{s.status}{s.end_reason ? ` · ${s.end_reason}` : ''}</td><td>{s.connection || '–'}</td><td>{s.ageSeconds != null ? `${s.ageSeconds}s ago` : '–'}</td><td><button className="adm-btn sm" onClick={() => openDetail(s.booking_id)}>Inspect</button></td></tr>)}
        </tbody></table></div>
      )}
      <h3>Online partners</h3>
      {!partners ? <Spinner /> : (
        <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Partner</th><th>City</th><th>Category</th><th>State</th></tr></thead><tbody>
          {partners.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.city || '–'}</td><td>{p.category}</td><td>{p.state}</td></tr>)}
        </tbody></table></div>
      )}
      {sum && sum.mapsApiUsage && sum.mapsApiUsage.length > 0 && (<><h3>Google Maps server usage (7 days)</h3><div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Day</th><th>API</th><th>Calls</th><th>Failures</th></tr></thead><tbody>{sum.mapsApiUsage.map((u, i) => <tr key={i}><td>{String(u.day).slice(0, 10)}</td><td>{u.api}</td><td>{u.calls}</td><td>{u.failures}</td></tr>)}</tbody></table></div><p className="muted small">Browser-side usage (map loads, Places Autocomplete) is billed to the web key: watch it in Google Cloud Console.</p></>)}
      <Sheet open={!!detail} onClose={() => setDetail(null)} title="Live tracking detail">
        {detail && <div className="adm-stack"><p><b>{detail.partner?.name}</b> · booking status {detail.status} · journey {detail.journey?.state}</p>
          {detail.provider ? <p>Position {detail.provider.lat.toFixed(5)}, {detail.provider.lng.toFixed(5)} · updated {detail.provider.ageSeconds}s ago · link {detail.connection}</p> : <p className="muted">No live position (not started, arrived or ended).</p>}
          {detail.remainingMeters != null && <p>{Math.round(detail.remainingMeters)} m remaining · ETA {detail.etaMinutes} min ({detail.route?.source})</p>}
          {detail.destination && <p className="muted">Destination: {detail.destination.address}</p>}</div>}
      </Sheet>
    </div>
  );
}
