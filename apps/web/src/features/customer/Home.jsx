import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, BadgeCheck, Check, ChevronLeft, ChevronRight, ChevronUp, Clock, Copy, Droplets, HardHat, Heart, LayoutGrid, Megaphone,
  SearchX, ShieldCheck, Siren, Star, TicketPercent, Wrench, Zap,
} from 'lucide-react';
import { catalogApi, customerApi } from '../../shared/api.js';
import { go } from '../../shared/router.js';
import { CategoryIcon, ServiceIcon } from '../../shared/icons.jsx';
import { Empty, Spinner, useT, useToast } from '../../shared/ui.jsx';
import { ProviderCard } from '../../shared/parts.jsx';
import './home.css';

/** Horizontal scroller: swipe on touch, arrow buttons on desktop. */
function Rail({ children }) {
  const t = useT(); const ref = useRef(null);
  const scroll = (dir) => { const el = ref.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' }); };
  return (
    <div className="rail-wrap">
      <button className="rail-btn prev" aria-label={t('Scroll left', 'बाएँ स्क्रॉल करें')} onClick={() => scroll(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
      <div className="rail" ref={ref}>{children}</div>
      <button className="rail-btn next" aria-label={t('Scroll right', 'दाएँ स्क्रॉल करें')} onClick={() => scroll(1)}><ChevronRight size={18} aria-hidden="true" /></button>
    </div>
  );
}

export default function Home({ city, user, favs, onFav, onBook, flags, userPos }) {
  const t = useT(); const toast = useToast();
  const [cats, setCats] = useState(null); const [banners, setBanners] = useState([]); const [coupons, setCoupons] = useState([]);
  const [now, setNow] = useState(null); const [top, setTop] = useState(null); const [again, setAgain] = useState(null);
  const bannerRail = useRef(null); const [allCats, setAllCats] = useState(false);
  const [copied, setCopied] = useState(null);
  const [tab, setTab] = useState('recent'); const [favCache, setFavCache] = useState({});

  useEffect(() => { catalogApi.categories().then(setCats).catch(() => setCats([])); catalogApi.banners().then(setBanners).catch(() => {}); catalogApi.coupons().then(setCoupons).catch(() => {}); }, []);
  useEffect(() => {
    const base = { ...(city ? { cityId: city.id } : {}), ...(userPos ? { lat: userPos.lat, lng: userPos.lng } : {}) };
    catalogApi.providers({ ...base, available: true, sort: userPos ? 'nearest' : 'fastest', size: 10 }).then(setNow).catch(() => setNow([]));
    catalogApi.providers({ ...base, sort: 'rating', size: 10 }).then(setTop).catch(() => setTop([]));
  }, [city, userPos?.lat, userPos?.lng]); // eslint-disable-line
  useEffect(() => {
    if (!user) { setAgain(null); return; }
    customerApi.bookings().then(async (bs) => {
      const ids = [...new Set(bs.filter((b) => b.status === 'COMPLETED').map((b) => b.provider_id))].slice(0, 6);
      const rows = await Promise.all(ids.map((id) => catalogApi.provider(id).catch(() => null)));
      setAgain(rows.filter(Boolean));
    }).catch(() => setAgain([]));
  }, [user]);

  // favourite providers are only fetched when that tab is opened, and each provider is fetched once
  const favIds = favs.slice(0, 6);
  useEffect(() => {
    if (!user || tab !== 'fav') return undefined;
    const missing = favIds.filter((id) => !(id in favCache));
    if (!missing.length) return undefined;
    let live = true;
    Promise.all(missing.map((id) => catalogApi.provider(id).then((r) => [id, r]).catch(() => [id, null])))
      .then((rs) => { if (live) setFavCache((c) => ({ ...c, ...Object.fromEntries(rs) })); });
    return () => { live = false; };
  }, [user, tab, favIds.join(',')]); // eslint-disable-line
  const favRows = favIds.map((id) => favCache[id]).filter(Boolean);
  const favLoading = favIds.some((id) => !(id in favCache));

  // gentle auto-scroll for the admin promo rail
  useEffect(() => {
    if (banners.length < 2) return undefined;
    const id = setInterval(() => { const el = bannerRail.current; if (!el) return; const next = el.scrollLeft + el.clientWidth * 0.85; el.scrollTo({ left: next >= el.scrollWidth - el.clientWidth ? 0 : next, behavior: 'smooth' }); }, 4500);
    return () => clearInterval(id);
  }, [banners]);

  const copy = (code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(code); setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    toast(`${code} ${t('copied — use it at checkout', 'कॉपी हुआ — चेकआउट पर लगाएँ')}`, 'ok');
  };
  const bannerClick = (b) => { if (b.coupon_code) copy(b.coupon_code); if (b.target_category_slug) go(`/browse?cat=${b.target_category_slug}`); else if (b.cta_label && /join/i.test(b.cta_label)) go('/become-provider'); };
  const bookPlumber = () => { const c = cats?.find((x) => /plumb/i.test(x.slug || x.name || '')); go(c ? `/browse?cat=${c.slug}` : `/browse?q=${encodeURIComponent('plumber')}`); };
  // the two hero promotions above replace their admin-managed twins; any other admin banner still shows below
  const extraBanners = banners.filter((b) => !/plumb/i.test(b.target_category_slug || '') && !(b.cta_label && /join/i.test(b.cta_label)));
  const promoIcon = (b) => (b.target_category_slug ? <CategoryIcon slug={b.target_category_slug} size={22} /> : b.coupon_code ? <TicketPercent size={22} aria-hidden="true" /> : <Megaphone size={22} aria-hidden="true" />);

  return (
    <div className="home">
      {/* A. hero promotions */}
      <div className="hero-grid">
        <button className="promo promo-blue" onClick={bookPlumber}>
          <span className="promo-copy"><b>{t('Plumber at your door, fast', 'प्लंबर आपके दरवाज़े पर, तुरंत')}</b><em>{t('Leakage fixed today', 'लीकेज आज ही ठीक')}</em><span className="promo-cta">{t('Book Plumber', 'प्लंबर बुक करें')}<ArrowRight size={16} aria-hidden="true" /></span></span>
          <span className="promo-art" aria-hidden="true"><Wrench size={34} /><Droplets className="promo-art-sm" size={20} /></span>
        </button>
        <button className="promo promo-orange" onClick={() => go('/become-provider')}>
          <span className="promo-copy"><b>{t('Join Dialoo as a Provider', 'Dialoo से प्रोवाइडर बनें')}</b><em>{t('Get more customers, build your digital dukaan', 'ज़्यादा ग्राहक पाएँ, अपनी डिजिटल दुकान बनाएँ')}</em><span className="promo-cta">{t('Join Now', 'अभी जुड़ें')}<ArrowRight size={16} aria-hidden="true" /></span></span>
          <span className="promo-art" aria-hidden="true"><HardHat size={36} /></span>
        </button>
      </div>

      {extraBanners.length > 0 && (
        <div className="promo-rail" ref={bannerRail}>
          {extraBanners.map((b) => (
            <button key={b.id} className="mini-promo" onClick={() => bannerClick(b)}>
              <span className="mini-ico">{promoIcon(b)}</span>
              <span className="mini-copy"><b>{b.title}</b><em>{b.subtitle}</em></span>
              {b.cta_label && <i>{b.cta_label}<ArrowRight size={14} aria-hidden="true" /></i>}
            </button>
          ))}
        </div>
      )}

      {/* D. services */}
      <section>
        <div className="sec-head"><h2>{t('Services in Minutes', 'मिनटों में सर्विस')}</h2><button className="link" onClick={() => go('/browse')}>{t('See all', 'सब देखें')}</button></div>
        {!cats ? <Spinner /> : (
          <div className="cat-grid">
            {(allCats ? cats : cats.slice(0, 11)).map((c) => (
              <button key={c.slug} className="cat" onClick={() => go(`/browse?cat=${c.slug}`)}>
                <span className="cat-ico"><ServiceIcon slug={c.slug} name={c.name} /></span><b>{c.name}</b><em><Clock size={11} aria-hidden="true" />~{c.eta_minutes} {t('min', 'मिनट')}</em>
              </button>
            ))}
            {cats.length > 11 && (
              <button className="cat more" onClick={() => setAllCats(!allCats)}>
                <span className="cat-ico">{allCats ? <ChevronUp size={26} aria-hidden="true" /> : <LayoutGrid size={26} strokeWidth={1.9} aria-hidden="true" />}</span>
                <b>{allCats ? t('Show less', 'कम दिखाएँ') : `${t('All Services', 'सभी सर्विस')} (${cats.length})`}</b>
              </button>
            )}
          </div>
        )}
      </section>

      {/* E. emergency (honours the EMERGENCY_ENABLED feature flag) */}
      {flags?.EMERGENCY_ENABLED !== false && (
        <button className="emergency-strip" onClick={() => go('/emergency')}>
          <span className="em-ico"><Siren size={24} aria-hidden="true" /></span>
          <span className="em-copy"><b>{t('Emergency Help', 'इमरजेंसी मदद')}</b><em>{t('Vehicle breakdown, electrical, water leakage — get help fast.', 'गाड़ी खराब, बिजली, पानी लीकेज — तुरंत मदद।')}</em></span>
          <ArrowRight className="em-go" size={20} aria-hidden="true" />
        </button>
      )}

      {/* F. offers */}
      {coupons.length > 0 && (
        <section>
          <div className="sec-head"><h2>{t('Offers for You', 'आपके लिए ऑफर')}</h2></div>
          <Rail>
            {coupons.map((c) => (
              <button key={c.code} className={`offer ${copied === c.code ? 'copied' : ''}`} onClick={() => copy(c.code)} aria-label={`${t('Copy code', 'कोड कॉपी करें')} ${c.code}`}>
                <span className="off-pct">{c.discount_type === 'PERCENT' ? `${Number(c.discount_value)}%` : `₹${Number(c.discount_value)}`}<small>OFF</small></span>
                <span className="offer-body">
                  <b className="offer-code">{c.code}</b><em className="offer-desc">{c.description}</em>
                  <span className="offer-copy">{copied === c.code ? <><Check size={13} aria-hidden="true" />{t('Copied', 'कॉपी हुआ')}</> : <><Copy size={13} aria-hidden="true" />{t('Tap to copy', 'कॉपी करने के लिए टैप करें')}</>}</span>
                </span>
              </button>
            ))}
          </Rail>
        </section>
      )}

      {/* G. available right now */}
      <section>
        <div className="sec-head"><h2><Zap className="sec-ico orange" size={20} aria-hidden="true" />{t('Available Right Now', 'अभी उपलब्ध')}</h2><button className="link" onClick={() => go('/browse?available=1&sort=fastest')}>{t('See all', 'सब देखें')}</button></div>
        {!now ? <Spinner /> : now.length === 0 ? <Empty icon={<Clock size={26} aria-hidden="true" />} title={t('No one is online right now', 'अभी कोई ऑनलाइन नहीं')} text={t('Try browsing all providers and schedule for later.', 'सभी प्रोवाइडर देखें और बाद के लिए शेड्यूल करें।')} /> : (
          <Rail>{now.map((p) => <ProviderCard key={p.id} p={p} compact fav={favs.includes(p.id)} onFav={onFav} onBook={onBook} />)}</Rail>
        )}
      </section>

      {/* H. top rated */}
      <section>
        <div className="sec-head"><h2><Star className="sec-ico orange" size={20} fill="currentColor" aria-hidden="true" />{t('Top Rated Near You', 'आपके पास टॉप रेटेड')}</h2><button className="link" onClick={() => go('/browse?sort=rating')}>{t('See all', 'सब देखें')}</button></div>
        {!top ? <Spinner /> : top.length === 0 ? <Empty icon={<SearchX size={26} aria-hidden="true" />} title={t('No providers in this city yet', 'इस शहर में अभी कोई प्रोवाइडर नहीं')} text={t('We are onboarding professionals. Are you one?', 'हम प्रोफेशनल जोड़ रहे हैं। क्या आप हैं?')} action={<button className="btn primary" onClick={() => go('/become-provider')}>{t('Become a provider', 'प्रोवाइडर बनें')}</button>} /> : (
          <div className="top-grid">{top.map((p) => <ProviderCard key={p.id} p={p} fav={favs.includes(p.id)} onFav={onFav} onBook={onBook} />)}</div>
        )}
      </section>

      {/* I. recent + favourite providers (signed-in customers only; real data, no placeholders) */}
      {user && (
        <section>
          <div className="sec-head"><h2><ShieldCheck className="sec-ico" size={20} aria-hidden="true" />{t('Your Trusted Professionals', 'आपके भरोसेमंद प्रोफेशनल')}</h2></div>
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={tab === 'recent'} className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>{t('Recently booked', 'हाल में बुक किए')}</button>
            <button role="tab" aria-selected={tab === 'fav'} className={tab === 'fav' ? 'on' : ''} onClick={() => setTab('fav')}><Heart size={14} aria-hidden="true" />{t('Favourites', 'पसंदीदा')}</button>
          </div>
          {tab === 'recent' ? (
            again === null ? <Spinner /> : again.length === 0 ? (
              <Empty icon={<BadgeCheck size={26} aria-hidden="true" />} title={t('No bookings yet', 'अभी कोई बुकिंग नहीं')} text={t('Professionals you book will appear here for quick rebooking.', 'जिन प्रोफेशनल को आप बुक करेंगे वे यहाँ दिखेंगे।')} action={<button className="btn primary" onClick={() => go('/browse')}>{t('Explore services', 'सर्विस खोजें')}</button>} />
            ) : <Rail>{again.map((p) => <ProviderCard key={p.id} p={p} compact bookLabel={t('Book again', 'फिर से बुक करें')} fav={favs.includes(p.id)} onFav={onFav} onBook={onBook} />)}</Rail>
          ) : (
            favIds.length === 0 ? (
              <Empty icon={<Heart size={26} aria-hidden="true" />} title={t('No favourites yet', 'अभी कोई पसंदीदा नहीं')} text={t('Tap the heart on any provider to save them here.', 'किसी प्रोवाइडर पर दिल दबाएँ, वे यहाँ सेव होंगे।')} />
            ) : favLoading && favRows.length === 0 ? <Spinner /> : (
              <Rail>{favRows.map((p) => <ProviderCard key={p.id} p={p} compact fav onFav={onFav} onBook={onBook} />)}</Rail>
            )
          )}
        </section>
      )}

      {/* J. provider onboarding */}
      <section className="join-cta">
        <span className="join-art" aria-hidden="true"><HardHat size={28} /></span>
        <div className="join-copy"><h3>{t('Are you a skilled professional?', 'क्या आप स्किल्ड प्रोफेशनल हैं?')}</h3><p>{t('Get verified, receive booking requests and grow your digital dukaan.', 'वेरिफाई हों, बुकिंग पाएँ और अपनी डिजिटल दुकान बढ़ाएँ।')}</p></div>
        <button className="btn light" onClick={() => go('/become-provider')}>{t('Join Dialoo', 'Dialoo से जुड़ें')}<ArrowRight size={16} aria-hidden="true" /></button>
      </section>
      <p className="trust-note muted">{t('Dialoo verification is a trust signal, not a guarantee of service quality.', 'Dialoo वेरिफिकेशन भरोसे का संकेत है, सेवा गुणवत्ता की गारंटी नहीं।')}</p>
    </div>
  );
}
