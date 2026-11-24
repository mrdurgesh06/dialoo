import React, { useState } from 'react';
import { customerApi } from '../../shared/api.js';
import { useT, usePolling } from '../../shared/ui.jsx';
import TrackMap from '../../shared/TrackMap.jsx';
import { Phone } from 'lucide-react';

/** Swiggy / Zomato style live card: map + orange route + ETA badge. Polls every 6 s while the booking is ON_THE_WAY. */
export default function LiveTrack({ bookingId, name, phone, fallbackEta }) {
  const t = useT();
  const [tr, setTr] = useState(null);
  usePolling(() => customerApi.tracking(bookingId).then(setTr), 6000, [bookingId], true);

  const dest = tr?.destination || null;
  const prov = tr?.provider || null;
  const route = tr?.route?.coordinates || null;
  const eta = tr?.etaMinutes;
  const km = tr?.route ? (tr.route.distanceMeters / 1000) : null;
  const estimate = tr?.route?.source === 'estimate';

  return (
    <section className="trk-card" aria-label={t('Live tracking', 'लाइव ट्रैकिंग')}>
      <TrackMap dest={dest} provider={prov} route={route} />
      {!prov && <div className="trk-warn">{t('Waiting for the Dialoo Partner’s live location…', 'Dialoo पार्टनर की लाइव लोकेशन का इंतज़ार…')}</div>}
      {prov?.stale && <div className="trk-warn">{t('Location is updating slowly — showing the last known position.', 'लोकेशन धीरे अपडेट हो रही है — आख़िरी पता दिख रहा है।')}</div>}
      <div className="trk-info">
        <div>
          <h3>{t('On the way', 'रास्ते में')}</h3>
          <p>{name} {t('is heading to your address', 'आपके पते की ओर आ रहे हैं')}{km != null ? ` · ${km.toFixed(1)} km` : ''}</p>
        </div>
        <div className="trk-eta" aria-live="polite"><b>{estimate ? '~' : ''}{eta ?? fallbackEta ?? '–'}</b><small>{t('mins', 'मिनट')}</small></div>
      </div>
      {phone && <div className="trk-foot"><span>{estimate ? t('Approximate time (live road route unavailable)', 'अनुमानित समय (सड़क रूट उपलब्ध नहीं)') : t('Updates automatically', 'अपने आप अपडेट होता है')}</span><a className="btn outline sm" href={`tel:${phone}`}><Phone size={16} aria-hidden="true" />{t('Call', 'कॉल')}</a></div>}
    </section>
  );
}
