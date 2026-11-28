import React from 'react';
import { useT } from './ui.jsx';

/** The structured address fields (controlled). `errors` comes from validateAddress. Required fields are marked with *. */
export default function AddressForm({ value, onChange, errors = {} }) {
  const t = useT();
  const set = (k) => (e) => onChange({ ...value, __legacy: false, [k]: e.target.value });
  const Field = ({ k, label, req, ...rest }) => (
    <div className={`field ${errors[k] ? 'has-err' : ''}`}>
      <label htmlFor={`af-${k}`}>{label}{req && <span className="req" aria-hidden="true"> *</span>}</label>
      <input id={`af-${k}`} value={value[k] || ''} onChange={set(k)} aria-required={!!req} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `af-${k}-e` : undefined} {...rest} />
      {errors[k] && <small id={`af-${k}-e`} className="fe" role="alert">{errors[k]}</small>}
    </div>
  );
  return (
    <div className="af">
      {value.__legacy && <p className="muted small">{t('This saved address has one line only. Tap a field below to split it into house no., area and PIN.', 'यह सेव पता एक ही लाइन में है। मकान नं., इलाका और पिन अलग भरने के लिए नीचे का कोई फ़ील्ड छुएँ।')}</p>}
      <div className="two">
        <Field k="houseNo" req label={t('House / Flat / Shop no.', 'मकान / फ़्लैट / दुकान नं.')} maxLength={60} autoComplete="address-line1" />
        <Field k="building" label={t('Building / Society name', 'बिल्डिंग / सोसाइटी का नाम')} maxLength={160} autoComplete="address-line2" />
      </div>
      <Field k="locality" req label={t('Area / Street', 'इलाका / गली')} maxLength={120} />
      <Field k="landmark" label={t('Landmark (optional)', 'लैंडमार्क (वैकल्पिक)')} maxLength={120} placeholder={t('e.g. near the temple', 'जैसे मंदिर के पास')} />
      <div className="two">
        <Field k="city" req label={t('City / Town', 'शहर / कस्बा')} maxLength={80} autoComplete="address-level2" />
        <Field k="pincode" req label={t('PIN code', 'पिन कोड')} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
      </div>
      <div className="two">
        <Field k="district" label={t('District (optional)', 'ज़िला (वैकल्पिक)')} maxLength={80} />
        <Field k="state" label={t('State (optional)', 'राज्य (वैकल्पिक)')} maxLength={80} autoComplete="address-level1" />
      </div>
    </div>
  );
}
