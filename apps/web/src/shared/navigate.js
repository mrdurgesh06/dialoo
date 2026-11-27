import { isNative } from './native.js';

/** Opens Google Maps turn-by-turn navigation (universal Maps URL, no paid SDK). Location sharing keeps running in the background service. */
export function openNavigation(lat, lng) {
  if (lat == null || lng == null) return false;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`;
  window.open(url, isNative() ? '_system' : '_blank', 'noopener');
  return true;
}
