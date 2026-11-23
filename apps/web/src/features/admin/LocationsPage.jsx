import React, { useEffect, useState } from 'react';
import { adminApi } from '../../shared/api.js';
import { getPosition } from '../../shared/native.js';
import { Sheet, Spinner, useToast } from '../../shared/ui.jsx';
import { Card, Pager } from './OperationsPages.jsx';
import { MapPin } from 'lucide-react';

/** Admin > Locations: all Uttar Pradesh cities, with areas (localities) and streets per city. */
export default function LocationsPage() {
  const toast = useToast();
  const [q, setQ] = useState(''); const [page, setPage] = useState(0); const [data, setData] = useState(null); const [sel, setSel] = useState(null);
  const [districts, setDistricts] = useState([]); const [adding, setAdding] = useState(false); const [nc, setNc] = useState({ districtId: '', name: '', latitude: '', longitude: '' });
  const load = () => adminApi.cities({ q, page, size: 50 }).then(setData).catch((e) => toast(e.message, 'err'));
  useEffect(() => { setData(null); load(); }, [page]); // eslint-disable-line
  useEffect(() => { adminApi.districts().then(setDistricts).catch(() => {}); }, []);
  const toggle = async (c) => { try { await adminApi.cityActive(c.id, !c.is_active); load(); } catch (e) { toast(e.message, 'err'); } };
  const saveCity = async () => { try { await adminApi.addCity({ districtId: Number(nc.districtId), name: nc.name, latitude: Number(nc.latitude), longitude: Number(nc.longitude) }); toast('City added', 'ok'); setAdding(false); setNc({ districtId: '', name: '', latitude: '', longitude: '' }); load(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <div className="adm-stack">
      <div className="adm-toolbar">
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setData(null); load(); }}><input placeholder="Search city or district…" value={q} onChange={(e) => setQ(e.target.value)} /><button>Search</button></form>
        <button className="adm-btn sm" onClick={() => setAdding(true)}>+ Add city / town</button>
      </div>
      <p className="muted">Customers are matched to the nearest <b>active</b> city (within 60 km). All Uttar Pradesh district headquarters are loaded; coordinates are approximate, so refine them if needed.</p>
      {!data ? <Spinner /> : (
        <Card className="flush"><div className="table-wrap"><table className="adm-table hover"><thead><tr><th>City</th><th>District</th><th>Point</th><th>Providers</th><th>Areas</th><th>Streets</th><th>Active</th></tr></thead><tbody>
          {data.items.map((c) => (
            <tr key={c.id} onClick={() => setSel(c)}><td><b>{c.name}</b></td><td>{c.district}<small>{c.state}</small></td><td className="muted">{c.latitude ? `${Number(c.latitude).toFixed(3)}, ${Number(c.longitude).toFixed(3)}` : '—'}</td><td>{c.providers}</td><td>{c.localities}</td><td>{c.streets}</td>
              <td onClick={(e) => e.stopPropagation()}><label className="switch-sm"><input type="checkbox" checked={!!c.is_active} onChange={() => toggle(c)} /><span /></label></td></tr>
          ))}
          {data.items.length === 0 && <tr><td colSpan="7" className="center muted">No city found.</td></tr>}</tbody></table></div>
          <Pager page={page} setPage={setPage} total={data.total} size={50} /></Card>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add city / town"><div className="adm-form">
        <label>District<select value={nc.districtId} onChange={(e) => setNc({ ...nc, districtId: e.target.value })}><option value="">Select…</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.state})</option>)}</select></label>
        <label>City / town name<input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></label>
        <div className="adm-two"><label>Latitude<input type="number" step="any" value={nc.latitude} onChange={(e) => setNc({ ...nc, latitude: e.target.value })} /></label><label>Longitude<input type="number" step="any" value={nc.longitude} onChange={(e) => setNc({ ...nc, longitude: e.target.value })} /></label></div>
        <button type="button" className="adm-btn ghost sm" onClick={() => getPosition().then((p) => setNc({ ...nc, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) })).catch(() => toast('Could not read your location', 'err'))}><MapPin size={15} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Use my current location</button>
        <button className="adm-btn" disabled={!nc.districtId || nc.name.trim().length < 2 || nc.latitude === '' || nc.longitude === ''} onClick={saveCity}>Add city</button></div></Sheet>
      <CityDetail city={sel} onClose={() => setSel(null)} onChanged={load} />
    </div>
  );
}

function CityDetail({ city, onClose, onChanged }) {
  const toast = useToast(); const [loc, setLoc] = useState(null); const [st, setSt] = useState(null);
  const [nl, setNl] = useState({ name: '', pincode: '', latitude: '', longitude: '' }); const [ns, setNs] = useState({ name: '', localityId: '', latitude: '', longitude: '' });
  const reload = () => { if (!city) return; adminApi.localities(city.id).then(setLoc).catch((e) => toast(e.message, 'err')); adminApi.streets(city.id).then(setSt).catch(() => {}); };
  useEffect(() => { setLoc(null); setSt(null); if (city) reload(); }, [city?.id]); // eslint-disable-line
  const here = async (set, cur) => { try { const p = await getPosition(); set({ ...cur, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }); } catch { toast('Could not read your location. Type the coordinates instead.', 'err'); } };
  const addLoc = async () => { try { await adminApi.addLocality({ cityId: city.id, name: nl.name, pincode: nl.pincode, latitude: Number(nl.latitude), longitude: Number(nl.longitude) }); setNl({ name: '', pincode: '', latitude: '', longitude: '' }); toast('Area added', 'ok'); reload(); onChanged(); } catch (e) { toast(e.message, 'err'); } };
  const addSt = async () => { try { await adminApi.addStreet({ cityId: city.id, localityId: ns.localityId ? Number(ns.localityId) : null, name: ns.name, latitude: Number(ns.latitude), longitude: Number(ns.longitude) }); setNs({ name: '', localityId: '', latitude: '', longitude: '' }); toast('Street added', 'ok'); reload(); onChanged(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <Sheet open={!!city} onClose={onClose} title={city ? `${city.name} — areas & streets` : ''} wide>
      {city && <div className="adm-detail">
        <p className="muted">Areas and streets let the app say “near MG Marg, Hazratganj” even when the online map service is not reachable. Use <b>My location</b> while standing at the place to capture exact coordinates.</p>
        <div className="loc-cols">
          <div><h4>Areas (localities)</h4>{!loc ? <Spinner /> : loc.length === 0 ? <p className="muted">None yet.</p> : loc.map((l) => <div className="list-row" key={l.id}><div><b>{l.name}</b><small>{l.pincode || 'no pincode'} · {l.latitude ? `${Number(l.latitude).toFixed(4)}, ${Number(l.longitude).toFixed(4)}` : 'no point'}</small></div>
            <label className="switch-sm"><input type="checkbox" checked={!!l.is_active} onChange={async (e) => { await adminApi.localityActive(l.id, e.target.checked); reload(); }} /><span /></label></div>)}
            <div className="loc-add"><input placeholder="Area name" value={nl.name} onChange={(e) => setNl({ ...nl, name: e.target.value })} /><input placeholder="Pincode" maxLength={6} value={nl.pincode} onChange={(e) => setNl({ ...nl, pincode: e.target.value.replace(/\D/g, '') })} /><input placeholder="Latitude" value={nl.latitude} onChange={(e) => setNl({ ...nl, latitude: e.target.value })} /><input placeholder="Longitude" value={nl.longitude} onChange={(e) => setNl({ ...nl, longitude: e.target.value })} /></div>
            <div className="row gap"><button type="button" className="adm-btn ghost sm" onClick={() => here(setNl, nl)}><MapPin size={15} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> My location</button><button className="adm-btn sm" disabled={nl.name.trim().length < 2 || nl.latitude === '' || nl.longitude === ''} onClick={addLoc}>Add area</button></div></div>
          <div><h4>Streets</h4>{!st ? <Spinner /> : st.length === 0 ? <p className="muted">None yet.</p> : st.map((t) => <div className="list-row" key={t.id}><div><b>{t.name}</b><small>{t.locality || '—'} · {Number(t.latitude).toFixed(4)}, {Number(t.longitude).toFixed(4)}{t.source === 'SEED_APPROX' ? ' · approximate' : ''}</small></div>
            <label className="switch-sm"><input type="checkbox" checked={!!t.is_active} onChange={async (e) => { await adminApi.streetActive(t.id, e.target.checked); reload(); }} /><span /></label></div>)}
            <div className="loc-add"><input placeholder="Street / road name" value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} /><select value={ns.localityId} onChange={(e) => setNs({ ...ns, localityId: e.target.value })}><option value="">Area…</option>{(loc || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select><input placeholder="Latitude" value={ns.latitude} onChange={(e) => setNs({ ...ns, latitude: e.target.value })} /><input placeholder="Longitude" value={ns.longitude} onChange={(e) => setNs({ ...ns, longitude: e.target.value })} /></div>
            <div className="row gap"><button type="button" className="adm-btn ghost sm" onClick={() => here(setNs, ns)}><MapPin size={15} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> My location</button><button className="adm-btn sm" disabled={ns.name.trim().length < 2 || ns.latitude === '' || ns.longitude === ''} onClick={addSt}>Add street</button></div></div>
        </div>
      </div>}
    </Sheet>
  );
}
