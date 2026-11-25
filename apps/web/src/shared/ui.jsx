import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FolderOpen, Star, WifiOff, X } from 'lucide-react';
import { watchNetwork } from './native.js';

/* ---------- language ---------- */
export const LangContext = createContext({ lang: 'en', t: (en) => en });
export const useT = () => useContext(LangContext).t;

/* ---------- toast ---------- */
export const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);
export function ToastHost({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x.slice(-3), { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4800);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {items.map((i) => <div key={i.id} className={`toast ${i.kind}`}>{i.msg}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- polling hook: pauses while the tab is hidden ---------- */
export function usePolling(fn, ms, deps = [], enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    let stop = false;
    const run = () => { if (!stop && document.visibilityState === 'visible') Promise.resolve(saved.current()).catch(() => {}); };
    run();
    const id = setInterval(run, ms);
    const vis = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', vis);
    return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, enabled, ...deps]);
}

/* ---------- formatting ---------- */
export const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export function timeAgo(v) {
  if (!v) return '';
  const d = new Date(v); const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
export const dateTime = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export const STATUS = {
  REQUESTED: { label: 'Waiting for Dialoo Partner', hi: 'Dialoo पार्टनर का इंतज़ार', tone: 'amber' },
  ACCEPTED: { label: 'Accepted', hi: 'स्वीकार', tone: 'blue' },
  ON_THE_WAY: { label: 'On the way', hi: 'रास्ते में', tone: 'blue' },
  IN_PROGRESS: { label: 'Work in progress', hi: 'काम चालू', tone: 'purple' },
  COMPLETED: { label: 'Completed', hi: 'पूरा हुआ', tone: 'green' },
  REJECTED: { label: 'Rejected', hi: 'अस्वीकार', tone: 'red' },
  CANCELLED: { label: 'Cancelled', hi: 'रद्द', tone: 'red' },
  EXPIRED: { label: 'Expired', hi: 'समय समाप्त', tone: 'grey' },
};
export function StatusBadge({ status, short }) {
  const s = STATUS[status] || { label: status, tone: 'grey' };
  return <span className={`badge ${s.tone}`}>{short && s.short ? s.short : s.label}</span>;
}

export function Stars({ value }) {
  return <span className="rating-chip" aria-label={`Rated ${Number(value || 0).toFixed(1)} out of 5`}>{Number(value || 0).toFixed(1)}<Star size={12} fill="currentColor" aria-hidden="true" /></span>;
}

export function Spinner({ label = 'Loading…' }) { return <div className="skeleton-stack" role="status" aria-live="polite"><span className="sr-only">{label}</span><span className="skel card-ph" /><span className="skel card-ph" /><span className="skel line" /></div>; }
export function Empty({ icon = <FolderOpen size={26} aria-hidden="true" />, title, text, action }) {
  return <div className="empty"><div className="empty-ico">{icon}</div><h3>{title}</h3>{text && <p>{text}</p>}{action}</div>;
}

const sheetStack = [];
export function Sheet({ open, onClose, title, children, wide }) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const id = Math.random().toString(36).slice(2);
    sheetStack.push(id);
    // the phone's Back button / swipe-back closes the sheet instead of leaving the screen
    window.history.pushState({ dialooSheet: id }, '');
    let poppedByUser = false;
    const onPop = () => { if (sheetStack[sheetStack.length - 1] === id) { poppedByUser = true; closeRef.current(); } };
    const esc = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('popstate', onPop); document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('popstate', onPop); document.removeEventListener('keydown', esc);
      const i = sheetStack.indexOf(id); if (i >= 0) sheetStack.splice(i, 1);
      if (!sheetStack.length) document.body.style.overflow = '';
      if (!poppedByUser && window.history.state && window.history.state.dialooSheet === id) window.history.back();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head"><h3>{title}</h3><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** Shows when the phone has no internet or when saved (cached) data is being shown. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const stop = watchNetwork((online) => setOffline(!online));
    const a = () => setOffline(true), b = () => setOffline(false);
    window.addEventListener('dialoo-offline', a); window.addEventListener('dialoo-online', b);
    return () => { stop(); window.removeEventListener('dialoo-offline', a); window.removeEventListener('dialoo-online', b); };
  }, []);
  if (!offline) return null;
  return <div className="offline-bar" role="status"><WifiOff size={15} aria-hidden="true" /><span>You are offline — showing saved data. Booking and live updates need internet. / आप ऑफलाइन हैं — सेव किया हुआ डेटा दिख रहा है।</span></div>;
}
