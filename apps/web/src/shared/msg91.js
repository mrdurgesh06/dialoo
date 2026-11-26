// MSG91 OTP Widget (headless: exposeMethods=true, so MSG91's own popup is never shown).
// Flow: sendOtp -> user types 6-digit code in Dialoo's own boxes -> verifyOtp -> JWT access token -> our API re-verifies it.
let loading = null;
let lastReqId = null;
let lastIdentifier = null;

function loadWidget(cfg) {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const fail = (msg) => { loading = null; reject(new Error(msg)); };
    window.configuration = {
      widgetId: cfg.widgetId, tokenAuth: cfg.tokenAuth, exposeMethods: true,
      success: () => {}, failure: () => {}, // results are handled by the per-call callbacks below
    };
    const s = document.createElement('script');
    s.src = 'https://verify.msg91.com/otp-provider.js'; s.async = true;
    s.onload = () => {
      try { window.initSendOTP(window.configuration); } catch { return fail('OTP service could not start. Please try again.'); }
      let tries = 0;
      const wait = setInterval(() => {
        if (typeof window.sendOtp === 'function' && typeof window.verifyOtp === 'function') { clearInterval(wait); resolve(); }
        else if (++tries > 50) { clearInterval(wait); fail('OTP service is not available. Check your internet and try again.'); }
      }, 100);
    };
    s.onerror = () => fail('OTP service could not be loaded. Check your internet and try again.');
    document.head.appendChild(s);
  });
  return loading;
}

const errText = (e) => (e && (e.message || e.error || e.errors)) ? String(e.message || e.error || e.errors) : 'OTP request failed. Please try again.';
const call = (fn) => new Promise((resolve, reject) => fn(resolve, (e) => reject(new Error(errText(e)))));

export async function msg91Send(cfg, mobile10) {
  await loadWidget(cfg);
  const identifier = '91' + mobile10;
  // Same number again (resend): use retryOtp so MSG91 keeps the same request id.
  if (lastReqId && lastIdentifier === identifier && typeof window.retryOtp === 'function') {
    try { await call((ok, bad) => window.retryOtp(null, ok, bad, lastReqId)); return; } catch { /* fall through to a fresh send */ }
  }
  const data = await call((ok, bad) => window.sendOtp(identifier, ok, bad));
  lastIdentifier = identifier;
  lastReqId = data && typeof data.message === 'string' && data.message.length > 8 ? data.message : null;
}

export async function msg91Verify(cfg, otp) {
  await loadWidget(cfg);
  const data = await call((ok, bad) => (lastReqId ? window.verifyOtp(otp, ok, bad, lastReqId) : window.verifyOtp(otp, ok, bad)));
  const token = data && (data.message || data.token || data.accessToken);
  if (typeof token !== 'string' || token.length < 20) throw new Error('Incorrect or expired OTP. Please try again.');
  return token;
}
