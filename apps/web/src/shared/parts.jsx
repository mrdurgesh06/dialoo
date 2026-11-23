import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Bell as BellIcon, Clock, Heart, MapPin, Search, UserRound, X } from 'lucide-react';
import { catalogApi, customerApi, notificationApi } from './api.js';
import { go } from './router.js';
import { CategoryIcon, NotificationIcon } from './icons.jsx';
import { Stars, money, timeAgo, useT, useToast, usePolling } from './ui.jsx';

/** Provider photo when the API supplies one, otherwise a soft-blue initials tile. */
export function ProviderAvatar({ p, className = '' }) {
  const [bad, setBad] = useState(false);
  const src = p.photo_url || p.avatar_url;
  const initials = (p.business_name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className={`pavatar ${className}`} aria-hidden="true">
      {src && !bad ? <img src={src} alt="" loading="lazy" onError={() => setBad(true)} /> : (initials || <UserRound size={24} />)}
    </div>
  );
}

/**
 * One provider card for every list (Available Right Now, Top Rated, Trusted Professionals, Browse, Favourites).
 * Hierarchy: name -> service details -> trust signals -> price -> Book.
 */
export function ProviderCard({ p, fav, onFav, onBook, compact, bookLabel }) {
  const t = useT();
  const open = () => go(`/provider/${p.id}`);
  const label = bookLabel || (compact ? t('Book', 'बुक करें') : t('Book Now', 'अभी बुक करें'));
  return (
    <article className={`pcard ${compact ? 'compact' : ''}`} tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } }}>
      <div className="pcard-top">
        <ProviderAvatar p={p} />
        <div className="pcard-main">
          <h3>
            <span className="name">{p.business_name}</span>
            {p.verified ? <span className="tick" title={t('Verified', 'वेरिफाइड')}><BadgeCheck size={17} role="img" aria-label={t('Verified', 'वेरिफाइड')} /></span> : null}
          </h3>
          <p className="pcard-sub">
            <span>{p.category}</span>
            <span>{p.years_experience || 0} {t('yrs exp', 'साल अनुभव')}</span>
            {p.distance_km != null && <span className="dist"><MapPin size={12} aria-hidden="true" />{p.distance_km} km</span>}
          </p>
        </div>
        {onFav && (
          <button className={`heart ${fav ? 'on' : ''}`} aria-label={fav ? t('Remove from favourites', 'पसंदीदा से हटाएँ') : t('Add to favourites', 'पसंदीदा में जोड़ें')} aria-pressed={!!fav}
            onClick={(e) => { e.stopPropagation(); onFav(p.id); }}><Heart size={19} aria-hidden="true" /></button>
        )}
      </div>
      <div className="pcard-meta">
        <Stars value={p.average_rating} /><span className="muted">({p.review_count})</span>
        {p.available_now ? <span className="live-dot">{t('Available now', 'अभी उपलब्ध')}</span> : <span className="off-dot">{t('Busy', 'व्यस्त')}</span>}
      </div>
      {!compact && <p className="pcard-desc">{p.description}</p>}
      <div className="pcard-foot">
        <div>
          <div className="price"><b>{money(p.price_from)}</b><span className="muted"> {t('onwards', 'से शुरू')}</span></div>
          <div className="eta"><Clock size={13} aria-hidden="true" />~{p.eta_minutes || 45} {t('min', 'मिनट')}</div>
        </div>
        <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onBook(p); }}>{label}</button>
      </div>
    </article>
  );
}

/** Search box with live suggestions for services, categories and providers. */
export function SearchBox({ value, onChange, onSubmit }) {
  const t = useT();
  const [open, setOpen] = useState(false); const [sg, setSg] = useState(null); const timer = useRef();
  useEffect(() => {
    clearTimeout(timer.current);
    if ((value || '').trim().length < 2) { setSg(null); return undefined; }
    timer.current = setTimeout(() => catalogApi.suggest(value.trim()).then(setSg).catch(() => setSg(null)), 220);
    return () => clearTimeout(timer.current);
  }, [value]);
  const none = sg && !sg.categories.length && !sg.services.length && !sg.providers.length;
  return (
    <div className="searchbox">
      <Search className="s-ico" size={18} aria-hidden="true" />
      <input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={(e) => { if (e.key === 'Enter') { setOpen(false); onSubmit(value); } }}
        placeholder={t('Search electrician, plumber, carpenter...', 'खोजें: इलेक्ट्रीशियन, प्लंबर, कारपेंटर...')} aria-label={t('Search services', 'सर्विस खोजें')} />
      {value && <button className="clear" aria-label={t('Clear search', 'खोज हटाएँ')} onMouseDown={(e) => { e.preventDefault(); onChange(''); }}><X size={16} aria-hidden="true" /></button>}
      {open && sg && (
        <div className="suggest">
          {sg.categories.map((c) => <button key={c.slug} onMouseDown={() => go(`/browse?cat=${c.slug}`)}><CategoryIcon slug={c.slug} name={c.name} size={18} />{c.name}<em>{t('Category', 'श्रेणी')}</em></button>)}
          {sg.services.map((s) => <button key={s.name} onMouseDown={() => go(`/browse?cat=${s.category_slug}&q=${encodeURIComponent(s.name)}`)}><CategoryIcon slug={s.category_slug} name={s.name} size={18} />{s.name}<em>{money(s.base_price)}</em></button>)}
          {sg.providers.map((p) => <button key={p.id} onMouseDown={() => go(`/provider/${p.id}`)}><UserRound size={18} aria-hidden="true" />{p.business_name}<em>{p.category}</em></button>)}
          {none && <div className="muted pad">{t('No match. Try another word.', 'कुछ नहीं मिला। दूसरा शब्द आज़माएँ।')}</div>}
        </div>
      )}
    </div>
  );
}

/** Notification bell: polls every 12s, shows a toast when something new arrives. */
export function Bell({ api = notificationApi, signedIn, onOpen }) {
  const toast = useToast(); const [n, setN] = useState(0); const last = useRef(null);
  usePolling(async () => {
    const r = await api.unread();
    setN(r.unread);
    if (last.current !== null && r.latestId > last.current) {
      const list = await (api.notifications ? api.notifications(0) : api.list(0, 3));
      const fresh = (list.items || []).filter((x) => x.id > last.current && !x.read_at).slice(0, 2);
      fresh.forEach((x) => toast(`${x.title}: ${x.body}`.slice(0, 140), 'info'));
    }
    last.current = r.latestId;
  }, 12000, [signedIn], signedIn);
  return (
    <button className="icon-btn bell" aria-label={`Notifications (${n} unread)`} onClick={onOpen}>
      <BellIcon size={20} aria-hidden="true" />{n > 0 && <b className="count">{n > 9 ? '9+' : n}</b>}
    </button>
  );
}

export function NotificationList({ api = notificationApi, onNavigate }) {
  const t = useT(); const [items, setItems] = useState(null); const [err, setErr] = useState('');
  const load = () => (api.notifications ? api.notifications(0) : api.list(0, 40)).then((r) => setItems(r.items || [])).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line
  usePolling(load, 15000);
  const readAll = async () => { await (api.readAll || notificationApi.readAll)(); load(); };
  const open = async (n) => {
    if (!n.read_at) { try { await (api.readOne ? api.readOne(n.id) : notificationApi.read(n.id)); } catch { /* ignore */ } }
    if (onNavigate) onNavigate(n); else if (n.entity_type === 'BOOKING') go(`/booking/${n.entity_id}`);
    load();
  };
  if (err) return <p className="error">{err}</p>;
  if (!items) return <p className="muted pad">{t('Loading…', 'लोड हो रहा है…')}</p>;
  return (
    <div className="notif-list">
      <div className="row between"><b>{items.filter((x) => !x.read_at).length} {t('unread', 'अनपढ़े')}</b><button className="link" onClick={readAll}>{t('Mark all read', 'सब पढ़ा हुआ करें')}</button></div>
      {!items.length && <p className="muted pad">{t('No notifications yet. Booking updates will appear here.', 'अभी कोई सूचना नहीं। बुकिंग अपडेट यहाँ दिखेंगे।')}</p>}
      {items.map((n) => (
        <button key={n.id} className={`notif ${n.read_at ? '' : 'unread'} p-${n.priority}`} onClick={() => open(n)}>
          <span className="n-ico">{iconFor(n.type)}</span>
          <span className="n-body"><b>{n.title}</b><span>{n.body}</span><em>{timeAgo(n.created_at)}</em></span>
          {!n.read_at && <i className="dot" />}
        </button>
      ))}
    </div>
  );
}
export function iconFor(type = '') { return <NotificationIcon type={type} size={20} />; }

export function useFavourites(signedIn) {
  const [ids, setIds] = useState([]); const toast = useToast();
  useEffect(() => { if (signedIn) customerApi.favourites().then(setIds).catch(() => {}); else setIds([]); }, [signedIn]);
  const toggle = async (id) => {
    try {
      if (ids.includes(id)) { await customerApi.removeFav(id); setIds(ids.filter((x) => x !== id)); }
      else { await customerApi.addFav(id); setIds([id, ...ids]); toast('Added to favourites', 'ok'); }
    } catch (e) { toast(e.message, 'err'); }
  };
  return [ids, toggle];
}
