import React from 'react';
import { Link2Off, MapPinned, MessageCircle, Phone, ShieldCheck, Star, WifiOff } from 'lucide-react';
import { useT } from '../../shared/ui.jsx';
import TrackMap from '../../shared/TrackMap.jsx';
import { useTrackingFeed } from '../../shared/useTrackingFeed.js';

const km = (m) => (m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`);
const ago = (s, t) => (s < 5 ? t('just now', 'अभी') : s < 60 ? `${s} ${t('seconds ago', 'सेकंड पहले')}` : `${Math.round(s / 60)} ${t('min ago', 'मिनट पहले')}`);

/**
 * Swiggy / Zomato style live card for a booking that is ON_THE_WAY.
 * Real-time over WebSocket, REST polling only while the socket is down. Every state of the journey has its own message:
 * waiting, live, reconnecting, slow updates, location unavailable (last known position + its real age), arrived, ended.
 */
export default function LiveTrack({ booking, onChat, onJourneyChange }) {
  const t = useT();
  const b = booking;
  const f = useTrackingFeed(b.id, { onJourneyChange });
  const snap = f.snap; const partner = snap?.partner;
  const dest = snap?.destination || null;
  const name = partner?.name || b.business_name;
  const gpsMs = (f.cfg.gpsIntervalSeconds || 10) * 1000;
  const eta = f.etaMinutes ?? snap?.etaMinutes ?? null;
  const estimate = snap?.route?.source === 'estimate';

  let state = 'WAITING';
  if (f.arrived) state = 'ARRIVED';
  else if (f.ended) state = 'ENDED';
  else if (f.journey === 'NOT_STARTED') state = 'NOT_STARTED';
  else if (!f.provider) state = 'WAITING';
  else if (f.connection === 'UNAVAILABLE') state = 'UNAVAILABLE';
  else if (f.connection === 'STALE') state = 'STALE';
  else state = 'LIVE';

  const headline = {
    NOT_STARTED: [t('Your Dialoo Partner is getting ready', 'आपका Dialoo पार्टनर तैयार हो रहा है'), t('Live location starts when they leave.', 'निकलते ही लाइव लोकेशन शुरू होगी।')],
    WAITING: [t('Your Dialoo Partner is on the way', 'आपका Dialoo पार्टनर रास्ते में है'), t('Waiting for the first live location…', 'पहली लाइव लोकेशन का इंतज़ार…')],
    LIVE: [t('Your Dialoo Partner is on the way', 'आपका Dialoo पार्टनर रास्ते में है'), eta != null ? `${t('Arriving in approximately', 'लगभग')} ${estimate ? '~' : ''}${eta} ${t('minutes', 'मिनट में पहुँचेंगे')}` : t('Calculating arrival time…', 'पहुँचने का समय निकाल रहे हैं…')],
    STALE: [t('Your Dialoo Partner is on the way', 'आपका Dialoo पार्टनर रास्ते में है'), t('Location is updating slowly — showing the last known position.', 'लोकेशन धीरे अपडेट हो रही है — आख़िरी पता दिख रहा है।')],
    UNAVAILABLE: [t('Live location is temporarily unavailable', 'लाइव लोकेशन अभी उपलब्ध नहीं'), t('Showing the last known position. Your partner is still on the way.', 'आख़िरी पता दिख रहा है। आपका पार्टनर रास्ते में ही है।')],
    ARRIVED: [t('Your Dialoo Partner has arrived', 'आपका Dialoo पार्टनर पहुँच गया है'), t('Share your 4-digit start code to begin the work.', 'काम शुरू करने के लिए 4 अंकों का स्टार्ट कोड बताएँ।')],
    ENDED: [t('Live tracking has stopped', 'लाइव ट्रैकिंग बंद हो गई'), t('Your partner may still be on the way. Call them if needed.', 'पार्टनर अभी भी रास्ते में हो सकते हैं। ज़रूरत हो तो कॉल करें।')],
  }[state];

  const showMap = ['LIVE', 'STALE', 'UNAVAILABLE', 'WAITING', 'NOT_STARTED'].includes(state) || (state === 'ARRIVED' && dest);
  return (
    <section className="trk-card" aria-label={t('Live tracking', 'लाइव ट्रैकिंग')}>
      {showMap && <TrackMap dest={dest} provider={state === 'ARRIVED' ? null : f.provider} route={state === 'LIVE' || state === 'STALE' ? f.route : null} gpsMs={gpsMs} stale={state === 'STALE' || state === 'UNAVAILABLE'} />}

      <div className="trk-badges">
        <span className={`trk-link ${f.link}`}>{f.link === 'ws' ? <><i className="dot" />{t('Live', 'लाइव')}</> : f.link === 'poll' ? <>{t('Updating every few seconds', 'कुछ सेकंड में अपडेट')}</> : <><WifiOff size={13} aria-hidden="true" />{t('Reconnecting…', 'दोबारा जुड़ रहे हैं…')}</>}</span>
        {f.ageSeconds != null && state !== 'ARRIVED' && <span className="trk-age" aria-live="off">{t('Location updated', 'लोकेशन अपडेट')} {ago(f.ageSeconds, t)}</span>}
      </div>
      {state === 'STALE' && <div className="trk-warn" role="status">{t('Updates are slower than usual.', 'अपडेट सामान्य से धीमे हैं।')}</div>}
      {state === 'UNAVAILABLE' && <div className="trk-warn" role="status"><Link2Off size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {t('No location for', 'लोकेशन नहीं मिली')} {ago(f.ageSeconds ?? 0, t)}. {t('This is the last known position, not live.', 'यह आख़िरी पता है, लाइव नहीं।')}</div>}

      <div className="trk-info">
        <div>
          <h3>{headline[0]}</h3>
          <p>{headline[1]}</p>
          {f.remainingMeters != null && state !== 'ARRIVED' && <p className="trk-dist"><MapPinned size={14} aria-hidden="true" /> {km(f.remainingMeters)} {t('away', 'दूर')}{estimate ? ` · ${t('approximate', 'अनुमानित')}` : ''}</p>}
        </div>
        {(state === 'LIVE' || state === 'STALE') && <div className="trk-eta" aria-live="polite"><b>{estimate ? '~' : ''}{eta ?? b.eta_minutes ?? '–'}</b><small>{t('mins', 'मिनट')}</small></div>}
      </div>

      <div className="trk-partner">
        <span className="trk-avatar" aria-hidden="true">{partner?.avatarEmoji || (name || 'D')[0]}</span>
        <div className="trk-pname">
          <b>{name}</b>
          <span>{partner?.verified && <><ShieldCheck size={13} aria-hidden="true" /> {t('Verified', 'वेरिफ़ाइड')} · </>}{partner && Number(partner.rating) > 0 && <><Star size={12} fill="currentColor" aria-hidden="true" /> {Number(partner.rating).toFixed(1)}</>}</span>
        </div>
        <div className="trk-actions">
          {b.provider_phone && <a className="btn outline sm" href={`tel:${b.provider_phone}`}><Phone size={16} aria-hidden="true" />{t('Call', 'कॉल')}</a>}
          {onChat && <button className="btn outline sm" onClick={onChat}><MessageCircle size={16} aria-hidden="true" />{t('Chat', 'चैट')}</button>}
        </div>
      </div>
      {dest?.address && <div className="trk-foot"><span>{t('Service address', 'सर्विस का पता')}: {dest.address}</span></div>}
    </section>
  );
}
