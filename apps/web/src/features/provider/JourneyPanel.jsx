import React, { useState } from 'react';
import { CircleCheck, Navigation, Satellite, Wifi, WifiOff, Radio, Square, RefreshCw } from 'lucide-react';
import { customerApi } from '../../shared/api.js';
import { openNavigation } from '../../shared/navigate.js';
import { useTrackingFeed } from '../../shared/useTrackingFeed.js';
import TrackMap from '../../shared/TrackMap.jsx';
import { useT, useToast } from '../../shared/ui.jsx';

const km = (m) => (m == null ? '–' : m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/**
 * Partner journey card (one per ON_THE_WAY booking): map, road distance + ETA, navigation, sharing status, GPS / internet indicators and
 * the Arrived action. Arrival is checked on the server (accuracy + distance); the button only enables inside the geofence.
 * `share` is the useShareLocation state: acks from the server tell us the live distance and whether we are inside the radius.
 */
export default function JourneyPanel({ booking, share, onArrived, onResume }) {
  const t = useT(); const toast = useToast();
  const f = useTrackingFeed(booking.id, { onJourneyChange: (type) => type === 'arrived' && onArrived?.() });
  const [busy, setBusy] = useState(false);
  const mine = (share.byBooking || {})[booking.id] || {};
  const dest = f.snap?.destination || (booking.latitude != null ? { lat: Number(booking.latitude), lng: Number(booking.longitude), address: booking.service_address } : null);
  const arrived = f.arrived || mine.arrived;
  const sharing = share.status === 'live' && !mine.ended;
  const distance = mine.distance ?? f.snap?.distanceToDestinationMeters ?? null;
  const within = mine.within || f.snap?.withinArrivalRadius || false;
  const radius = f.cfg.arrivalRadiusMeters || 100;

  const arrive = async (manual = false) => {
    if (manual && !window.confirm(t('Confirm only if you are really at the customer\'s address. Your GPS does not match yet, so this will be recorded as a manual confirmation.', 'सिर्फ़ तभी दबाएँ जब आप सच में कस्टमर के पते पर हों। आपका GPS अभी मैच नहीं हो रहा, इसलिए यह मैन्युअल कन्फ़र्मेशन के रूप में दर्ज होगा।'))) return;
    setBusy(true);
    try { await customerApi.trackingArrive(booking.id, manual); toast(t('Arrival confirmed. Ask the consumer for the start code.', 'पहुँचना दर्ज। कंज़्यूमर से स्टार्ट कोड माँगें।'), 'ok'); onArrived?.(); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const stop = async () => { try { await customerApi.trackingStop(booking.id); toast(t('Location sharing stopped for this job.', 'इस काम के लिए लोकेशन शेयरिंग बंद।'), 'info'); } catch (e) { toast(e.message, 'err'); } };
  const resume = async () => { try { await customerApi.trackingStart(booking.id); onResume?.(); } catch (e) { toast(e.message, 'err'); } };

  return (
    <div className="journey">
      {!arrived && <TrackMap dest={dest} provider={f.provider || share.lastFix} route={f.route} gpsMs={(f.cfg.gpsIntervalSeconds || 10) * 1000} stale={f.connection !== 'LIVE'} height="220px" />}
      <div className="jr-stats">
        <div><small>{t('Road distance', 'सड़क की दूरी')}</small><b>{arrived ? '0 m' : km(f.remainingMeters ?? distance)}</b></div>
        <div><small>{t('Arrival in', 'पहुँचने में')}</small><b>{arrived ? '—' : f.etaMinutes != null ? `${f.etaMinutes} ${t('min', 'मिनट')}` : '–'}</b></div>
        <div><small>{t('To the address', 'पते तक')}</small><b>{km(distance)}</b></div>
      </div>
      <div className="jr-status" role="status">
        <span className={`ind ${sharing ? 'ok' : 'bad'}`}><Radio size={14} aria-hidden="true" />{arrived ? t('Sharing stopped (arrived)', 'शेयरिंग बंद (पहुँच गए)') : sharing ? t('Live location sharing is ON', 'लाइव लोकेशन शेयरिंग चालू') : t('Location sharing is OFF', 'लोकेशन शेयरिंग बंद')}</span>
        <span className={`ind ${share.gps === 'ok' ? 'ok' : share.gps === 'weak' ? 'warn' : 'bad'}`}><Satellite size={14} aria-hidden="true" />GPS {share.gps === 'ok' ? t('good', 'ठीक') : share.gps === 'weak' ? t('weak', 'कमज़ोर') : t('off', 'बंद')}{share.accuracy ? ` · ±${share.accuracy} m` : ''}</span>
        <span className={`ind ${share.online ? 'ok' : 'bad'}`}>{share.online ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}{share.online ? (share.transport === 'ws' ? t('Internet · live link', 'इंटरनेट · लाइव लिंक') : t('Internet', 'इंटरनेट')) : t('No internet — saving updates', 'इंटरनेट नहीं — अपडेट सहेज रहे हैं')}</span>
      </div>
      {share.status === 'denied' && <p className="error">{t('Location permission is off. Allow “Always” or “While using” for Dialoo so the consumer can track you.', 'लोकेशन की अनुमति बंद है। Dialoo को लोकेशन की अनुमति दें ताकि कंज़्यूमर आपको ट्रैक कर सके।')}</p>}
      {!arrived && !within && distance != null && <p className="muted small">{t(`You can confirm arrival within ${Math.round(radius)} m of the address.`, `पते के ${Math.round(radius)} मीटर के अंदर पहुँचकर ‘पहुँच गया’ दबा सकते हैं।`)}</p>}
      <div className="row gap wrap">
        {dest && <button className="btn outline sm" onClick={() => openNavigation(dest.lat, dest.lng)}><Navigation size={16} aria-hidden="true" />{t('Navigate (Google Maps)', 'नेविगेट (Google Maps)')}</button>}
        {!arrived && <button className="btn primary sm" disabled={busy || !within} onClick={() => arrive(false)}><CircleCheck size={16} aria-hidden="true" />{t('I have arrived', 'मैं पहुँच गया')}</button>}
        {!arrived && !within && <button className="btn outline sm" disabled={busy} onClick={() => arrive(true)}><CircleCheck size={16} aria-hidden="true" />{t('Reached (confirm manually)', 'पहुँच गया (खुद कन्फ़र्म करें)')}</button>}
        {!arrived && sharing && <button className="btn ghost sm" onClick={stop}><Square size={14} aria-hidden="true" />{t('Stop sharing', 'शेयरिंग रोकें')}</button>}
        {!arrived && !sharing && share.status !== 'denied' && <button className="btn ghost sm" onClick={resume}><RefreshCw size={14} aria-hidden="true" />{t('Resume sharing', 'शेयरिंग फिर शुरू')}</button>}
      </div>
    </div>
  );
}
