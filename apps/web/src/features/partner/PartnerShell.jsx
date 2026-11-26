import React, { useEffect, useState } from 'react';
import { ChevronRight, ChevronsLeft, ChevronsRight, FileText, HardHat, Languages, LogOut, Repeat, ShieldCheck, UserRound, Handshake, BadgeCheck } from 'lucide-react';
import { providerApi } from '../../shared/api.js';
import { go, useRoute } from '../../shared/router.js';
import { OfflineBanner, Sheet, useToast } from '../../shared/ui.jsx';
import { Bell, NotificationList } from '../../shared/parts.jsx';
import ProviderDashboard, { BecomeProvider } from '../provider/ProviderDashboard.jsx';
import { getPosition } from '../../shared/native.js';
import { geoApi } from '../../shared/api.js';
import '../../styles/shell.css';

/** Everything a signed-in Dialoo Partner sees. No consumer Home / Explore / Bookings / city picker lives here. */
export default function PartnerShell({ lang, setLang, user, onLogout, onSwitchToCustomer }) {
  const t = (en, hi) => (lang === 'hi' && hi ? hi : en);
  const toast = useToast(); const route = useRoute(); const [p0] = route.path;
  const [bell, setBell] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { const v = localStorage.getItem('dialoo-sidebar'); if (v === '1' || v === '0') return v === '1'; } catch { /* ignore */ } return window.innerWidth < 1100; });
  const toggleSidebar = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem('dialoo-sidebar', n ? '1' : '0'); } catch { /* ignore */ } return n; });

  // Partner side only has /pro (dashboard), /become-provider (apply), /profile and /notifications. Anything else goes to the dashboard.
  const allowed = ['pro', 'become-provider', 'profile', 'notifications'];
  useEffect(() => { if (!allowed.includes(p0)) go('/pro'); }, [p0]); // eslint-disable-line
  // No partner profile yet? Send a new partner straight to the application form.
  useEffect(() => {
    let off = false;
    providerApi.me().catch((e) => { if (!off && !e.network && p0 === 'pro') go('/become-provider'); });
    return () => { off = true; };
  }, [p0]);

  const locate = async () => {
    try { const pos = await getPosition(); let place = null; try { place = await geoApi.reverse(pos.lat, pos.lng); } catch { /* offline: coordinates only */ } return { pos, place }; }
    catch (e) { toast(e.code === 'DENIED' ? t('Location is off. Turn it on in your phone settings.', 'लोकेशन बंद है। फ़ोन सेटिंग्स में चालू करें।') : t('Could not get your location. Try again outdoors.', 'लोकेशन नहीं मिली। फिर से कोशिश करें।'), 'err'); throw e; }
  };

  let page;
  if (p0 === 'become-provider') page = <BecomeProvider user={user} onNeedLogin={onLogout} onLocate={locate} />;
  else if (p0 === 'profile') page = <PartnerAccount user={user} lang={lang} setLang={setLang} onLogout={onLogout} onSwitchToCustomer={onSwitchToCustomer} />;
  else if (p0 === 'notifications') page = <><h1 className="page-title">{t('Notifications', 'सूचनाएँ')}</h1><NotificationList onNavigate={(n) => { if (n.entity_type === 'BOOKING' || n.entity_type === 'PROVIDER') go('/pro'); }} /></>;
  else page = <ProviderDashboard user={user} onNeedLogin={onLogout} />;

  const items = [['/pro', HardHat, t('Dashboard', 'डैशबोर्ड'), p0 === 'pro' || p0 === 'become-provider'], ['/profile', UserRound, t('Account', 'अकाउंट'), p0 === 'profile']];
  const initials = (user?.full_name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'P';

  return (
    <div className={`shell app-shell partner-shell ${collapsed ? 'collapsed' : ''}`}>
      <OfflineBanner />
      <header className="topbar">
        <button className="brand" onClick={() => go('/pro')} aria-label="Dialoo Partner home"><img src="/dialoo-logo-wide.webp" alt="Dialoo" /></button>
        <button className="icon-btn side-toggle" onClick={toggleSidebar} aria-label={collapsed ? t('Expand sidebar', 'साइडबार खोलें') : t('Collapse sidebar', 'साइडबार छोटा करें')} aria-expanded={!collapsed}>{collapsed ? <ChevronsRight size={19} aria-hidden="true" /> : <ChevronsLeft size={19} aria-hidden="true" />}</button>
        <span className="role-pill"><Handshake size={16} aria-hidden="true" />{t('Dialoo Partner', 'Dialoo पार्टनर')}</span>
        <div className="top-actions">
          <button className="icon-btn lang" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label="Change language"><Languages size={17} aria-hidden="true" /><span>{lang === 'en' ? 'हि' : 'EN'}</span></button>
          <Bell signedIn onOpen={() => setBell(true)} />
          <button className="avatar-btn" onClick={() => go('/profile')} aria-label={t('My account', 'मेरा अकाउंट')} title={user?.full_name}>{initials}</button>
        </div>
      </header>
      <aside className="sidenav">
        <button className="side-brand" onClick={() => go('/pro')} aria-label="Dialoo Partner home"><img className="logo-wide" src="/dialoo-logo-wide.webp" alt="Dialoo" /><img className="logo-mark" src="/dialoo-mark.webp" alt="" /></button>
        <nav className="side-nav" aria-label="Partner">
          {items.map(([to, Icon, label, on]) => <button key={to} className={`side-item ${on ? 'on' : ''}`} data-tip={label} aria-current={on ? 'page' : undefined} onClick={() => go(to)}><Icon size={20} strokeWidth={on ? 2.3 : 2} aria-hidden="true" /><span className="lbl">{label}</span></button>)}
        </nav>
        <div className="side-promo">
          <b>{t('Free for Partners', 'पार्टनर के लिए फ़्री')}</b>
          <p>{t('Free during launch. Any future fee starts only after 30 days\' notice.', 'लॉन्च के दौरान फ़्री। भविष्य की कोई भी फ़ीस 30 दिन की सूचना के बाद ही शुरू होगी।')}</p>
          <button className="promo-btn" onClick={() => go('/terms?tab=partner')}>{t('Partner Terms', 'पार्टनर शर्तें')}<ChevronRight size={15} aria-hidden="true" /></button>
        </div>
      </aside>
      <main className={`content ${p0 === 'profile' || p0 === 'become-provider' ? 'narrow' : 'wide'}`}>
        {(p0 === 'pro' || !p0) && <div className="free-strip" role="note"><BadgeCheck size={18} aria-hidden="true" /><span>{t('Dialoo is free for Partners right now. Paid plans may start later, with at least 30 days\' notice.', 'अभी Dialoo पार्टनर के लिए फ़्री है। पेड प्लान बाद में आ सकते हैं, कम से कम 30 दिन की सूचना के साथ।')} <a href="#/terms?tab=partner">{t('Read Partner Terms', 'पार्टनर शर्तें पढ़ें')}</a></span></div>}
        {page}
      </main>
      <nav className="bottomnav" aria-label="Partner">
        {items.map(([to, Icon, label, on]) => <button key={to} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} onClick={() => go(to)}><Icon size={20} strokeWidth={on ? 2.4 : 2} aria-hidden="true" /><span>{label}</span></button>)}
      </nav>
      <Sheet open={bell} onClose={() => setBell(false)} title={t('Notifications', 'सूचनाएँ')}><NotificationList onNavigate={() => { setBell(false); go('/pro'); }} /></Sheet>
    </div>
  );
}

function PartnerAccount({ user, lang, setLang, onLogout, onSwitchToCustomer }) {
  const t = (en, hi) => (lang === 'hi' && hi ? hi : en);
  const row = (Icon, label, onClick) => <button onClick={onClick}><Icon size={20} aria-hidden="true" />{label}<i><ChevronRight size={18} aria-hidden="true" /></i></button>;
  return (
    <div>
      <section className="card profile-head"><div className="avatar xl">{(user?.full_name || 'P')[0].toUpperCase()}</div><div><h2>{user?.full_name}</h2><p className="muted">{user?.phone}{user?.email ? ` · ${user.email}` : ''}</p><span className="role-tag"><Handshake size={13} aria-hidden="true" />{t('Dialoo Partner login', 'Dialoo पार्टनर लॉगिन')}</span></div></section>
      <div className="menu">
        {row(HardHat, t('Partner dashboard', 'पार्टनर डैशबोर्ड'), () => go('/pro'))}
        {row(Languages, lang === 'en' ? 'हिन्दी में बदलें' : 'Switch to English', () => setLang(lang === 'en' ? 'hi' : 'en'))}
        {row(FileText, t('Terms of Use', 'उपयोग की शर्तें'), () => go('/terms'))}
        {row(Handshake, t('Partner Terms (free now, paid later)', 'पार्टनर शर्तें (अभी फ़्री, बाद में पेड)'), () => go('/terms?tab=partner'))}
        {row(ShieldCheck, t('Privacy Policy', 'गोपनीयता नीति'), () => go('/terms?tab=privacy'))}
        {row(Repeat, t('Switch to Customer login', 'कस्टमर लॉगिन पर जाएँ'), onSwitchToCustomer)}
      </div>
      <button className="btn danger-outline block" onClick={onLogout}><LogOut size={17} aria-hidden="true" /> {t('Log out', 'लॉग आउट')}</button>
    </div>
  );
}
