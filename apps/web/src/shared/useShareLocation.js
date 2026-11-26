import { useEffect, useState } from 'react';
import { customerApi } from './api.js';
import { getPosition } from './native.js';

/**
 * Partner app: while at least one booking is ON_THE_WAY, send the phone's GPS position every 10 s.
 * Stops automatically when the trip ends (or the booking leaves ON_THE_WAY). Foreground only (see docs).
 */
export function useShareLocation(bookingIds) {
  const [state, setState] = useState({ status: 'idle' });
  const key = bookingIds.join(',');
  useEffect(() => {
    if (!bookingIds.length) { setState({ status: 'idle' }); return undefined; }
    let stop = false;
    const send = async () => {
      try {
        const p = await getPosition(10000, 5000);
        if (stop) return;
        await Promise.all(bookingIds.map((id) => customerApi.sendLocation(id, { latitude: p.lat, longitude: p.lng, accuracy: p.accuracy })));
        if (!stop) setState({ status: 'live', at: Date.now() });
      } catch (e) {
        if (!stop) setState({ status: e.code === 'DENIED' ? 'denied' : 'error', message: e.message });
      }
    };
    send();
    const iv = setInterval(send, 10000);
    return () => { stop = true; clearInterval(iv); };
  }, [key]); // eslint-disable-line
  return state;
}
