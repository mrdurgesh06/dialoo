import React, { useEffect, useState } from 'react';
import { customerApi } from '../../shared/api.js';
import { back, go } from '../../shared/router.js';
import LiveTrack from './LiveTrack.jsx';
import { Sheet, Spinner, StatusBadge, STATUS, dateTime, money, useT, useToast, usePolling } from '../../shared/ui.jsx';
import { ArrowLeft, CarFront, Check, CircleCheck, CircleSlash, CircleX, Clock, FileText, Hourglass, MessageCircle, Package, PartyPopper, Phone, SendHorizontal, Star, Wrench } from 'lucide-react';

const STEPS = [['REQUESTED', FileText, 'Placed', 'बुक'], ['ACCEPTED', CircleCheck, 'Accepted', 'स्वीकार'], ['ON_THE_WAY', CarFront, 'On the way', 'रास्ते में'], ['IN_PROGRESS', Wrench, 'Working', 'काम चालू'], ['COMPLETED', PartyPopper, 'Done', 'पूरा']];

export default function Tracking({ id }) {
  const t = useT(); const toast = useToast();
  const [b, setB] = useState(null); const [err, setErr] = useState(''); const [chat, setChat] = useState(false); const [cancel, setCancel] = useState(false);
  const load = () => customerApi.booking(id).then(setB).catch((e) => setErr(e.message));
  useEffect(() => { setB(null); load(); }, [id]); // eslint-disable-line
  usePolling(load, 8000, [id], !!b && !['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(b.status));

  if (err && !b) return <div><button className="link" onClick={back}><ArrowLeft size={16} aria-hidden="true" />{t('Back', 'वापस')}</button><p className="error">{err}</p></div>;
  if (!b) return <Spinner />;
  const failed = ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(b.status);
  const stepIdx = STEPS.findIndex((s) => s[0] === b.status);
  const active = ['REQUESTED', 'ACCEPTED', 'ON_THE_WAY'].includes(b.status);
  const headline = {
    REQUESTED: [t('Waiting for Dialoo Partner to accept', 'Dialoo पार्टनर के स्वीकार करने का इंतज़ार'), Hourglass],
    ACCEPTED: [t('Dialoo Partner accepted your booking', 'Dialoo पार्टनर ने बुकिंग स्वीकार की'), CircleCheck],
    ON_THE_WAY: [t('Dialoo Partner is on the way', 'Dialoo पार्टनर रास्ते में है'), CarFront],
    IN_PROGRESS: [t('Work in progress', 'काम चल रहा है'), Wrench],
    COMPLETED: [t('Service completed', 'सर्विस पूरी हुई'), PartyPopper],
    CANCELLED: [t('Booking cancelled', 'बुकिंग रद्द'), CircleX], REJECTED: [t('Dialoo Partner could not take this job', 'Dialoo पार्टनर यह काम नहीं ले सका'), CircleSlash], EXPIRED: [t('No response — booking expired', 'जवाब नहीं मिला — बुकिंग समाप्त'), Hourglass],
  }[b.status] || [b.status, Package];

  const HeroIcon = headline[1];
  return (
    <div className="track">
      <button className="link" onClick={back}><ArrowLeft size={16} aria-hidden="true" />{t('Back', 'वापस')}</button>
      <section className={`status-hero ${failed ? 'bad' : b.status === 'COMPLETED' ? 'good' : ''}`}>
        <div className="big"><HeroIcon size={34} aria-hidden="true" /></div>
        <div><h2>{headline[0]}</h2><p>#{b.booking_code} · {b.category} {b.service_name ? `· ${b.service_name}` : ''}</p>
          {b.status === 'REQUESTED' && <p className="small">{t('We will notify you the moment they respond.', 'जवाब आते ही हम आपको बताएँगे।')}</p>}
          {b.status === 'ACCEPTED' && <p className="small"><Clock size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {t('Usually arrives in', 'आमतौर पर पहुँचता है')} ~{b.eta_minutes} {t('min', 'मिनट')}</p>}
          {failed && b.cancel_reason && <p className="small">{t('Reason', 'कारण')}: {b.cancel_reason}</p>}
        </div>
      </section>

      {b.status === 'ON_THE_WAY' && <LiveTrack bookingId={b.id} name={b.business_name} phone={b.provider_phone} fallbackEta={b.eta_minutes} />}

      {!failed && (
        <ol className="steps">
          {STEPS.map((s, i) => <li key={s[0]} className={i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''}><span>{i < stepIdx ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : React.createElement(s[1], { size: 16, 'aria-hidden': 'true' })}</span><em>{t(s[2], s[3])}</em></li>)}
        </ol>
      )}

      {b.start_code && ['ACCEPTED', 'ON_THE_WAY'].includes(b.status) && (
        <section className="code-card"><div><b>{t('Start code', 'स्टार्ट कोड')}</b><p className="small">{t('Share this with the Dialoo Partner only when they arrive and are ready to start.', 'Dialoo पार्टनर के पहुँचने और काम शुरू करने पर ही यह कोड बताएँ।')}</p></div>
          <div className="digits">{String(b.start_code).split('').map((d, i) => <span key={i}>{d}</span>)}</div></section>
      )}

      <section className="card">
        <div className="row between"><h3>{b.business_name}</h3><StatusBadge status={b.status} /></div>
        <p className="muted">{b.provider_name} · <Star size={13} fill="currentColor" aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {Number(b.average_rating).toFixed(1)} · ID {b.provider_public_id}</p>
        <div className="row gap wrap">
          {b.provider_phone && <a className="btn outline sm" href={`tel:${b.provider_phone}`}><Phone size={16} aria-hidden="true" />{t('Call', 'कॉल')}</a>}
          {!['REJECTED', 'EXPIRED'].includes(b.status) && <button className="btn outline sm" onClick={() => setChat(true)}><MessageCircle size={16} aria-hidden="true" />{t('Chat', 'चैट')}</button>}
          <button className="btn ghost sm" onClick={() => go(`/provider/${b.provider_id}`)}>{t('View profile', 'प्रोफाइल')}</button>
        </div>
      </section>

      <section className="card">
        <h3>{t('Booking details', 'बुकिंग विवरण')}</h3>
        <dl className="dl"><dt>{t('Address', 'पता')}</dt><dd>{b.service_address}</dd><dt>{t('When', 'कब')}</dt><dd>{b.scheduled_at ? dateTime(b.scheduled_at) : t('As soon as possible', 'जल्द से जल्द')}</dd>
          <dt>{t('Placed', 'बुक हुई')}</dt><dd>{dateTime(b.created_at)}</dd>{b.description && <><dt>{t('Notes', 'नोट')}</dt><dd>{b.description}</dd></>}</dl>
        <div className="bill small-bill">
          <div><span>{t('Service', 'सर्विस')}</span><span>{money(b.service_amount)}</span></div><div><span>{t('Visit & platform fee', 'विज़िट फ़ीस')}</span><span>{money(b.visit_fee)}</span></div>
          <div><span>{t('Taxes', 'टैक्स')}</span><span>{money(b.tax_amount)}</span></div>{Number(b.discount_amount) > 0 && <div className="save"><span>{t('Discount', 'छूट')} {b.coupon_code ? `(${b.coupon_code})` : ''}</span><span>− {money(b.discount_amount)}</span></div>}
          <div className="total"><span>{b.status === 'COMPLETED' ? t('Final amount', 'अंतिम राशि') : t('Estimated total', 'अनुमानित कुल')}</span><span>{money(b.final_amount || b.total_amount)}</span></div>
          {b.status === 'COMPLETED' && <div><span>{t('Payment', 'भुगतान')}</span><span className={b.payment_status === 'PAID' ? 'ok' : 'warn'}>{b.payment_status === 'PAID' ? t('Paid', 'चुकाया') : t('Pay the Dialoo Partner directly', 'Dialoo पार्टनर को सीधे भुगतान करें')}</span></div>}
        </div>
      </section>

      <section className="card"><h3>{t('Timeline', 'टाइमलाइन')}</h3>
        <ul className="timeline">{(b.timeline || []).slice().reverse().map((e, i) => <li key={i}><b>{STATUS[e.to_status]?.label || e.to_status}</b><span>{dateTime(e.created_at)}{e.actor_role ? ` · ${e.actor_role.toLowerCase()}` : ''}</span>{e.reason && <em>{e.reason}</em>}</li>)}</ul></section>

      {active && <button className="btn danger-outline block" onClick={() => setCancel(true)}>{t('Cancel booking', 'बुकिंग रद्द करें')}</button>}
      {failed && <button className="btn primary block" onClick={() => go(`/browse`)}>{t('Find another Dialoo Partner', 'दूसरा Dialoo पार्टनर खोजें')}</button>}
      {b.status === 'COMPLETED' && !b.reviewed && <ReviewForm bookingId={b.id} onDone={load} />}
      {b.status === 'COMPLETED' && b.reviewed ? <p className="ok center"><Star size={15} aria-hidden="true" fill="currentColor" style={{ verticalAlign: '-2px' }} /> {t('Thanks for your review!', 'रिव्यू के लिए धन्यवाद!')}</p> : null}

      <CancelSheet open={cancel} onClose={() => setCancel(false)} onConfirm={async (reason) => { try { await customerApi.setStatus(b.id, { status: 'CANCELLED', reason }); setCancel(false); toast(t('Booking cancelled', 'बुकिंग रद्द हुई'), 'ok'); load(); } catch (e) { toast(e.message, 'err'); } }} />
      <ChatSheet open={chat} onClose={() => setChat(false)} bookingId={b.id} readOnly={failed} />
    </div>
  );
}

function CancelSheet({ open, onClose, onConfirm }) {
  const t = useT(); const [r, setR] = useState('');
  const reasons = [t('Changed my mind', 'इरादा बदल गया'), t('Booked by mistake', 'गलती से बुक हुई'), t('Dialoo Partner is taking too long', 'Dialoo पार्टनर देर कर रहा है'), t('Found another Dialoo Partner', 'दूसरा Dialoo पार्टनर मिला')];
  return (
    <Sheet open={open} onClose={onClose} title={t('Cancel this booking?', 'यह बुकिंग रद्द करें?')}>
      <div className="chip-row">{reasons.map((x) => <button key={x} className={`chip ${r === x ? 'on' : ''}`} onClick={() => setR(x)}>{x}</button>)}</div>
      <textarea rows="2" value={r} onChange={(e) => setR(e.target.value)} placeholder={t('Reason (optional)', 'कारण (वैकल्पिक)')} />
      <button className="btn danger block" onClick={() => onConfirm(r)}>{t('Yes, cancel booking', 'हाँ, रद्द करें')}</button>
    </Sheet>
  );
}

export function ChatSheet({ open, onClose, bookingId, readOnly }) {
  const t = useT(); const [msgs, setMsgs] = useState([]); const [text, setText] = useState(''); const toast = useToast();
  const load = () => customerApi.messages(bookingId).then((m) => setMsgs(m.slice().reverse())).catch(() => {});
  usePolling(load, 5000, [bookingId, open], open);
  const send = async () => { if (!text.trim()) return; try { await customerApi.sendMessage(bookingId, text.trim()); setText(''); load(); } catch (e) { toast(e.message, 'err'); } };
  return (
    <Sheet open={open} onClose={onClose} title={t('Chat', 'चैट')}>
      <div className="chat">{msgs.length === 0 && <p className="muted center">{t('Say hello', 'नमस्ते कहें')}</p>}
        {msgs.map((m) => <div key={m.id} className={`bubble ${m.mine ? 'mine' : ''}`}>{!m.mine && <small>{m.sender_name}</small>}{m.body}</div>)}</div>
      {!readOnly && <div className="chat-input"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={t('Type a message', 'संदेश लिखें')} maxLength={1000} /><button className="btn primary" onClick={send} aria-label={t('Send', 'भेजें')}><SendHorizontal size={18} aria-hidden="true" /></button></div>}
    </Sheet>
  );
}

function ReviewForm({ bookingId, onDone }) {
  const t = useT(); const toast = useToast(); const [rating, setRating] = useState(5); const [comment, setComment] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); try { await customerApi.review({ bookingId, rating, comment: comment.trim() || null }); toast(t('Review submitted', 'रिव्यू सबमिट हुआ'), 'ok'); onDone(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  return (
    <section className="card review-form"><h3>{t('How was the service?', 'सर्विस कैसी रही?')}</h3>
      <div className="star-pick">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={n <= rating ? 'on' : ''} aria-label={`${n} star`} aria-pressed={n <= rating} onClick={() => setRating(n)}><Star size={30} aria-hidden="true" /></button>)}</div>
      <textarea rows="3" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('Tell others about your experience', 'अपना अनुभव बताएँ')} maxLength={1000} />
      <button className="btn primary block" disabled={busy} onClick={submit}>{t('Submit review', 'रिव्यू सबमिट करें')}</button></section>
  );
}
