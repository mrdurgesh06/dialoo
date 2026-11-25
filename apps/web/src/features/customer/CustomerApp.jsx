import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardList, Compass, HardHat, House, Languages, Loader2, MapPin, Store, UserRound } from 'lucide-react';
import LoginPage from '../auth/LoginPage.jsx';
import { authApi, catalogApi, customerApi, geoApi, getToken, providerApi, setSession } from '../../shared/api.js';
import { getPosition } from '../../shared/native.js';
import { go, useRoute } from '../../shared/router.js';
import { LangContext, OfflineBanner, Sheet, ToastHost, StatusBadge, useToast, usePolling } from '../../shared/ui.jsx';
import Browse from './Browse.jsx';
import Bookings, { ACTIVE } from './Bookings.jsx';
import Checkout from './Checkout.jsx';
import Home from './Home.jsx';
import { Bell, NotificationList, SearchBox, useFavourites } from '../../shared/parts.jsx';
import ProviderDashboard, { BecomeProvider } from '../provider/ProviderDashboard.jsx';
import ProviderPage from '../provider/ProviderPage.jsx';
import { Emergency, Profile, Projects, Rentals } from './More.jsx';
import Tracking from './Tracking.jsx';
import '../../styles/shell.css';

export default function CustomerApp() {
  const [lang, setLang] = useState(() => localStorage.getItem('dialoo-lang') || 'en');
  const t = useMemo(() => (en, hi) => (lang === 'hi' && hi ? hi : en), [lang]);
  useEffect(() => localStorage.setItem('dialoo-lang', lang), [lang]);
  return (
    <LangContext.Provider value={{ lang, t }}>
      <ToastHost><Shell lang={lang} setLang={setLang} /></ToastHost>
    </LangContext.Provider>
  );
}

function Shell({ lang, setLang }) {
  const t = (en, hi) => (lang === 'hi' && hi ? hi : en);
  const toast = useToast(); const route = useRoute();
  const [view, setView] = useState(() => (getToken() ? 'loading' : sessionStorage.getItem('dialoo-guest') ? 'app' : 'login'));
  const [user, setUser] = useState(null); const [flags, setFlags] = useState({}); const [cities, setCities] = useState([]);
  const [city, setCity] = useState(() => { try { return JSON.parse(localStorage.getItem('dialoo-city')); } catch { return null; } });
  const [q, setQ] = useState(''); const [cityQ, setCityQ] = useState(''); const [bell, setBell] = useState(false); const [target, setTarget] = useState(null); const [cityPick, setCityPick] = useState(false);
  const [active, setActive] = useState([]); const [isProvider, setIsProvider] = useState(false);
  const [favs, toggleFav] = useFavourites(!!user);
  // sidebar: expanded 240px / collapsed 72px, remembered in localStorage (tablets start collapsed)
  const [collapsed, setCollapsed] = useState(() => { try { const v = localStorage.getItem('dialoo-sidebar'); if (v === '1' || v === '0') return v === '1'; } catch { /* ignore */ } return window.innerWidth < 1100; });
  const toggleSidebar = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem('dialoo-sidebar', n ? '1' : '0'); } catch { /* ignore */ } return n; });
  // ---- automatic location (Uber / Rapido style): GPS -> address -> nearest launched city ----
  const [loc, setLoc] = useState(() => { try { return { status: 'idle', ...(JSON.parse(localStorage.getItem('dialoo-loc')) || {}) }; } catch { return { status: 'idle' }; } });
  const detect = async (manual = false) => {
    setLoc((l) => ({ ...l, status: 'loading' }));
    try {
      const p = await getPosition();
      let place = null;
      try { place = await geoApi.reverse(p.lat, p.lng); } catch { /* offline: keep coordinates only */ }
      const next = { status: 'ok', pos: p, place };
      setLoc(next); try { localStorage.setItem('dialoo-loc', JSON.stringify({ pos: p, place })); } catch { /* ignore */ }
      if (place && place.cityId) {
        if (place.serviceable) {
          const c = cities.find((x) => x.id === place.cityId);
          if (c && (manual || !sessionStorage.getItem('dialoo-city-manual'))) { setCity(c); if (manual) sessionStorage.removeItem('dialoo-city-manual'); }
        } else if (manual) toast(t(`Dialoo is not in your area yet. Showing ${place.cityName}.`, `Dialoo अभी आपके इलाके में नहीं है। ${place.cityName} दिखा रहे हैं।`), 'info');
      }
      return next;
    } catch (e) {
      setLoc((l) => ({ ...l, status: e.code === 'DENIED' ? 'denied' : 'error' }));
      if (manual) toast(e.code === 'DENIED' ? t('Location is off. Turn it on in your phone settings.', 'लोकेशन बंद है। फ़ोन सेटिंग्स में चालू करें।') : t('Could not get your location. Try again outdoors.', 'लोकेशन नहीं मिली। फिर से कोशिश करें।'), 'err');
      throw e;
    }
  };
  useEffect(() => { if (view === 'app' && cities.length && !loc.autoTried) { setLoc((l) => ({ ...l, autoTried: true })); detect(false).catch(() => {}); } }, [view, cities.length]); // eslint-disable-line

  useEffect(() => { if (view !== 'loading') return; authApi.me().then((u) => { setUser(u); setView('app'); }).catch(() => { setSession(null); setView('login'); }); }, []); // eslint-disable-line
  useEffect(() => { catalogApi.flags().then(setFlags).catch(() => {}); catalogApi.cities().then((c) => { setCities(c); setCity((cur) => cur || c[0] || null); }); }, []);
  useEffect(() => { if (city) localStorage.setItem('dialoo-city', JSON.stringify(city)); }, [city]);
  useEffect(() => { if (user) providerApi.me().then(() => setIsProvider(true)).catch(() => setIsProvider(false)); else setIsProvider(false); }, [user]);
  usePolling(() => customerApi.bookings().then((b) => setActive(b.filter((x) => ACTIVE.includes(x.status)))), 10000, [user], !!user);

  const needLogin = () => { sessionStorage.removeItem('dialoo-guest'); setView('login'); };
  const logout = async () => { await authApi.logout(); sessionStorage.removeItem('dialoo-guest'); setUser(null); setActive([]); setView('login'); go('/'); };
  const book = (provider, serviceId) => { if (!user) { toast(t('Please sign in to book', 'बुक करने के लिए साइन इन करें'), 'info'); return needLogin(); } setTarget({ provider, serviceId }); };

  if (view === 'loading') return <div className="splash"><img src="/dialoo-logo.jpeg" alt="Dialoo" /></div>;
  if (view === 'login') return <LoginPage lang={lang} setLang={setLang} onSuccess={(u, intent) => { setUser(u); setView('app'); go(intent === 'provider' ? '/pro' : '/'); toast(t('Welcome to Dialoo!', 'Dialoo में आपका स्वागत है!'), 'ok'); }} onGuest={() => { sessionStorage.setItem('dialoo-guest', '1'); setView('app'); }} />;

  const [p0, p1] = route.path;
  let page;
  if (!p0) page = <Home city={city} user={user} favs={favs} onFav={toggleFav} onBook={book} flags={flags} userPos={loc.pos} />;
  else if (p0 === 'browse') page = <Browse query={route.query} city={city} favs={favs} onFav={toggleFav} onBook={book} userPos={loc.pos} />;
  else if (p0 === 'provider') page = <ProviderPage id={p1} fav={favs.includes(Number(p1))} onFav={toggleFav} onBook={(p, s) => book({ ...p, price_from: p.price_from }, s)} />;
  else if (p0 === 'bookings') page = user ? <Bookings /> : <Profile user={null} favs={[]} onNeedLogin={needLogin} />;
  else if (p0 === 'booking') page = user ? <Tracking id={p1} /> : <Profile user={null} favs={[]} onNeedLogin={needLogin} />;
  else if (p0 === 'notifications') page = user ? <><h1 className="page-title">{t('Notifications', 'सूचनाएँ')}</h1><NotificationList /></> : <Profile user={null} favs={[]} onNeedLogin={needLogin} />;
  else if (p0 === 'emergency') page = <Emergency user={user} onNeedLogin={needLogin} />;
  else if (p0 === 'rentals') page = <Rentals user={user} onNeedLogin={needLogin} city={city} />;
  else if (p0 === 'projects') page = <Projects user={user} onNeedLogin={needLogin} city={city} />;
  else if (p0 === 'become-provider') page = <BecomeProvider user={user} onNeedLogin={needLogin} onLocate={() => detect(true)} />;
  else if (p0 === 'pro') page = <ProviderDashboard user={user} onNeedLogin={needLogin} />;
  else if (p0 === 'profile') page = <Profile user={user} favs={favs} onFav={toggleFav} onBook={book} onLogout={logout} onNeedLogin={needLogin} lang={lang} setLang={setLang} isProvider={isProvider} />;
  else page = <div className="empty"><h3>Page not found</h3><button className="btn primary" onClick={() => go('/')}>Home</button></div>;

  const nav = [['/', House, t('Home', 'होम'), !p0], ['/browse', Compass, t('Explore', 'खोजें'), p0 === 'browse'], ['/bookings', ClipboardList, t('Bookings', 'बुकिंग'), p0 === 'bookings' || p0 === 'booking'], ['/profile', UserRound, t('Account', 'अकाउंट'), p0 === 'profile']];
  if (isProvider) nav.splice(3, 0, ['/pro', HardHat, t('Partner', 'पार्टनर'), p0 === 'pro']);
  const navButtons = nav.map(([to, Icon, label, on]) => <button key={to} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} onClick={() => go(to)}><Icon size={20} strokeWidth={on ? 2.4 : 2} aria-hidden="true" /><span>{label}</span></button>);
  const live = active[0];
  const sideMain = [['/', House, t('Home', 'होम'), !p0, 0], ['/browse', Compass, t('Explore', 'खोजें'), p0 === 'browse', 0], ['/bookings', ClipboardList, t('Bookings', 'बुकिंग'), p0 === 'bookings' || p0 === 'booking', active.length]];
  const sideMore = [isProvider ? ['/pro', HardHat, t('Partner', 'पार्टनर'), p0 === 'pro', 0] : ['/become-provider', Store, t('Become a Partner', 'पार्टनर बनें'), p0 === 'become-provider', 0], ['/profile', UserRound, t('Account', 'अकाउंट'), p0 === 'profile', 0]];
  const sideItem = ([to, Icon, label, on, n]) => (
    <button key={to} className={`side-item ${on ? 'on' : ''}`} data-tip={label} aria-current={on ? 'page' : undefined} onClick={() => go(to)}>
      <Icon size={20} strokeWidth={on ? 2.3 : 2} aria-hidden="true" /><span className="lbl">{label}</span>{n > 0 && <i className="count" aria-label={`${n} ${t('active', 'चालू')}`}>{n}</i>}
    </button>
  );
  const initials = (user?.full_name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U';

  return (
    <div className={`shell app-shell ${collapsed ? 'collapsed' : ''}`}>
      <OfflineBanner />
      <header className="topbar">
        <button className="brand" onClick={() => go('/')} aria-label="Dialoo home"><img src="/dialoo-logo-wide.webp" alt="Dialoo" /></button>
        <button className="icon-btn side-toggle" onClick={toggleSidebar} aria-label={collapsed ? t('Expand sidebar', 'साइडबार खोलें') : t('Collapse sidebar', 'साइडबार छोटा करें')} aria-expanded={!collapsed}>{collapsed ? <ChevronsRight size={19} aria-hidden="true" /> : <ChevronsLeft size={19} aria-hidden="true" />}</button>
        <button className="city-pill" onClick={() => setCityPick(true)} aria-label={t('Change location', 'लोकेशन बदलें')}><MapPin size={16} aria-hidden="true" /><b>{loc.place?.locality && loc.place.serviceable !== false ? `${loc.place.locality}, ` : ''}{city?.name || t('Select city', 'शहर चुनें')}</b>{loc.status === 'loading' ? <Loader2 className="spin-ico" size={15} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</button>
        <div className="top-search"><SearchBox value={q} onChange={setQ} onSubmit={(v) => go(`/browse?q=${encodeURIComponent(v)}`)} /></div>
        <div className="top-actions">
          <button className="icon-btn lang" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label="Change language"><Languages size={17} aria-hidden="true" /><span>{lang === 'en' ? 'हि' : 'EN'}</span></button>
          {user ? <><Bell signedIn={!!user} onOpen={() => setBell(true)} /><button className="avatar-btn" onClick={() => go('/profile')} aria-label={t('My account', 'मेरा अकाउंट')} title={user.full_name}>{initials}</button></> : <button className="btn primary sm" onClick={needLogin}>{t('Sign in', 'साइन इन')}</button>}
        </div>
      </header>
      <aside className="sidenav">
        <button className="side-brand" onClick={() => go('/')} aria-label="Dialoo home"><img className="logo-wide" src="/dialoo-logo-wide.webp" alt="Dialoo" /><img className="logo-mark" src="/dialoo-mark.webp" alt="" /></button>
        <nav className="side-nav" aria-label="Main">
          {sideMain.map(sideItem)}
          <hr className="side-sep" />
          {sideMore.map(sideItem)}
        </nav>
        {!isProvider && (
          <div className="side-promo">
            <img src="/service-icons/local-shops.webp" alt="" width="84" height="84" loading="lazy" />
            <b>{t('Grow your business with Dialoo', 'Dialoo के साथ अपना बिज़नेस बढ़ाएँ')}</b>
            <p>{t('Get more consumers in your city.', 'अपने शहर में ज़्यादा कंज़्यूमर पाएँ।')}</p>
            <button className="promo-btn" onClick={() => go('/become-provider')}>{t('Join as Partner', 'पार्टनर बनें')}<ArrowRight size={15} aria-hidden="true" /></button>
          </div>
        )}
      </aside>
      <main className={`content ${!p0 || p0 === 'browse' || p0 === 'pro' ? 'wide' : 'narrow'}`}>{page}</main>

      {live && p0 !== 'booking' && (
        <button className="live-bar" onClick={() => go(`/booking/${live.id}`)}>
          <span className="pulse" /><div><b>{live.business_name}</b><em>{active.length > 1 ? `${active.length} ${t('active bookings', 'चालू बुकिंग')}` : `#${live.booking_code}`}</em></div><StatusBadge status={live.status} /><i>{t('Track', 'ट्रैक')}<ChevronRight size={16} aria-hidden="true" /></i>
        </button>
      )}
      <nav className="bottomnav" aria-label="Main">{navButtons}</nav>

      <Sheet open={bell} onClose={() => setBell(false)} title={t('Notifications', 'सूचनाएँ')}><NotificationList onNavigate={(n) => { setBell(false); if (n.entity_type === 'BOOKING') go(n.audience === 'PROVIDER' ? '/pro' : `/booking/${n.entity_id}`); }} /></Sheet>
      <Sheet open={cityPick} onClose={() => setCityPick(false)} title={t('Choose your city', 'अपना शहर चुनें')}>
        <button className="btn outline block locate-btn" disabled={loc.status === 'loading'} onClick={() => detect(true).then(() => setCityPick(false)).catch(() => {})}><MapPin size={17} aria-hidden="true" /> {loc.status === 'loading' ? t('Detecting…', 'पता लगा रहे हैं…') : t('Use my current location', 'मेरी मौजूदा लोकेशन इस्तेमाल करें')}</button>
        {loc.place?.address && <p className="muted small loc-line"><MapPin size={13} aria-hidden="true" /> {loc.place.address}</p>}
        {loc.status === 'denied' && <p className="error">{t('Location permission is off. Enable it in phone Settings → Apps → Dialoo → Permissions.', 'लोकेशन की अनुमति बंद है। फ़ोन सेटिंग्स → ऐप्स → Dialoo → परमिशन में चालू करें।')}</p>}
        <input className="city-search" value={cityQ} onChange={(e) => setCityQ(e.target.value)} placeholder={t('Search your city or district…', 'अपना शहर या ज़िला खोजें…')} />
        <div className="radio-list city-list">{cities.filter((c) => !cityQ.trim() || `${c.name} ${c.district}`.toLowerCase().includes(cityQ.trim().toLowerCase())).slice(0, 120).map((c) => <label key={c.id} className={`radio ${city?.id === c.id ? 'on' : ''}`}><input type="radio" checked={city?.id === c.id} onChange={() => { sessionStorage.setItem('dialoo-city-manual', '1'); setCity(c); setCityPick(false); }} /><span>{c.name}</span><em className="muted">{c.district}</em></label>)}</div>
        <p className="muted small">{t('All Uttar Pradesh cities are listed. More states are coming soon.', 'उत्तर प्रदेश के सभी शहर उपलब्ध हैं। जल्द ही और राज्य आएँगे।')}</p>
      </Sheet>
      <Checkout target={target} user={user} loc={loc} onLocate={() => detect(true)} onClose={() => setTarget(null)} />
    </div>
  );
}
