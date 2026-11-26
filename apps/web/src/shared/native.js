import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Network } from '@capacitor/network';

export const isNative = () => { try { return Capacitor.isNativePlatform(); } catch { return false; } };

/** Vibrate lightly on important taps (native app only). */
export function haptic(style = 'light') {
  if (!isNative()) return;
  Haptics.impact({ style: style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
}

/** Current GPS position. Asks permission on first use (native) or uses the browser prompt (web). */
export async function getPosition(timeout = 12000, maxAge = 30000) {
  if (isNative()) {
    let perm = await Geolocation.checkPermissions();
    const ok = (p) => p.location === 'granted' || p.coarseLocation === 'granted';
    if (!ok(perm)) {
      perm = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (!ok(perm)) { const e = new Error('Location permission denied'); e.code = 'DENIED'; throw e; }
    }
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout, maximumAge: maxAge });
    return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { const e = new Error('Location is not supported on this device'); e.code = 'UNSUPPORTED'; return reject(e); }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => { const e = new Error(err.code === 1 ? 'Location permission denied' : 'Could not get your location'); e.code = err.code === 1 ? 'DENIED' : 'FAILED'; reject(e); },
      { enableHighAccuracy: true, timeout, maximumAge: maxAge },
    );
  });
}

/** Online/offline listener that also works inside the native WebView. Returns an unsubscribe function. */
export function watchNetwork(cb) {
  const on = () => cb(true), off = () => cb(false);
  window.addEventListener('online', on); window.addEventListener('offline', off);
  let handle = null;
  if (isNative()) Network.addListener('networkStatusChange', (s) => cb(!!s.connected)).then((h) => { handle = h; }).catch(() => {});
  return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); if (handle) handle.remove(); };
}
