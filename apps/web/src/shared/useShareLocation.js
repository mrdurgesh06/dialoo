import { useEffect, useRef, useState } from 'react';
import { customerApi } from './api.js';
import { acquireStomp } from './trackingClient.js';
import { watchNetwork } from './native.js';
import { watchPosition } from './locationWatch.js';

const hav = (a, b, c, d) => { const r = 6371000, p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2; return 2 * r * Math.asin(Math.min(1, Math.sqrt(x))); };
const MAX_BUFFER = 12;   // bounded offline buffer per booking

/**
 * Partner app: while at least one booking is ON_THE_WAY, share the phone's GPS with the server.
 *  - Start: POST /tracking/start (create/resume the session) -> sessionId + server-side settings (intervals, filters).
 *  - Source: background-capable watcher (see locationWatch.js). Sending is paced: every gpsIntervalSeconds while moving more than
 *    minDistanceMeters, every stationaryIntervalSeconds otherwise.
 *  - Transport: WebSocket frame (SEND /app/tracking/location); if the socket is down the same payload goes over HTTPS.
 *    Both use one strictly increasing sequence number, so the server never processes a fix twice.
 *  - Offline: failed fixes are buffered (bounded), retried with exponential backoff, stale ones are dropped by the server.
 *  - Stops by itself when the booking leaves bookingIds (arrived, cancelled, started work ...) or the server ends the session.
 * State: { status: idle|starting|live|denied|error, gps: ok|weak|off, online, transport, lastSentAt, accuracy, background, byBooking: {id:{distance,within,ended}} }
 */
export function useShareLocation(bookingIds, epoch = 0) {
  const [state, setState] = useState({ status: 'idle', gps: 'ok', online: true, transport: null, byBooking: {} });
  const key = `${[...bookingIds].sort().join(',')}:${epoch}`;
  const live = useRef({});     // per booking runtime data
  useEffect(() => { const off = watchNetwork((on) => setState((s) => ({ ...s, online: on }))); return off; }, []);

  useEffect(() => {
    if (!bookingIds.length) { setState((s) => ({ ...s, status: 'idle', byBooking: {} })); return undefined; }
    let dead = false; let watcher = null; let sock = null; let cfg = { gpsIntervalSeconds: 10, stationaryIntervalSeconds: 30, minDistanceMeters: 15, maxAccuracyMeters: 100 };
    const rt = {}; bookingIds.forEach((id) => { rt[id] = { sessionId: null, buf: [], lastSent: null, lastSentAt: 0, backoff: 0, nextTry: 0, ended: false }; });
    live.current = rt; let seq = 0; let started = false;
    const nextSeq = () => { seq = Math.max(seq + 1, Date.now()); return seq; };
    setState((s) => ({ ...s, status: 'starting' }));

    const setBooking = (id, patch) => setState((s) => ({ ...s, byBooking: { ...s.byBooking, [id]: { ...(s.byBooking[id] || {}), ...patch } } }));
    const ack = (id, a) => { if (!a) return; setBooking(id, { distance: a.distanceMeters, within: !!a.withinArrivalRadius }); };

    const sendOne = async (id, p) => {
      const r = rt[id]; if (!r || r.ended || !r.sessionId) return;
      const payload = { bookingId: id, trackingSessionId: r.sessionId, latitude: p.lat, longitude: p.lng, accuracy: p.accuracy, speed: p.speed, heading: p.heading, timestamp: p.ts, sequenceNumber: p.seq };
      if (sock && sock.client.publish('/app/tracking/location', payload)) { setState((s) => ({ ...s, status: 'live', transport: 'ws', lastSentAt: Date.now() })); return; }   // ack arrives on /user/queue/tracking
      const res = await customerApi.sendLocation(id, payload);          // HTTPS fallback
      ack(id, res); setState((s) => ({ ...s, status: 'live', transport: 'http', lastSentAt: Date.now() }));
    };

    const flush = async (id) => {
      const r = rt[id]; if (!r || r.ended) return;
      if (Date.now() < r.nextTry) return;
      const cutoff = Date.now() - 100000;
      r.buf = r.buf.filter((f) => f.ts >= cutoff);   // the server refuses fixes older than ~2 min anyway
      while (r.buf.length) {
        const f = r.buf[0];
        try { await sendOne(id, f); r.buf.shift(); r.backoff = 0; }
        catch (e) {
          if (/session has ended|journey not active|not found/i.test(e.message || '')) { r.ended = true; r.buf = []; setBooking(id, { ended: true }); return; }
          if (e.status === 400) { r.buf.shift(); continue; }   // invalid fix (poor accuracy / jump): drop it, never retry
          r.backoff = Math.min(60000, r.backoff ? r.backoff * 2 : 2000); r.nextTry = Date.now() + r.backoff;   // exponential backoff
          setState((s) => ({ ...s, status: 'error', message: e.message }));
          return;
        }
      }
    };

    const onFix = (p) => {
      if (dead) return;
      const acc = p.accuracy ?? 9999;
      setState((s) => ({ ...s, gps: acc <= 50 ? 'ok' : 'weak', accuracy: Math.round(acc), lastFix: { lat: p.lat, lng: p.lng, heading: p.heading, updatedAt: Date.now() } }));
      if (acc > cfg.maxAccuracyMeters) return;    // never send a useless fix
      const now = Date.now();
      for (const id of bookingIds) {
        const r = rt[id]; if (!r || r.ended || !r.sessionId) continue;
        const moved = r.lastSent ? hav(r.lastSent.lat, r.lastSent.lng, p.lat, p.lng) : Infinity;
        const elapsed = (now - r.lastSentAt) / 1000;
        const due = r.lastSent == null || (moved >= cfg.minDistanceMeters && elapsed >= cfg.gpsIntervalSeconds) || elapsed >= cfg.stationaryIntervalSeconds;
        if (!due) continue;
        r.lastSent = { lat: p.lat, lng: p.lng }; r.lastSentAt = now;
        r.buf.push({ ...p, seq: nextSeq() }); if (r.buf.length > MAX_BUFFER) r.buf.shift();
        flush(id);
      }
    };
    const onError = (e) => {
      if (dead) return;
      if (e.code === 'DENIED') setState((s) => ({ ...s, status: 'denied', gps: 'off' }));
      else setState((s) => ({ ...s, gps: 'off', status: s.status === 'live' ? 'error' : s.status, message: e.message }));
    };

    (async () => {
      sock = acquireStomp((st) => { if (!dead && st === 'connected') bookingIds.forEach((id) => flush(id)); });
      const unsubs = [
        sock.client.subscribe('/user/queue/tracking', (a) => { if (a && a.sessionId) { const id = Object.keys(rt).find((k) => rt[k].sessionId === a.sessionId); if (id) ack(id, a); } }),
        sock.client.subscribe('/user/queue/errors', (e) => {
          if (e && /ended|not active/i.test(e.error || '')) { bookingIds.forEach((id) => { rt[id].ended = true; setBooking(id, { ended: true }); }); }
        }),
      ];
      sock.unsubs = unsubs;
      for (const id of bookingIds) {
        try {
          const s = await customerApi.trackingStart(id);
          if (dead) return;
          rt[id].sessionId = s.journey.sessionId; seq = Math.max(seq, Number(s.journey.lastSeq) || 0); cfg = { ...cfg, ...s.config };
          setBooking(id, { distance: s.distanceToDestinationMeters, within: !!s.withinArrivalRadius });
        } catch (e) {
          if (dead) return;
          if (/already arrived/i.test(e.message || '')) { rt[id].ended = true; setBooking(id, { ended: true, arrived: true }); }
          else setState((st) => ({ ...st, status: 'error', message: e.message }));
        }
      }
      if (dead) return;
      if (bookingIds.every((id) => rt[id].ended)) { setState((st) => ({ ...st, status: 'idle' })); return; }
      watcher = await watchPosition({ onFix, onError, distanceFilter: cfg.minDistanceMeters });
      if (dead) { watcher.stop(); return; }
      started = true; setState((st) => ({ ...st, background: watcher.background }));
    })();

    const retry = setInterval(() => bookingIds.forEach((id) => rt[id] && rt[id].buf.length && flush(id)), 5000);   // backoff-aware retry of buffered fixes
    return () => {
      dead = true; clearInterval(retry);
      if (watcher) watcher.stop();           // releases GPS + removes the persistent notification
      if (sock) { (sock.unsubs || []).forEach((u) => u()); sock.release(); }
      void started;
    };
  }, [key]); // eslint-disable-line
  return state;
}

/** Online partner without an active journey: low-frequency position for nearby discovery. Stops when offline. */
export function usePartnerPresence(online, intervalMs = 60000) {
  const [st, setSt] = useState({ status: 'idle' });
  useEffect(() => {
    if (!online) { setSt({ status: 'idle' }); return undefined; }
    let dead = false; let watcher = null; let last = 0;
    (async () => {
      watcher = await watchPosition({
        distanceFilter: 50, background: false,   // presence is foreground-only: no persistent notification unless a journey is active
        onFix: (p) => {
          if (dead || Date.now() - last < intervalMs || (p.accuracy ?? 0) > 150) return;
          last = Date.now();
          import('./api.js').then(({ providerApi }) => providerApi.sendPresence({ latitude: p.lat, longitude: p.lng, accuracy: p.accuracy }))
            .then(() => !dead && setSt({ status: 'sharing', at: Date.now() })).catch((e) => !dead && setSt({ status: 'error', message: e.message }));
        },
        onError: (e) => !dead && setSt({ status: e.code === 'DENIED' ? 'denied' : 'error' }),
      });
      if (dead) watcher.stop();
    })();
    return () => { dead = true; if (watcher) watcher.stop(); };
  }, [online, intervalMs]);
  return st;
}
