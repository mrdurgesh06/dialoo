import React, { useContext, useMemo } from 'react';
import { ArrowLeft, FileText, Handshake, Languages, ShieldCheck } from 'lucide-react';
import { LangContext } from '../../shared/ui.jsx';
import { back, go, useRoute } from '../../shared/router.js';
import { CONTACT, EFFECTIVE, TABS, TERMS_VERSION } from './termsContent.js';
import './terms.css';

const ICONS = { terms: FileText, partner: Handshake, privacy: ShieldCheck };

function Block({ b }) {
  if (Array.isArray(b)) return <ul>{b.map((x, i) => <li key={i}>{x}</li>)}</ul>;
  return <p>{b}</p>;
}

/** Terms of Use / Partner Terms / Privacy Policy. Reachable without login at #/terms, #/terms?tab=partner, #/terms?tab=privacy. */
export default function TermsPage({ setLang }) {
  const { lang } = useContext(LangContext);
  const hi = lang === 'hi';
  const route = useRoute();
  const tab = TABS[route.query.tab] ? route.query.tab : 'terms';
  const data = TABS[tab];
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const toc = useMemo(() => data.sections.map((s) => ({ id: s.id, title: s.title })), [data]);

  return (
    <div className="tm-page">
      <header className="tm-top">
        <button type="button" className="tm-back" onClick={() => (window.history.length > 1 ? back() : go('/'))}><ArrowLeft size={18} aria-hidden="true" /><span>{hi ? 'वापस' : 'Back'}</span></button>
        <img className="tm-logo" src="/dialoo-logo-wide.webp" alt="Dialoo" />
        {setLang && <button type="button" className="tm-lang" onClick={() => setLang(hi ? 'en' : 'hi')} aria-label="Change language"><Languages size={16} aria-hidden="true" />{hi ? 'English' : 'हिन्दी'}</button>}
      </header>

      <div className="tm-wrap">
        <nav className="tm-tabs" role="tablist" aria-label={hi ? 'कानूनी दस्तावेज़' : 'Legal documents'}>
          {Object.entries(TABS).map(([k, v]) => {
            const Icon = ICONS[k];
            return <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => go(`/terms?tab=${k}`)}><Icon size={17} aria-hidden="true" /><span>{v.label[hi ? 1 : 0]}</span></button>;
          })}
        </nav>

        <div className="tm-grid">
          <aside className="tm-toc" aria-label={hi ? 'इस पेज पर' : 'On this page'}>
            <b>{hi ? 'इस पेज पर' : 'On this page'}</b>
            <ol>{toc.map((s) => <li key={s.id}><button type="button" onClick={() => jump(s.id)}>{s.title}</button></li>)}</ol>
          </aside>

          <main className="tm-doc">
            <h1>{data.title}</h1>
            <p className="tm-meta">{hi ? 'संस्करण' : 'Version'} {TERMS_VERSION} · {hi ? 'लागू होने की तारीख' : 'Effective'} {EFFECTIVE}</p>
            <p className="tm-lead">{data.lead}</p>

            <details className="tm-hi" open>
              <summary>{hi ? 'हिन्दी में संक्षेप' : 'हिन्दी में संक्षेप (Hindi summary)'}</summary>
              <ul>{data.hindi.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <small>{hi ? 'कानूनी रूप से पूरी अंग्रेज़ी शर्तें लागू होती हैं।' : 'This is a summary to help you. The full English text below is the binding version.'}</small>
            </details>

            {tab === 'partner' && (
              <div className="tm-callout" role="note">
                <b>{hi ? 'फ़्री अभी, पेड बाद में' : 'Free now, paid later'}</b>
                <span>{hi ? 'अभी Partner बनना फ़्री है। भविष्य में कोई फ़ीस लगने से कम से कम 30 दिन पहले आपको सूचना मिलेगी।' : 'Dialoo is free for Partners right now. Any future fee starts only after at least 30 days\' notice to you. See P3.'}</span>
              </div>
            )}

            {data.sections.map((s) => (
              <section key={s.id} id={s.id} className="tm-sec">
                <h2>{s.title}</h2>
                {s.body.map((b, i) => <Block key={i} b={b} />)}
              </section>
            ))}

            <footer className="tm-foot">
              <p>{CONTACT.owner} · {CONTACT.place}</p>
              <p><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></p>
              <div className="tm-links">{Object.entries(TABS).filter(([k]) => k !== tab).map(([k, v]) => <button key={k} type="button" onClick={() => go(`/terms?tab=${k}`)}>{v.label[hi ? 1 : 0]}</button>)}</div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
