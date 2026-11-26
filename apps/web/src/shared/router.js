import { useEffect, useState } from 'react';

/** Tiny hash router: "#/browse?cat=electrician" -> { path: ['browse'], query: {cat:'electrician'} } */
export function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(q)), raw };
}
export function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
export const go = (to) => { window.location.hash = to; };
export const back = () => (window.history.length > 1 ? window.history.back() : go('/'));
