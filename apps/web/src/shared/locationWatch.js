import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { isNative } from './native.js';

/**
 * One GPS source for every platform. onFix({lat,lng,accuracy,speed,heading,ts}) | onError({code:'DENIED'|'UNAVAILABLE'|'FAILED'}).
 *  - Native app: background watcher (Android foreground service / iOS background location) when the plugin is installed,
 *    otherwise the foreground-only Capacitor Geolocation watch.
 *  - Browser: navigator.geolocation.watchPosition (foreground tab only: browsers pause GPS when the page is hidden).
 * Returns { stop(), background } .  Always call stop(): it releases the GPS and removes the persistent notification.
 */
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

export async function watchPosition({ onFix, onError, distanceFilter = 15, background = true, title = 'Dialoo Partner', message = 'Live location sharing is active for your current booking.' }) {
  if (isNative()) {
    if (background && Capacitor.isPluginAvailable('BackgroundGeolocation')) {
      try {
        const id = await BackgroundGeolocation.addWatcher(
          { backgroundTitle: title, backgroundMessage: message, requestPermissions: true, stale: false, distanceFilter },
          (loc, err) => {
            if (err) return onError({ code: err.code === 'NOT_AUTHORIZED' ? 'DENIED' : 'FAILED', message: err.message });
            if (loc) onFix({ lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy, speed: loc.speed ?? null, heading: loc.bearing ?? null, ts: loc.time || Date.now() });
          },
        );
        return { background: true, stop: () => BackgroundGeolocation.removeWatcher({ id }).catch(() => {}) };
      } catch (e) { /* fall through to the foreground watcher */ }
    }
    let perm = await Geolocation.checkPermissions();
    const ok = (p) => p.location === 'granted' || p.coarseLocation === 'granted';
    if (!ok(perm)) perm = await Geolocation.requestPermissions({ permissions: ['location'] });
    if (!ok(perm)) { onError({ code: 'DENIED' }); return { background: false, stop() {} }; }
    const wid = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }, (p, err) => {
      if (err || !p) return onError({ code: 'FAILED', message: err && err.message });
      onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, speed: p.coords.speed ?? null, heading: p.coords.heading ?? null, ts: p.timestamp || Date.now() });
    });
    return { background: false, stop: () => Geolocation.clearWatch({ id: wid }).catch(() => {}) };
  }
  if (!navigator.geolocation) { onError({ code: 'UNAVAILABLE' }); return { background: false, stop() {} }; }
  const wid = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, speed: p.coords.speed ?? null, heading: p.coords.heading ?? null, ts: p.timestamp || Date.now() }),
    (err) => onError({ code: err.code === 1 ? 'DENIED' : err.code === 2 ? 'UNAVAILABLE' : 'FAILED', message: err.message }),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
  );
  return { background: false, stop: () => navigator.geolocation.clearWatch(wid) };
}
