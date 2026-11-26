import React, {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, BadgeCheck, Bell, Briefcase, CheckCircle2, ChevronDown, ClipboardList, Download, Eye, EyeOff, Globe, House, Languages, Layers, Lock, MapPin, MessageCircle, Pencil, Search, ShieldCheck, Smartphone, Star, UserRound, Zap} from 'lucide-react';
import {authApi} from '../../shared/api.js';
import {isNative} from '../../shared/native.js';
import {TERMS_VERSION} from '../legal/termsContent.js';
import './login.css';

const COPY = {
  en: {
    navHome: 'Home', navFeatures: 'Features', navHow: 'How it Works', navPro: 'For Professionals', navPricing: 'Pricing', getApp: 'Get the App', installHelp: 'Open your browser menu and choose “Add to Home screen” to install Dialoo.',
    pill: 'All-in-One Local Services Platform', h1a: 'Local help,', h1b: 'when you ', h1c: 'need it.', heroSub: 'Find trusted local professionals, book services in a few taps, and get work done at your doorstep.',
    f1: 'Verified Professionals', f1s: 'Trusted & checked by Dialoo', f2: 'Quick Booking', f2s: 'Book in just a few taps', f3: 'Safe & Private', f3s: 'Your number stays secure', f4: 'Local & Reliable', f4s: 'Support from nearby experts',
    howTitle: 'How it works', h1t: 'Choose a service', h1s: 'Pick from 40+ local categories', h2t: 'Book a professional', h2s: 'Compare, chat and confirm', h3t: 'Get it done', h3s: 'Track arrival, pay after the work',
    s1: '40+', s1l: 'Service categories', s2: 'All UP', s2l: 'Cities covered', s3: 'हिन्दी + EN', s3l: 'Two languages', s4: 'OTP', s4l: 'Secure login',
    title: 'Welcome to Dialoo', sub: 'Book local services or offer your skills. Let’s get started!', titleNew: 'Create your account', subNew: 'Enter your mobile number. We’ll send an OTP and set up your account.',
    newUser: 'New User? Sign Up', oldUser: 'Have an account? Log in',
    customer: 'Customer', customerSub: 'Book services', partner: 'Dialoo Partner', partnerSub: 'Get work & grow', loginAs: 'Log in as',
    partnerNote: 'Free for Partners during launch. Paid plans may start later, with at least 30 days’ notice.', partnerNoteLink: 'Partner Terms',
    mobile: 'Mobile number', mobilePh: '10-digit mobile number', send: 'Send OTP', sending: 'Sending…',
    otpTitle: 'Verify your number', otpSub: 'Enter the 6-digit code sent to', verify: 'Verify & continue', verifying: 'Verifying…',
    change: 'Change number', resendIn: 'Resend OTP in', resend: 'Resend OTP', expires: 'Code is valid for 5 minutes.',
    nameTitle: 'One last step', nameSub: 'What should we call you?', name: 'Your name', namePh: 'Full name', cont: 'Continue', skip: 'Skip for now',
    usePwd: 'Log in with password instead', useOtp: 'Use OTP instead', pwd: 'Password', pwdPh: 'Enter your password', login: 'Log in', loggingIn: 'Logging in…',
    google: 'Continue with Google', soon: 'Soon', guest: 'Continue as Guest', partnerInfo: 'How the Partner program works', or: 'or',
    privacy: 'Your number stays private and secure', secure: 'Secured with one-time password',
    termsPre: 'By continuing you agree to Dialoo’s', terms: 'Terms of Use', and: 'and', privacyPolicy: 'Privacy Policy',
    badMobile: 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.', badOtp: 'Enter all 6 digits of the OTP.', devHint: 'Development mode — your OTP is', fill: 'Autofill',
    mobileOrEmail: 'Mobile number or email address', forgot: 'Forgot password?', back: 'Back to login',
  },
  hi: {
    navHome: 'होम', navFeatures: 'फ़ीचर', navHow: 'कैसे काम करता है', navPro: 'प्रोफेशनल्स के लिए', navPricing: 'प्राइसिंग', getApp: 'ऐप पाएँ', installHelp: 'ब्राउज़र मेन्यू खोलकर “Add to Home screen” चुनें और Dialoo इंस्टॉल करें।',
    pill: 'ऑल-इन-वन लोकल सर्विस प्लेटफ़ॉर्म', h1a: 'लोकल मदद,', h1b: 'जब ', h1c: 'ज़रूरत हो।', heroSub: 'भरोसेमंद लोकल प्रोफेशनल खोजें, कुछ ही टैप में बुक करें, और काम अपने दरवाज़े पर करवाएँ।',
    f1: 'वेरिफ़ाइड प्रोफेशनल', f1s: 'Dialoo द्वारा जाँचे हुए', f2: 'तुरंत बुकिंग', f2s: 'बस कुछ टैप में बुक करें', f3: 'सुरक्षित और निजी', f3s: 'आपका नंबर सुरक्षित रहता है', f4: 'लोकल और भरोसेमंद', f4s: 'आस-पास के एक्सपर्ट से मदद',
    howTitle: 'कैसे काम करता है', h1t: 'सर्विस चुनें', h1s: '40+ लोकल श्रेणियों में से', h2t: 'प्रोफेशनल बुक करें', h2s: 'देखें, चैट करें, कन्फ़र्म करें', h3t: 'काम करवाएँ', h3s: 'आगमन ट्रैक करें, काम के बाद भुगतान',
    s1: '40+', s1l: 'सर्विस श्रेणियाँ', s2: 'पूरा UP', s2l: 'शहर शामिल', s3: 'हिन्दी + EN', s3l: 'दो भाषाएँ', s4: 'OTP', s4l: 'सुरक्षित लॉगिन',
    title: 'Dialoo में आपका स्वागत है', sub: 'लोकल सर्विस बुक करें या अपना हुनर दिखाएँ। चलिए शुरू करें!', titleNew: 'अपना अकाउंट बनाएँ', subNew: 'अपना मोबाइल नंबर डालें। हम OTP भेजकर अकाउंट बना देंगे।',
    newUser: 'नए हैं? साइन अप', oldUser: 'अकाउंट है? लॉग इन',
    customer: 'कस्टमर', customerSub: 'सर्विस बुक करें', partner: 'Dialoo पार्टनर', partnerSub: 'काम पाएँ, आगे बढ़ें', loginAs: 'लॉगिन का प्रकार',
    partnerNote: 'लॉन्च के दौरान पार्टनर के लिए फ़्री। पेड प्लान बाद में आ सकते हैं, कम से कम 30 दिन की सूचना के साथ।', partnerNoteLink: 'पार्टनर शर्तें',
    mobile: 'मोबाइल नंबर', mobilePh: '10 अंकों का मोबाइल नंबर', send: 'OTP भेजें', sending: 'भेजा जा रहा है…',
    otpTitle: 'अपना नंबर वेरिफ़ाई करें', otpSub: 'इस नंबर पर भेजा गया 6 अंकों का कोड डालें', verify: 'वेरिफ़ाई करें', verifying: 'जाँच हो रही है…',
    change: 'नंबर बदलें', resendIn: 'दोबारा OTP भेजें', resend: 'OTP दोबारा भेजें', expires: 'कोड 5 मिनट तक मान्य है।',
    nameTitle: 'बस एक आख़िरी स्टेप', nameSub: 'हम आपको किस नाम से बुलाएँ?', name: 'आपका नाम', namePh: 'पूरा नाम', cont: 'आगे बढ़ें', skip: 'अभी छोड़ें',
    usePwd: 'पासवर्ड से लॉग इन करें', useOtp: 'OTP से लॉग इन करें', pwd: 'पासवर्ड', pwdPh: 'अपना पासवर्ड डालें', login: 'लॉग इन', loggingIn: 'लॉग इन हो रहा है…',
    google: 'Google से जारी रखें', soon: 'जल्द', guest: 'गेस्ट की तरह देखें', partnerInfo: 'पार्टनर प्रोग्राम कैसे काम करता है', or: 'या',
    privacy: 'आपका नंबर सुरक्षित और निजी रहता है', secure: 'वन-टाइम पासवर्ड से सुरक्षित',
    termsPre: 'आगे बढ़कर आप Dialoo की', terms: 'उपयोग की शर्तें', and: 'और', privacyPolicy: 'गोपनीयता नीति',
    badMobile: '6, 7, 8 या 9 से शुरू होने वाला सही 10 अंकों का नंबर डालें।', badOtp: 'OTP के सभी 6 अंक डालें।', devHint: 'डेवलपमेंट मोड — आपका OTP है', fill: 'भरें',
    mobileOrEmail: 'मोबाइल नंबर या ईमेल', forgot: 'पासवर्ड भूल गए?', back: 'लॉगिन पर वापस',
  },
};
// hi: terms line reads "…Dialoo की [उपयोग की शर्तें] और [गोपनीयता नीति] से सहमत होते हैं।"
const AGREE_TAIL = {en: '.', hi: ' से सहमत होते हैं।'};

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6C12.3 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z"/><path fill="#FBBC05" d="M10.4 28.8A14.5 14.5 0 0 1 9.5 24c0-1.7.3-3.3.9-4.8l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.7-4-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
);

function PhoneMock() {
  const svc = [['electrician', 'Electrician'], ['plumber', 'Plumber'], ['ac-appliance-repair', 'AC Service'], ['carpenter', 'Carpenter'], ['house-cleaning', 'Cleaning'], ['painter', 'Painting'], ['ro-water-purifier', 'RO Service'], ['tutor', 'Tutor']];
  const jobs = [['ac-appliance-repair', 'AC Service', 'Tomorrow, 11:00 AM', 'Confirmed', 'ok'], ['plumber', 'Plumber', '21 Nov, 3:00 PM', 'In Progress', 'warn'], ['electrician', 'Electrician', '18 Nov, 10:00 AM', 'Completed', 'done']];
  return (
    <div className="lg-phones" aria-hidden="true">
      <div className="lg-ph lg-ph-side">
        <div className="lg-ph-notch"/>
        <div className="lg-ph-body">
          <b className="lg-ph-h">My Bookings</b>
          <div className="lg-ph-tabs"><i className="on">Upcoming</i><i>Completed</i><i>Cancelled</i></div>
          {jobs.map(([ic, n, w, s, k]) => (
            <div className="lg-ph-job" key={n}><img src={`/service-icons/${ic}.webp`} alt="" loading="lazy"/><div><b>{n}</b><small>{w}</small></div><em className={k}>{s}</em></div>
          ))}
        </div>
      </div>
      <div className="lg-ph lg-ph-main">
        <div className="lg-ph-notch"/>
        <div className="lg-ph-body">
          <div className="lg-ph-bar"><img src="/dialoo-logo-wide.webp" alt="" loading="lazy"/><Bell size={13}/></div>
          <div className="lg-ph-loc"><MapPin size={11}/> Sahaswan, Budaun <ChevronDown size={10}/></div>
          <div className="lg-ph-search"><Search size={12}/> Search for services…</div>
          <div className="lg-ph-hero"><div><b>Home Services<br/>at Your Doorstep</b><small>Book verified professionals near you.</small></div><img src="/service-icons/home-maintenance.webp" alt="" loading="lazy"/></div>
          <div className="lg-ph-row"><b>Popular Services</b><span>View All ›</span></div>
          <div className="lg-ph-grid">{svc.map(([ic, n]) => <div key={n}><img src={`/service-icons/${ic}.webp`} alt="" loading="lazy"/><small>{n}</small></div>)}</div>
        </div>
        <div className="lg-ph-nav"><span className="on"><House size={14}/>Home</span><span><ClipboardList size={14}/>Bookings</span><span><MessageCircle size={14}/>Chat</span><span><UserRound size={14}/>Profile</span></div>
      </div>
    </div>
  );
}

const Skyline = () => (
  <svg className="lg-sky" viewBox="0 0 900 120" preserveAspectRatio="xMinYMax slice" aria-hidden="true">
    <g fill="#eaf1ff" stroke="#bdd0f7" strokeWidth="1.5" strokeLinejoin="round">
      <rect x="20" y="40" width="70" height="80" rx="3"/><rect x="110" y="20" width="60" height="100" rx="3"/><rect x="190" y="62" width="64" height="58" rx="3"/>
      <rect x="300" y="48" width="70" height="72" rx="3"/><path d="M392 120V72h96v48M386 72l54-22 54 22z"/>
      <rect x="520" y="12" width="64" height="108" rx="3"/><rect x="610" y="56" width="70" height="64" rx="3"/><rect x="705" y="30" width="62" height="90" rx="3"/>
      <circle cx="270" cy="70" r="20"/><circle cx="500" cy="82" r="16"/><circle cx="790" cy="62" r="24"/><circle cx="860" cy="84" r="16"/>
    </g>
    <g stroke="#bdd0f7" strokeWidth="2.5" fill="none" strokeLinecap="round">
      <path d="M270 90v30M500 98v22M790 86v34M860 100v20"/>
      <path d="M36 62h10M54 62h10M36 80h10M54 80h10M126 40h10M144 40h10M126 60h10M144 60h10M126 80h10M144 80h10M536 34h10M554 34h10M536 56h10M554 56h10M536 78h10M554 78h10"/>
    </g>
  </svg>
);

export default function LoginPage({lang, setLang, onSuccess: onSuccessRaw, onGuest}) {
  const t = COPY[lang] || COPY.en;
  const [intent, setIntent] = useState(() => localStorage.getItem('dialoo-intent') === 'provider' ? 'provider' : 'customer');
  const isPartner = intent === 'provider';
  const actor = isPartner ? 'PROVIDER' : 'CUSTOMER';
  const pick = (v) => { setIntent(v); localStorage.setItem('dialoo-intent', v); setError(''); };
  const onSuccess = (u) => onSuccessRaw(u, intent);
  const hi = lang === 'hi';
  const [signup, setSignup] = useState(false);
  const [step, setStep] = useState('mobile'); // mobile | otp | name | reset
  const [mode, setMode] = useState('otp');    // otp | password
  const [mobile, setMobile] = useState('');
  const [resetMode, setResetMode] = useState(false); const [resetOtp, setResetOtp] = useState(''); const [newPassword, setNewPassword] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState(''); const [showPwd, setShowPwd] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [shake, setShake] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [devOtp, setDevOtp] = useState('');
  const [pending, setPending] = useState(null); // verify response held while asking for name
  const [installEvt, setInstallEvt] = useState(null); const [hint, setHint] = useState(false);
  const boxes = useRef([]); const cardRef = useRef(null);

  useEffect(() => { if (resendIn <= 0) return; const id = setTimeout(() => setResendIn(s => s - 1), 1000); return () => clearTimeout(id); }, [resendIn]);
  useEffect(() => { if (step === 'otp') setTimeout(() => boxes.current[0]?.focus(), 60); }, [step]);
  useEffect(() => { const h = (e) => { e.preventDefault(); setInstallEvt(e); }; window.addEventListener('beforeinstallprompt', h); return () => window.removeEventListener('beforeinstallprompt', h); }, []);

  const validMobile = /^[6-9][0-9]{9}$/.test(mobile);
  const otpValue = digits.join('');
  function fail(msg) { setError(msg); setShake(true); setTimeout(() => setShake(false), 450); }
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block: 'start'});
  const toTop = () => window.scrollTo({top: 0, behavior: 'smooth'});
  const forPros = () => { pick('provider'); cardRef.current?.scrollIntoView({behavior: 'smooth', block: 'center'}); };
  async function getApp() { if (installEvt) { installEvt.prompt(); setInstallEvt(null); } else setHint(h => !h); }

  async function sendOtp(e) {
    e?.preventDefault(); setError('');
    if (!validMobile) return fail(t.badMobile);
    setBusy(true);
    try {
      const r = await authApi.requestOtp(mobile);
      setDevOtp(r.devOtp || ''); setDigits(['', '', '', '', '', '']); setResendIn(r.resendInSeconds || 30); setStep('otp');
    } catch (err) {
      if (err.status === 429 && err.retryAfter && err.retryAfter <= 120) { setResendIn(err.retryAfter); setStep('otp'); setDigits(['', '', '', '', '', '']); }
      if (err.status !== 429) setDevOtp('');
      fail(err.message);
    } finally { setBusy(false); }
  }

  async function verify(code = otpValue) {
    setError('');
    if (code.length !== 6) return fail(t.badOtp);
    setBusy(true);
    try {
      const r = await authApi.verifyOtp(mobile, code, actor);
      if (r.isNewUser) { setPending(r); setStep('name'); } else onSuccess(r.user);
    } catch (err) { setDigits(['', '', '', '', '', '']); setTimeout(() => boxes.current[0]?.focus(), 30); fail(err.message); }
    finally { setBusy(false); }
  }

  function setDigit(i, v) {
    const d = v.replace(/[^0-9]/g, '').slice(-1); setError('');
    const next = [...digits]; next[i] = d; setDigits(next);
    if (d && i < 5) boxes.current[i + 1]?.focus();
    if (d && i === 5 && next.every(Boolean)) verify(next.join(''));
  }
  function onKey(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) { boxes.current[i - 1]?.focus(); }
    if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) boxes.current[i + 1]?.focus();
    if (e.key === 'Enter') verify();
  }
  function onPaste(e) {
    const p = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 6); if (!p) return; e.preventDefault();
    const next = ['', '', '', '', '', ''].map((_, i) => p[i] || ''); setDigits(next);
    boxes.current[Math.min(p.length, 5)]?.focus(); if (p.length === 6) verify(p);
  }

  async function passwordLogin(e) {
    e.preventDefault(); setError('');
    if (!(validMobile || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mobile.trim()))) return fail('Enter a valid mobile number or email address.');
    if (!password) return fail(t.pwdPh);
    setBusy(true);
    try { const r = await authApi.login({phone: mobile, password, actor}); onSuccess(r.user); }
    catch (err) { fail(err.message); } finally { setBusy(false); }
  }

  async function saveName(e) {
    e?.preventDefault(); setBusy(true);
    try { if (name.trim().length >= 2) { await authApi.updateMe({fullName: name.trim()}); onSuccess({...pending.user, full_name: name.trim()}); } else onSuccess(pending.user); }
    catch (err) { fail(err.message); } finally { setBusy(false); }
  }

  const spinner = <span className="lg-spin" aria-hidden="true"/>;
  const feats = [[BadgeCheck, t.f1, t.f1s, ''], [Zap, t.f2, t.f2s, ''], [Lock, t.f3, t.f3s, ''], [Star, t.f4, t.f4s, 'gold']];
  const stats = [[Layers, t.s1, t.s1l], [MapPin, t.s2, t.s2l], [Languages, t.s3, t.s3l], [ShieldCheck, t.s4, t.s4l]];
  const logoRow = (
    <div className="lg-cardhead">
      <img className="lg-card-logo" src="/dialoo-logo-wide.webp" alt="Dialoo"/>
      <button type="button" className="lg-chip" onClick={() => { setSignup(s => !s); setError(''); }}>{signup ? t.oldUser : t.newUser}</button>
    </div>
  );

  return (
    <div className="lg-page">
      <div className="lg-bg" aria-hidden="true"/>
      <header className="lg-nav">
        <button type="button" className="lg-nav-logo" onClick={toTop} aria-label="Dialoo"><img src="/dialoo-logo-wide.webp" alt="Dialoo"/></button>
        <nav className="lg-links" aria-label="Dialoo">
          <button type="button" onClick={toTop}>{t.navHome}</button>
          <button type="button" onClick={() => scrollTo('lg-features')}>{t.navFeatures}</button>
          <button type="button" onClick={() => scrollTo('lg-how')}>{t.navHow}</button>
          <button type="button" onClick={forPros}>{t.navPro}</button>
          <a href="#/terms?tab=partner">{t.navPricing}</a>
        </nav>
        <div className="lg-nav-right">
          <button type="button" className="lg-lang" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label="Change language"><Globe size={16} aria-hidden="true"/><span>{lang === 'en' ? 'English' : 'हिन्दी'}</span><ChevronDown size={14} aria-hidden="true"/></button>
          {!isNative() && <button type="button" className="lg-app" onClick={getApp}><Download size={16} aria-hidden="true"/><span>{t.getApp}</span></button>}
        </div>
        {hint && <p className="lg-hint" role="status">{t.installHelp}</p>}
      </header>

      <div className="lg-shell">
        <section className="lg-hero">
          <div className="lg-copy">
            <span className="lg-pillbadge">{t.pill}</span>
            <h1 className="lg-h1">{t.h1a}<br/>{t.h1b}<em>{t.h1c}<svg viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 7c40-6 100-7 196-3" fill="none" stroke="#f5b50a" strokeWidth="3.5" strokeLinecap="round"/></svg></em></h1>
            <p className="lg-hero-sub">{t.heroSub}</p>
            <ul className="lg-feats" id="lg-features">
              {feats.map(([Icon, a, b, c]) => <li key={a}><span className={'lg-ficon ' + c}><Icon size={22} aria-hidden="true"/></span><div><b>{a}</b><small>{b}</small></div></li>)}
            </ul>
          </div>
          <PhoneMock/>
          <div className="lg-how" id="lg-how">
            <h2>{t.howTitle}</h2>
            <ol>
              <li><i>1</i><div><b>{t.h1t}</b><small>{t.h1s}</small></div></li>
              <li><i>2</i><div><b>{t.h2t}</b><small>{t.h2s}</small></div></li>
              <li><i>3</i><div><b>{t.h3t}</b><small>{t.h3s}</small></div></li>
            </ol>
          </div>
          <ul className="lg-stats">
            {stats.map(([Icon, a, b]) => <li key={b}><Icon size={26} aria-hidden="true"/><div><b>{a}</b><small>{b}</small></div></li>)}
          </ul>
        </section>

        <main className="lg-side" ref={cardRef}>
          <div className={'lg-card' + (shake ? ' lg-shake' : '')}>
            {step === 'mobile' && !resetMode && (
              <form onSubmit={mode === 'otp' ? sendOtp : passwordLogin} noValidate>
                {logoRow}
                <h2 className="lg-title">{signup ? t.titleNew : t.title}{!signup && <span className="lg-wave" aria-hidden="true"> 👋</span>}</h2>
                <p className="lg-sub">{signup ? t.subNew : t.sub}</p>
                <div className="lg-role" role="radiogroup" aria-label={t.loginAs}>
                  <button type="button" role="radio" aria-checked={!isPartner} className={!isPartner ? 'on' : ''} onClick={() => pick('customer')}>
                    {!isPartner && <CheckCircle2 className="lg-tick" size={22} aria-hidden="true"/>}<UserRound size={26} aria-hidden="true"/><b>{t.customer}</b><em>{t.customerSub}</em>
                  </button>
                  <button type="button" role="radio" aria-checked={isPartner} className={isPartner ? 'on' : ''} onClick={() => pick('provider')}>
                    {isPartner && <CheckCircle2 className="lg-tick" size={22} aria-hidden="true"/>}<Briefcase size={26} aria-hidden="true"/><b>{t.partner}</b><em>{t.partnerSub}</em>
                  </button>
                </div>
                {isPartner && <p className="lg-pnote" role="note"><BadgeCheck size={16} aria-hidden="true"/><span>{t.partnerNote} <a href="#/terms?tab=partner">{t.partnerNoteLink}</a></span></p>}

                <label className="lg-label" htmlFor="lg-mobile">{mode === 'otp' ? t.mobile : t.mobileOrEmail}</label>
                <div className={'lg-phone' + (error && !validMobile && mode === 'otp' ? ' lg-invalid' : '')}>
                  {mode === 'otp' && <span className="lg-cc"><Smartphone size={18} aria-hidden="true"/>+91</span>}
                  <input id="lg-mobile" type={mode === 'otp' ? 'tel' : 'text'} inputMode={mode === 'otp' ? 'numeric' : 'email'} autoComplete={mode === 'otp' ? 'tel-national' : 'username'} maxLength={190}
                    value={mobile} onChange={e => { setMobile(mode === 'otp' ? e.target.value.replace(/[^0-9]/g, '').slice(0, 10) : e.target.value.slice(0, 190)); setError(''); }} placeholder={mode === 'otp' ? t.mobilePh : t.mobileOrEmail}/>
                  {validMobile && mode === 'otp' && <CheckCircle2 className="lg-ok" size={18} aria-hidden="true"/>}
                </div>

                {mode === 'password' && <>
                  <label className="lg-label" htmlFor="lg-pwd">{t.pwd}</label>
                  <div className="lg-pwd">
                    <Lock size={17} aria-hidden="true"/>
                    <input id="lg-pwd" type={showPwd ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} placeholder={t.pwdPh}/>
                    <button type="button" onClick={() => setShowPwd(!showPwd)} aria-label="Show or hide password">{showPwd ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
                  </div>
                </>}

                <div className="lg-error" role="alert" aria-live="polite">{error}</div>
                <button className="lg-primary" type="submit" disabled={busy}>
                  {busy ? <>{spinner}{mode === 'otp' ? t.sending : t.loggingIn}</> : <>{mode === 'otp' ? t.send : t.login}<ArrowRight size={18} aria-hidden="true"/></>}
                </button>
                <div className="lg-links2">
                  <button type="button" className="lg-link" onClick={() => { setMode(mode === 'otp' ? 'password' : 'otp'); setError(''); }}>{mode === 'otp' ? t.usePwd : t.useOtp}</button>
                  {mode === 'password' && <button type="button" className="lg-link" onClick={() => { setResetMode(true); setError(''); setResetOtp(''); setNewPassword(''); }}>{t.forgot}</button>}
                </div>

                <div className="lg-divider"><span>{t.or}</span></div>
                <button type="button" className="lg-ghost" disabled title={t.soon}><GoogleG/>{t.google}<span className="lg-soon">{t.soon}</span></button>
                {isPartner
                  ? <a className="lg-ghost" href="#/terms?tab=partner"><Briefcase size={18} aria-hidden="true"/>{t.partnerInfo}</a>
                  : <button type="button" className="lg-ghost" onClick={onGuest}><UserRound size={18} aria-hidden="true"/>{t.guest}</button>}
                <p className="lg-privacy"><Lock size={15} aria-hidden="true"/>{t.privacy}</p>
              </form>
            )}

            {resetMode && step === 'mobile' && (
              <form onSubmit={async e => { e.preventDefault(); setError(''); if(!validMobile) return fail(t.badMobile); setBusy(true); try { const r=await authApi.requestPasswordReset(mobile); setDevOtp(r.devOtp||''); setResendIn(r.resendInSeconds||30); setResetMode(false); setStep('reset'); } catch(err){ fail(err.message||'Could not request password reset'); } finally{setBusy(false);} }}>
                <button type="button" className="lg-back" onClick={()=>{setResetMode(false);setError('');}}><ArrowLeft size={16}/> {t.back}</button>
                <div className="lg-icon"><Lock size={26}/></div><h1>Forgot password</h1><p className="lg-sub">We’ll send a reset code to your registered mobile number.</p>
                <label className="lg-label">Registered mobile number</label><div className="lg-phone"><span className="lg-cc">+91</span><input type="tel" inputMode="numeric" maxLength={10} value={mobile} onChange={e=>setMobile(e.target.value.replace(/[^0-9]/g,'').slice(0,10))} placeholder={t.mobilePh}/></div>
                <div className="lg-error" role="alert">{error}</div><button className="lg-primary" disabled={busy}>{busy?'Sending…':'Send reset OTP'}<ArrowRight size={17}/></button>
              </form>
            )}
            {step === 'reset' && (
              <form onSubmit={async e=>{e.preventDefault();setError('');if(!/^[0-9]{6}$/.test(resetOtp))return fail('Enter the 6-digit OTP.');if(newPassword.length<8)return fail('Password must be at least 8 characters.');setBusy(true);try{await authApi.resetPassword(mobile,resetOtp,newPassword);setStep('mobile');setMode('password');setResetMode(false);setPassword('');setResetOtp('');setNewPassword('');setError('Password reset. Please log in with your new password.');}catch(err){fail(err.message||'Password reset failed');}finally{setBusy(false);}}}>
                <button type="button" className="lg-back" onClick={()=>{setStep('mobile');setResetMode(true);setError('');}}><ArrowLeft size={16}/> {hi ? 'वापस' : 'Back'}</button>
                <div className="lg-icon lg-icon-green"><ShieldCheck size={26}/></div><h1>Reset password</h1><p className="lg-sub">Enter the code sent to +91 {mobile} and choose a new password.</p>
                {devOtp && <div className="lg-dev">Development OTP: <b>{devOtp}</b></div>}
                <label className="lg-label">6-digit OTP</label><input className="lg-reset-input" inputMode="numeric" maxLength={6} value={resetOtp} onChange={e=>setResetOtp(e.target.value.replace(/[^0-9]/g,'').slice(0,6))} placeholder="123456"/>
                <label className="lg-label">New password</label><input className="lg-reset-input" type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={8} placeholder="At least 8 characters"/>
                <div className="lg-error" role="alert">{error}</div><button className="lg-primary" disabled={busy}>{busy?'Resetting…':'Reset password'}<ArrowRight size={17}/></button>
              </form>
            )}
            {step === 'otp' && (
              <div>
                <button type="button" className="lg-back" onClick={() => { setStep('mobile'); setError(''); }}><ArrowLeft size={16}/>{t.change}</button>
                <div className="lg-icon lg-icon-green"><ShieldCheck size={26}/></div>
                <h1>{t.otpTitle}</h1>
                <p className="lg-sub">{t.otpSub} <b className="lg-num">+91 {mobile.slice(0, 5)} {mobile.slice(5)}</b>
                  <button type="button" className="lg-edit" onClick={() => setStep('mobile')} aria-label={t.change}><Pencil size={13}/></button></p>
                <p className="lg-as">{isPartner ? <Briefcase size={14} aria-hidden="true"/> : <UserRound size={14} aria-hidden="true"/>}{isPartner ? t.partner : t.customer}</p>

                <div className="lg-otp" onPaste={onPaste} role="group" aria-label="One-time password">
                  {digits.map((d, i) => (
                    <input key={i} ref={el => boxes.current[i] = el} className={d ? 'filled' : ''} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1}
                      autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1}`} value={d} disabled={busy}
                      onChange={e => setDigit(i, e.target.value)} onKeyDown={e => onKey(i, e)} onFocus={e => e.target.select()}/>
                  ))}
                </div>

                {devOtp && <div className="lg-dev">{t.devHint} <b>{devOtp}</b><button type="button" onClick={() => { setDigits(devOtp.split('')); verify(devOtp); }}>{t.fill}</button></div>}

                <div className="lg-error" role="alert" aria-live="polite">{error}</div>
                <button className="lg-primary" type="button" onClick={() => verify()} disabled={busy || otpValue.length !== 6}>
                  {busy ? <>{spinner}{t.verifying}</> : <>{t.verify}<ArrowRight size={18}/></>}
                </button>

                <div className="lg-resend">
                  {resendIn > 0 ? <span>{t.resendIn} <b>0:{String(resendIn).padStart(2, '0')}</b></span>
                    : <button type="button" className="lg-link" onClick={sendOtp} disabled={busy}>{t.resend}</button>}
                </div>
                <p className="lg-note">{t.expires}</p>
              </div>
            )}

            {step === 'name' && (
              <form onSubmit={saveName}>
                <div className="lg-icon lg-icon-green"><CheckCircle2 size={26}/></div>
                <h1>{t.nameTitle}</h1>
                <p className="lg-sub">{t.nameSub}</p>
                <label className="lg-label" htmlFor="lg-name">{t.name}</label>
                <div className="lg-pwd"><input id="lg-name" autoFocus autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder={t.namePh} maxLength={120}/></div>
                <div className="lg-error" role="alert" aria-live="polite">{error}</div>
                <button className="lg-primary" type="submit" disabled={busy}>{busy ? <>{spinner}</> : <>{t.cont}<ArrowRight size={18}/></>}</button>
                <button type="button" className="lg-link" onClick={() => onSuccess(pending.user)}>{t.skip}</button>
              </form>
            )}
          </div>

          <p className="lg-terms">
            {t.termsPre} <a href="#/terms">{t.terms}</a>{isPartner && <>, <a href="#/terms?tab=partner">{t.partnerNoteLink}</a></>} {t.and} <a href="#/terms?tab=privacy">{t.privacyPolicy}</a>{AGREE_TAIL[lang] || '.'}
            <span className="lg-ver"> v{TERMS_VERSION}</span>
          </p>
          <p className="lg-secure"><Lock size={12} aria-hidden="true"/> {t.secure}</p>
        </main>
      </div>
      <Skyline/>
    </div>
  );
}
