/**
 * Structured service address. MANDATORY: house/flat no., area/locality, city, PIN code (6 digits).
 * OPTIONAL: building/street, landmark, district, state, country (auto-filled from the map when available).
 * A saved address from before structured fields existed (only one text line) is accepted as-is until the customer edits it.
 */
export const FIELD_KEYS = ['houseNo', 'building', 'landmark', 'locality', 'city', 'district', 'state', 'pincode', 'country'];
export const emptyAddress = () => ({ ...Object.fromEntries(FIELD_KEYS.map((k) => [k, ''])), country: 'India' });

export const composeAddress = (f) => [f.houseNo, f.building, f.landmark ? `Near ${f.landmark}` : '', f.locality, f.city, f.state && f.pincode ? `${f.state} - ${f.pincode}` : (f.state || f.pincode)]
  .filter((x) => x && String(x).trim()).map((x) => String(x).trim()).join(', ').slice(0, 255);

/** @returns {{[key:string]: string}} field -> message (empty object = valid). */
export function validateAddress(f, t) {
  if (f.__legacy) return composeAddress(f).length >= 6 ? {} : { building: t('Please enter your full address.', 'कृपया पूरा पता लिखें।') };
  const e = {};
  if (!String(f.houseNo || '').trim()) e.houseNo = t('Enter house / flat / shop number.', 'मकान / फ़्लैट / दुकान नंबर लिखें।');
  if (String(f.locality || '').trim().length < 2) e.locality = t('Enter your area or street.', 'अपना इलाका या गली लिखें।');
  if (String(f.city || '').trim().length < 2) e.city = t('Enter your city.', 'अपना शहर लिखें।');
  if (!/^[1-9][0-9]{5}$/.test(String(f.pincode || '').trim())) e.pincode = t('Enter a valid 6-digit PIN code.', '6 अंकों का सही पिन कोड लिखें।');
  return e;
}

/** Merge a reverse-geocoded place into the form WITHOUT touching what the customer typed by hand (house no., building, landmark). */
export function mergePlace(f, p) {
  return { ...f, __legacy: false, locality: p.locality || f.locality || '', city: p.city || p.cityName || f.city || '', district: p.district || f.district || '',
    state: p.state || f.state || '', pincode: p.pincode || f.pincode || '', country: p.country || f.country || 'India' };
}

export function fromSaved(a) {
  const f = { ...emptyAddress(), houseNo: a.house_no || '', building: a.building || '', landmark: a.landmark || '', locality: a.locality || '', city: '', district: a.district || '',
    state: a.state || '', pincode: a.pincode || '', country: a.country || 'India' };
  const structured = !!(a.house_no || a.locality || a.pincode);
  if (!structured) { f.building = a.address_line || ''; f.__legacy = true; }
  else {
    // the saved line ends with "city, state - pin"; recover the city so editing starts from a complete form
    const parts = String(a.address_line || '').split(',').map((x) => x.trim()).filter(Boolean);
    const idx = parts.findIndex((x) => x === f.locality);
    f.city = idx >= 0 && parts[idx + 1] && !/\d{6}/.test(parts[idx + 1]) ? parts[idx + 1] : '';
  }
  return f;
}

export const savePayload = (f, label, coords, placeId) => ({
  label, addressLine: composeAddress(f), isDefault: false, latitude: coords ? coords.lat : null, longitude: coords ? coords.lng : null, placeId: placeId || null,
  houseNo: f.houseNo, building: f.building, landmark: f.landmark, locality: f.locality, district: f.district, state: f.state, pincode: f.pincode, country: f.country,
});
