import { useEffect, useRef, useState } from 'react';
import { customerApi } from './api.js';
import { acquireStomp } from './trackingClient.js';

const DEFAULT_CFG = { gpsIntervalSeconds: 10, staleWarningSeconds: 30, unavailableSeconds: 90 };

/**
 * Customer / partner live view of one booking.
 *  - WebSocket (STOMP) is the primary transport: SUBSCRIBE /topic/bookings/{id}/tracking (server authorises each subscription).
 *  - REST polling (6 s) runs ONLY while the socket is down and stops by itself when it reconnects.
 *  - On every (re)connect the full state is fetched again, so nothing is lost while disconnected.
 * Returns { snap, provider, route, remainingMeters, etaMinutes, transport, link, connection, ageSeconds, arrived, ended, error }.
 *   connection: WAITING | LIVE | STALE | UNAVAILABLE      link: ws | connecting | reconnecting | poll
 */
export function useTrackingFeed(bookingId, { enabled = true, pollMs = 6000, onJourneyChange } = {}) {
  const [snap, setSnap] = useState(null);
  const [live, setLive] = useState(null);          // latest location event: {lat,lng,heading,speed,ts,seq}
  const [routeEv, setRouteEv] = useState(null);    // latest route event
  const [link, setLink] = useState('connecting');
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState(null);
  const seqRef = useRef(0); const cb = useRef(onJourneyChange); cb.current = onJourneyChange;

  const fetchSnap = useRef(null);
  fetchSnap.current = async () => {
    try {
      const s = await customerApi.tracking(bookingId);
      setSnap(s); setError(null);
      if (s.provider && s.provider.seq > seqRef.current) { seqRef.current = s.provider.seq; setLive({ lat: s.provider.lat, lng: s.provider.lng, heading: s.provider.heading, speed: s.provider.speed, ts: s.provider.updatedAt, seq: s.provider.seq }); }
      if (s.route) setRouteEv({ route: s.route, remainingMeters: s.remainingMeters, etaMinutes: s.etaMinutes, etaSeconds: s.etaSeconds });
      return s;
    } catch (e) { setError(e); return null; }
  };

  useEffect(() => {
    if (!enabled || !bookingId) return undefined;
    seqRef.current = 0; setLive(null); setRouteEv(null); setSnap(null);
    let dead = false; let unsub = null;
    fetchSnap.current();
    const handle = acquireStomp((s) => { if (dead) return; setLink(s === 'connected' ? 'ws' : s === 'connecting' ? 'connecting' : 'reconnecting'); if (s === 'connected') fetchSnap.current(); });
    unsub = handle.client.subscribe(`/topic/bookings/${bookingId}/tracking`, (m) => {
      if (dead || !m) return;
      if (m.type === 'location') {
        if (m.seq <= seqRef.current) return;      // duplicate / out-of-order frame
        seqRef.current = m.seq;
        setLive({ lat: m.lat, lng: m.lng, heading: m.heading, speed: m.speed, ts: m.ts, seq: m.seq });
        if (m.remainingMeters != null) setRouteEv((r) => ({ route: r ? r.route : null, remainingMeters: m.remainingMeters, etaMinutes: m.etaMinutes, etaSeconds: m.etaSeconds }));
      } else if (m.type === 'route') {
        setRouteEv({ route: m.route, remainingMeters: m.remainingMeters, etaMinutes: m.etaMinutes, etaSeconds: m.etaSeconds });
      } else if (m.type === 'arrived' || m.type === 'ended' || m.type === 'started') {
        fetchSnap.current().then((s) => cb.current && cb.current(m.type, s));
      }
    });
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { dead = true; clearInterval(tick); if (unsub) unsub(); handle.release(); };
  }, [bookingId, enabled]);

  // polling fallback: only while the socket is not connected
  const wsUp = link === 'ws';
  useEffect(() => {
    if (!enabled || !bookingId || wsUp) return undefined;
    const id = setInterval(() => { if (document.visibilityState === 'visible') fetchSnap.current(); }, pollMs);
    return () => clearInterval(id);
  }, [enabled, bookingId, wsUp, pollMs]);

  const cfg = { ...DEFAULT_CFG, ...(snap && snap.config) };
  const ts = live ? live.ts : null;
  const ageSeconds = ts ? Math.max(0, Math.round((now - ts) / 1000)) : null;
  const journey = snap && snap.journey ? snap.journey.state : 'NOT_STARTED';
  let connection = 'WAITING';
  if (ageSeconds != null) connection = ageSeconds > cfg.unavailableSeconds ? 'UNAVAILABLE' : ageSeconds > cfg.staleWarningSeconds ? 'STALE' : 'LIVE';
  return {
    snap, journey, provider: live, route: routeEv ? routeEv.route : null, remainingMeters: routeEv ? routeEv.remainingMeters : null,
    etaMinutes: routeEv ? routeEv.etaMinutes : null, link: wsUp ? 'ws' : link === 'connecting' ? 'connecting' : (error ? 'poll-error' : 'poll'),
    connection, ageSeconds, arrived: journey === 'ARRIVED' || !!(snap && snap.arrived), ended: journey === 'ENDED', error, refresh: () => fetchSnap.current(), cfg,
  };
}
