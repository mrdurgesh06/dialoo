import React, { useState } from 'react';
import { customerApi } from '../../shared/api.js';
import { go } from '../../shared/router.js';
import { Empty, Spinner, StatusBadge, dateTime, money, useT, usePolling } from '../../shared/ui.jsx';
import { ClipboardList } from 'lucide-react';
import { CategoryIcon } from '../../shared/icons.jsx';

export const ACTIVE = ['REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'];

export default function Bookings() {
  const t = useT(); const [rows, setRows] = useState(null); const [tab, setTab] = useState('active'); const [err, setErr] = useState('');
  usePolling(() => customerApi.bookings().then(setRows).catch((e) => { setErr(e.message); setRows((r) => r || []); }), 10000);
  if (!rows) return <Spinner />;
  const list = rows.filter((b) => (tab === 'active' ? ACTIVE.includes(b.status) : !ACTIVE.includes(b.status)));
  return (
    <div>
      <h1 className="page-title">{t('My bookings', 'मेरी बुकिंग')}</h1>
      <div className="seg"><button className={tab === 'active' ? 'on' : ''} onClick={() => setTab('active')}>{t('Active', 'चालू')} ({rows.filter((b) => ACTIVE.includes(b.status)).length})</button><button className={tab === 'past' ? 'on' : ''} onClick={() => setTab('past')}>{t('Past', 'पुरानी')}</button></div>
      {err && <p className="error">{err}</p>}
      {list.length === 0 ? <Empty icon={<ClipboardList size={26} aria-hidden="true" />} title={tab === 'active' ? t('No active bookings', 'कोई चालू बुकिंग नहीं') : t('No past bookings', 'कोई पुरानी बुकिंग नहीं')} action={<button className="btn primary" onClick={() => go('/browse')}>{t('Book a service', 'सर्विस बुक करें')}</button>} /> : (
        <div className="list">{list.map((b) => (
          <button key={b.id} className="bk" onClick={() => go(`/booking/${b.id}`)}>
            <div className="avatar"><CategoryIcon name={b.category || b.service_name} size={26} strokeWidth={1.9} /></div>
            <div className="bk-main"><b>{b.business_name}</b><span className="muted">{b.service_name || b.category} · #{b.booking_code}</span><span className="muted small">{dateTime(b.created_at)}</span></div>
            <div className="bk-side"><StatusBadge status={b.status} /><b>{money(b.total_amount)}</b></div>
          </button>
        ))}</div>
      )}
    </div>
  );
}
