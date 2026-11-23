import React, { useEffect, useState } from 'react';
import { catalogApi } from '../../shared/api.js';
import { back } from '../../shared/router.js';
import { Spinner, Stars, dateTime, money, useT } from '../../shared/ui.jsx';
import { ArrowLeft, BadgeCheck, CornerDownRight, Heart } from 'lucide-react';
import { ProviderAvatar } from '../../shared/parts.jsx';

export default function ProviderPage({ id, fav, onFav, onBook }) {
  const t = useT(); const [p, setP] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { setP(null); catalogApi.provider(id).then(setP).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <div><button className="link" onClick={back}><ArrowLeft size={16} aria-hidden="true" />{t('Back', 'वापस')}</button><p className="error">{err}</p></div>;
  if (!p) return <Spinner />;
  return (
    <div className="ppage">
      <button className="link" onClick={back}><ArrowLeft size={16} aria-hidden="true" />{t('Back', 'वापस')}</button>
      <section className="ph-card">
        <ProviderAvatar p={p} className="xl" />
        <div className="ph-main">
          <h1>{p.business_name}{p.verified ? <span className="tick"><BadgeCheck size={22} aria-hidden="true" role="img" aria-label="Verified" /></span> : null}</h1>
          <p className="muted">{p.category} · {p.address}</p>
          <div className="pcard-meta"><Stars value={p.average_rating} /><span className="muted">{p.review_count} {t('reviews', 'रिव्यू')}</span>{p.available_now ? <span className="live-dot">{t('Available now', 'अभी उपलब्ध')}</span> : <span className="off-dot">{t('Busy', 'व्यस्त')}</span>}</div>
          <p className="muted small">Dialoo ID: {p.public_id}</p>
        </div>
        <button className={`heart lg ${fav ? 'on' : ''}`} onClick={() => onFav(p.id)} aria-label="Favourite" aria-pressed={!!fav}><Heart size={26} aria-hidden="true" /></button>
      </section>
      <div className="stat-row">
        <div><b>{p.completed_jobs_count}</b><span>{t('Jobs done', 'काम पूरे')}</span></div>
        <div><b>{p.years_experience || 0}+</b><span>{t('Years', 'साल')}</span></div>
        <div><b>~{p.avg_response_minutes}m</b><span>{t('Response', 'जवाब')}</span></div>
        <div><b>{p.eta_minutes}m</b><span>{t('Arrives in', 'पहुँचेगा')}</span></div>
      </div>
      {p.description && <section className="card"><h3>{t('About', 'परिचय')}</h3><p>{p.description}</p><p className="muted small">{t('Languages', 'भाषाएँ')}: {p.languages}</p></section>}
      <section className="card">
        <h3>{t('Services & prices', 'सर्विस और कीमत')}</h3>
        {p.services.length === 0 ? <p className="muted">{t('Starting price', 'शुरुआती कीमत')}: {money(p.price_from)}</p> : p.services.map((s) => (
          <div className="svc-row" key={s.id}><div><b>{s.name}</b><span className="muted"> · ~{s.duration_minutes} min</span></div><div className="row"><b>{money(s.price)}</b><button className="btn outline sm" onClick={() => onBook(p, s.id)}>{t('Add', 'जोड़ें')}</button></div></div>
        ))}
      </section>
      <section className="card">
        <h3>{t('Customer reviews', 'ग्राहक रिव्यू')}</h3>
        {p.reviews.length === 0 ? <p className="muted">{t('No reviews yet.', 'अभी कोई रिव्यू नहीं।')}</p> : p.reviews.map((r, i) => (
          <div className="review" key={i}><div className="row between"><b>{r.customer_name}</b><Stars value={r.rating} /></div><p>{r.comment || '—'}</p>{r.provider_response && <p className="reply"><CornerDownRight size={14} aria-hidden="true" /> {r.provider_response}</p>}<span className="muted small">{dateTime(r.created_at)}</span></div>
        ))}
      </section>
      <div className="sticky-cta"><div><b>{money(p.price_from)}</b><span className="muted"> {t('onwards', 'से शुरू')}</span></div><button className="btn primary" onClick={() => onBook(p)}>{t('Book now', 'अभी बुक करें')}</button></div>
    </div>
  );
}
