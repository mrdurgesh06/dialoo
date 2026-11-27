/**
 * Minimal STOMP 1.2 client over WebSocket (no dependency): CONNECT with a JWT header, SUBSCRIBE, SEND, 10 s heartbeats in both
 * directions, automatic reconnect with exponential backoff + jitter, automatic re-subscribe, and a fresh token on every reconnect.
 * Frame helpers are exported so they can be unit-tested (node --test).
 */
export function encodeFrame(command, headers = {}, body = '') {
  let out = command + '\n';
  for (const [k, v] of Object.entries(headers)) out += `${k}:${String(v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/:/g, '\\c')}\n`;
  return `${out}\n${body}\0`;
}

/** Splits a buffer into complete frames. Returns { frames, rest }. Heart-beat newlines between frames are ignored. */
export function decodeFrames(buffer) {
  const frames = [];
  let buf = buffer;
  for (;;) {
    buf = buf.replace(/^[\r\n]+/, '');
    const end = buf.indexOf('\0');
    if (end < 0) break;
    const raw = buf.slice(0, end); buf = buf.slice(end + 1);
    const sep = raw.indexOf('\n\n');
    const head = sep < 0 ? raw : raw.slice(0, sep), body = sep < 0 ? '' : raw.slice(sep + 2);
    const lines = head.split('\n');
    const headers = {};
    for (const l of lines.slice(1)) {
      const i = l.indexOf(':'); if (i < 0) continue;
      const k = l.slice(0, i), v = l.slice(i + 1).replace(/\\c/g, ':').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      if (!(k in headers)) headers[k] = v;
    }
    frames.push({ command: lines[0].trim(), headers, body });
  }
  return { frames, rest: buf };
}

export class StompClient {
  constructor({ url, getToken, WebSocketImpl, heartbeat = 10000, onState, onError, minBackoff = 1000, maxBackoff = 30000 }) {
    this.url = url; this.getToken = getToken; this.WS = WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);
    this.heartbeat = heartbeat; this.onState = onState || (() => {}); this.onError = onError || (() => {});
    this.minBackoff = minBackoff; this.maxBackoff = maxBackoff;
    this.subs = new Map(); this.nextId = 1; this.state = 'idle'; this.active = false; this.attempt = 0; this.buffer = '';
    this.ws = null; this.timers = {}; this.lastRx = 0;
  }

  get connected() { return this.state === 'connected'; }
  _set(s) { if (this.state !== s) { this.state = s; this.onState(s); } }

  activate() { if (this.active) return; this.active = true; this._connect(); }
  deactivate() {
    this.active = false; this._clear();
    if (this.ws) { try { this.ws.send(encodeFrame('DISCONNECT')); } catch { /* ignore */ } try { this.ws.close(); } catch { /* ignore */ } this.ws = null; }
    this._set('idle');
  }

  async _connect() {
    if (!this.active || !this.WS) return;
    this._set('connecting');
    let token = null;
    try { token = await this.getToken(); } catch { /* handled below */ }
    if (!this.active) return;
    if (!token) { this._retry(); return; }
    let ws;
    try { ws = new this.WS(this.url); } catch { this._retry(); return; }
    this.ws = ws; this.buffer = '';
    ws.onopen = () => ws.send(encodeFrame('CONNECT', { 'accept-version': '1.2', Authorization: `Bearer ${token}`, 'heart-beat': `${this.heartbeat},${this.heartbeat}` }));
    ws.onmessage = (ev) => { this.lastRx = Date.now(); this._rx(typeof ev.data === 'string' ? ev.data : ''); };
    ws.onclose = () => { if (this.ws === ws) { this.ws = null; this._clear(); this._set('reconnecting'); this._retry(); } };
    ws.onerror = () => { /* onclose follows */ };
  }

  _rx(chunk) {
    const { frames, rest } = decodeFrames(this.buffer + chunk);
    this.buffer = rest;
    for (const f of frames) {
      if (f.command === 'CONNECTED') {
        this.attempt = 0; this._set('connected'); this._startBeat();
        for (const [id, s] of this.subs) this._sendSub(id, s.dest);
      } else if (f.command === 'MESSAGE') {
        const s = this.subs.get(f.headers.subscription);
        if (s) { let data = f.body; try { data = JSON.parse(f.body); } catch { /* keep text */ } try { s.cb(data, f); } catch (e) { this.onError(e); } }
      } else if (f.command === 'ERROR') {
        this.onError(new Error(f.headers.message || 'STOMP error'));
        try { this.ws && this.ws.close(); } catch { /* ignore */ }
      }
    }
  }

  _startBeat() {
    this._clear();
    this.timers.out = setInterval(() => { try { this.ws && this.ws.send('\n'); } catch { /* ignore */ } }, this.heartbeat);
    this.timers.watch = setInterval(() => {   // nothing received for 2.5 beats: the link is half-open
      if (Date.now() - this.lastRx > this.heartbeat * 2.5) { try { this.ws && this.ws.close(); } catch { /* ignore */ } }
    }, this.heartbeat);
    this.lastRx = Date.now();
  }
  _clear() { Object.values(this.timers).forEach((t) => clearInterval(t)); clearTimeout(this.retryTimer); this.timers = {}; }

  _retry() {
    if (!this.active) return;
    const delay = Math.min(this.maxBackoff, this.minBackoff * 2 ** this.attempt) * (0.7 + Math.random() * 0.6);
    this.attempt += 1;
    this._set('reconnecting');
    this.retryTimer = setTimeout(() => this._connect(), delay);
  }

  _sendSub(id, dest) { try { this.ws.send(encodeFrame('SUBSCRIBE', { id, destination: dest, ack: 'auto' })); } catch { /* retried on reconnect */ } }

  /** @returns an unsubscribe function. Subscriptions survive reconnects. */
  subscribe(dest, cb) {
    const id = `sub-${this.nextId++}`;
    this.subs.set(id, { dest, cb });
    if (this.connected) this._sendSub(id, dest);
    return () => { this.subs.delete(id); if (this.connected) { try { this.ws.send(encodeFrame('UNSUBSCRIBE', { id })); } catch { /* ignore */ } } };
  }

  /** @returns true when the frame was handed to the socket, false when offline (caller falls back to HTTPS). */
  publish(dest, body) {
    if (!this.connected || !this.ws) return false;
    try { this.ws.send(encodeFrame('SEND', { destination: dest, 'content-type': 'application/json' }, JSON.stringify(body))); return true; } catch { return false; }
  }
}
