import React, { useEffect, useState } from 'react';
import { catalogApi } from '../../shared/api.js';
import { go } from '../../shared/router.js';
import { Empty, Spinner, useT } from '../../shared/ui.jsx';
import { ProviderCard } from '../../shared/parts.jsx';
import { BadgeCheck, ChevronLeft, ChevronRight, SearchX, Siren, Star, Zap } from 'lucide-react';
import { CategoryIcon } from '../../shared/icons.jsx';

export default function Browse({ query, city, favs, onFav, onBook, userPos }) {
  const t = useT();
  const [cats, setCats] = useState([]); const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  const [f, setF] = useState({ available: query.available === '1', verified: false, rating: false, emergency: false });
  const [sort, setSort] = useState(query.sort || (userPos ? 'nearest' : 'best'));
  useEffect(() => { if (userPos && !query.sort) setSort((cur) => (cur === 'best' ? 'nearest' : cur)); }, [!!userPos]); // eslint-disable-line
  const [page, setPage] = useState(0);
  const cat = query.cat || ''; const q = query.q || '';
  useEffect(() => { catalogApi.categories().then(setCats).catch(() => {}); }, []);
  useEffect(() => { setPage(0); }, [cat, q, sort, f, city]);
  useEffect(() => {
    setRows(null); setErr('');
    catalogApi.providers({
      categorySlug: cat, q, cityId: city?.id, available: f.available || undefined, verified: f.verified || undefined, emergency: f.emergency || undefined,
      minRating: f.rating ? 4 : undefined, sort: sort === 'nearest' && !userPos ? 'best' : sort, lat: userPos?.lat, lng: userPos?.lng, page, size: 20,
    }).then(setRows).catch((e) => { setErr(e.message); setRows([]); });
  }, [cat, q, city, f, sort, page, userPos]);
  const chip = (k, label) => <button className={`chip ${f[k] ? 'on' : ''}`} onClick={() => setF({ ...f, [k]: !f[k] })}>{label}</button>;
  return (
    <div className="browse">
      <div className="chip-row scroll">
        <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => go('/browse')}>{t('All', 'सभी')}</button>
        {cats.map((c) => <button key={c.slug} className={`chip ${cat === c.slug ? 'on' : ''}`} onClick={() => go(`/browse?cat=${c.slug}`)}><CategoryIcon slug={c.slug} name={c.name} size={15} />{c.name}</button>)}
      </div>
      <div className="filter-bar">
        <div className="chip-row">{chip('available', <><Zap size={15} aria-hidden="true" />{t('Available now', 'अभी उपलब्ध')}</>)}{chip('verified', <><BadgeCheck size={15} aria-hidden="true" />{t('Verified', 'वेरिफाइड')}</>)}{chip('rating', <><Star size={15} aria-hidden="true" />4.0+</>)}{chip('emergency', <><Siren size={15} aria-hidden="true" />{t('Emergency', 'इमरजेंसी')}</>)}</div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="best">{t('Best match', 'बेस्ट मैच')}</option><option value="fastest">{t('Fastest', 'सबसे तेज़')}</option><option value="rating">{t('Top rated', 'टॉप रेटेड')}</option>
          <option value="price">{t('Price: low to high', 'कीमत: कम से ज़्यादा')}</option><option value="experience">{t('Most experienced', 'सबसे अनुभवी')}</option>{userPos && <option value="nearest">{t('Nearest', 'सबसे पास')}</option>}
        </select>
      </div>
      {q && <p className="muted">{t('Results for', 'परिणाम:')} “{q}” <button className="link" onClick={() => go(cat ? `/browse?cat=${cat}` : '/browse')}>{t('clear', 'हटाएँ')}</button></p>}
      {err && <p className="error">{err}</p>}
      {!rows ? <Spinner /> : rows.length === 0 ? (
        <Empty icon={<SearchX size={26} aria-hidden="true" />} title={t('No providers found', 'कोई प्रोवाइडर नहीं मिला')} text={t('Try removing a filter or searching a nearby category.', 'कोई फ़िल्टर हटाएँ या पास की श्रेणी खोजें।')} />
      ) : (
        <>
          <div className="grid">{rows.map((p) => <ProviderCard key={p.id} p={p} fav={favs.includes(p.id)} onFav={onFav} onBook={onBook} />)}</div>
          <div className="pager">
            <button className="btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} aria-hidden="true" />{t('Previous', 'पिछला')}</button>
            <button className="btn ghost" disabled={rows.length < 20} onClick={() => setPage(page + 1)}>{t('Next', 'अगला')}<ChevronRight size={16} aria-hidden="true" /></button>
          </div>
        </>
      )}
    </div>
  );
}
