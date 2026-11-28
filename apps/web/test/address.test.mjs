import test from 'node:test';
import assert from 'node:assert/strict';
import { composeAddress, emptyAddress, fromSaved, mergePlace, validateAddress } from '../src/shared/addressFields.js';

const t = (en) => en;

test('only house no., area, city and a 6-digit PIN are mandatory', () => {
  const e = validateAddress(emptyAddress(), t);
  assert.deepEqual(Object.keys(e).sort(), ['city', 'houseNo', 'locality', 'pincode']);
  const ok = { ...emptyAddress(), houseNo: '12', locality: 'Kolhar Road', city: 'Sahaswan', pincode: '243638' };   // building, landmark, district, state stay empty
  assert.deepEqual(validateAddress(ok, t), {});
});

test('PIN code must be 6 digits and not start with 0', () => {
  const base = { ...emptyAddress(), houseNo: '1', locality: 'Area', city: 'City' };
  for (const bad of ['', '12345', '1234567', '012345', 'abcdef']) assert.ok(validateAddress({ ...base, pincode: bad }, t).pincode, bad);
  assert.deepEqual(validateAddress({ ...base, pincode: '243638' }, t), {});
});

test('map/GPS results fill area, city and PIN but never overwrite what the customer typed', () => {
  const typed = { ...emptyAddress(), houseNo: '12-B', building: 'Shanti Apartments', landmark: 'Near temple' };
  const m = mergePlace(typed, { locality: 'Kolhar', city: 'Sahaswan', pincode: '243638', state: 'Uttar Pradesh', district: 'Budaun' });
  assert.equal(m.houseNo, '12-B'); assert.equal(m.building, 'Shanti Apartments'); assert.equal(m.landmark, 'Near temple');
  assert.equal(m.locality, 'Kolhar'); assert.equal(m.pincode, '243638');
});

test('composed address keeps order and shows the landmark', () => {
  const a = { ...emptyAddress(), houseNo: '12-B', building: 'Shanti Apartments', landmark: 'temple', locality: 'Kolhar', city: 'Sahaswan', state: 'Uttar Pradesh', pincode: '243638' };
  assert.equal(composeAddress(a), '12-B, Shanti Apartments, Near temple, Kolhar, Sahaswan, Uttar Pradesh - 243638');
});

test('an old one-line saved address is accepted until the customer edits it', () => {
  const f = fromSaved({ address_line: 'Ward 4, near bus stand, Sahaswan', label: 'HOME' });
  assert.equal(f.__legacy, true); assert.deepEqual(validateAddress(f, t), {});
  assert.equal(composeAddress(f), 'Ward 4, near bus stand, Sahaswan');
  const edited = { ...f, __legacy: false };
  assert.ok(validateAddress(edited, t).houseNo);
});
