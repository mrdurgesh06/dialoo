/**
 * Loads the Google Maps JavaScript API once per page (billed as one map load per Map instance, so screens create ONE map and move markers).
 * The key is the browser key: restrict it to your web origins (HTTP referrers) and to Maps JavaScript API + Places API (New).
 * Never put the server key here.
 */
const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID';
export const mapsConfigured = () => !!KEY;

let loading = null;
let authFailed = false;
export const mapsAuthFailed = () => authFailed;

export function loadGoogleMaps(lang = 'en') {
  if (!KEY) return Promise.reject(Object.assign(new Error('Google Maps key is not configured'), { code: 'NO_KEY' }));
  if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.importLibrary) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    window.gm_authFailure = () => { authFailed = true; window.dispatchEvent(new Event('dialoo-maps-auth-failed')); };
    const cb = `__dialooMapsReady${Date.now()}`;
    window[cb] = () => { delete window[cb]; resolve(window.google.maps); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&language=${lang === 'hi' ? 'hi' : 'en'}&region=IN&callback=${cb}`;
    s.async = true; s.defer = true;
    s.onerror = () => { loading = null; reject(Object.assign(new Error('Could not load Google Maps'), { code: 'LOAD_FAILED' })); };
    document.head.appendChild(s);
  });
  return loading;
}

/** importLibrary wrapper: 'maps' | 'marker' | 'places' | 'geometry' */
export async function loadLibrary(name) {
  const maps = await loadGoogleMaps(document.documentElement.lang);
  return maps.importLibrary(name);
}
