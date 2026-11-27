import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFrame, decodeFrames, StompClient } from '../src/shared/stomp.js';

test('encode/decode round trip with escaping', () => {
  const f = encodeFrame('SEND', { destination: '/app/x', note: 'a:b\nc' }, '{"a":1}');
  const { frames, rest } = decodeFrames(f);
  assert.equal(rest, ''); assert.equal(frames.length, 1);
  assert.equal(frames[0].command, 'SEND'); assert.equal(frames[0].headers.note, 'a:b\nc'); assert.equal(frames[0].body, '{"a":1}');
});

test('decodeFrames handles split frames, heart-beats and several frames in one chunk', () => {
  const a = encodeFrame('MESSAGE', { subscription: 's1' }, '{"n":1}'), b = encodeFrame('MESSAGE', { subscription: 's1' }, '{"n":2}');
  let r = decodeFrames(`\n\n${a}\n${b.slice(0, 20)}`);
  assert.equal(r.frames.length, 1); assert.equal(JSON.parse(r.frames[0].body).n, 1);
  r = decodeFrames(r.rest + b.slice(20));
  assert.equal(r.frames.length, 1); assert.equal(JSON.parse(r.frames[0].body).n, 2);
});

class FakeWS {
  static instances = [];
  constructor(url) { this.url = url; this.sent = []; FakeWS.instances.push(this); setTimeout(() => this.onopen && this.onopen(), 0); }
  send(d) { this.sent.push(d); }
  close() { this.closed = true; setTimeout(() => this.onclose && this.onclose(), 0); }
  push(frame) { this.onmessage({ data: frame }); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('connects with JWT, subscribes, dispatches messages, reconnects and re-subscribes with a fresh token', async () => {
  FakeWS.instances = [];
  let n = 0; const states = [];
  const c = new StompClient({ url: 'ws://x/ws/tracking', WebSocketImpl: FakeWS, getToken: async () => `tok${++n}`, minBackoff: 5, maxBackoff: 10, heartbeat: 100000, onState: (s) => states.push(s) });
  const got = [];
  c.subscribe('/topic/bookings/7/tracking', (m) => got.push(m));
  c.activate(); await wait(10);
  const ws1 = FakeWS.instances[0];
  assert.match(ws1.sent[0], /^CONNECT\n/); assert.match(ws1.sent[0], /Authorization:Bearer tok1/);
  ws1.push(encodeFrame('CONNECTED', { version: '1.2' }));
  assert.equal(c.connected, true);
  assert.ok(ws1.sent.some((s) => s.startsWith('SUBSCRIBE') && s.includes('/topic/bookings/7/tracking')));
  ws1.push(encodeFrame('MESSAGE', { subscription: 'sub-1', destination: '/topic/bookings/7/tracking' }, '{"type":"location","seq":1}'));
  assert.deepEqual(got, [{ type: 'location', seq: 1 }]);
  assert.equal(c.publish('/app/tracking/location', { a: 1 }), true);
  ws1.close(); await wait(40);                       // server drops the link
  const ws2 = FakeWS.instances[1];
  assert.ok(ws2, 'reconnected'); assert.match(ws2.sent[0], /Authorization:Bearer tok2/);
  ws2.push(encodeFrame('CONNECTED', { version: '1.2' }));
  assert.ok(ws2.sent.some((s) => s.startsWith('SUBSCRIBE')), 'resubscribed');
  assert.ok(states.includes('reconnecting'));
  c.deactivate(); assert.equal(c.publish('/app/x', {}), false);
});

test('publish returns false while offline so callers can use the HTTPS fallback', () => {
  const c = new StompClient({ url: 'ws://x', WebSocketImpl: FakeWS, getToken: async () => 't' });
  assert.equal(c.publish('/app/x', {}), false);
});
