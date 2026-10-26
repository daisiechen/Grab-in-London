/** M01-01 PM simulation only: no provider, storage, or business commands. */
export const SYNTHETIC_MEAL_ID = '11111111-1111-4111-8111-111111111111';
export const OTP_TTL = 300;
export const RESEND_COOLDOWN = 30;
export const DEMO_CODES = ['123456', '246810', '135790'];
export function demoCode(s) { return DEMO_CODES[Math.max(0, s.challenge - 1) % DEMO_CODES.length]; }
export function createState(options = {}) {
  return { screen: 'welcome', email: '', code: '', error: '', now: 0,
    issuedAt: null, resendAt: null, challenge: 0, verified: false,
    origin: options.origin === 'meal' ? 'meal' : 'discover',
    targetId: options.origin === 'meal' ? SYNTHETIC_MEAL_ID : null,
    profileComplete: options.profileComplete !== false, boundary: null,
    sendFailure: false, verifyFailure: false, businessWrites: 0 };
}
export function resendRemaining(s) { return s.resendAt === null ? 0 : Math.max(0, s.resendAt - s.now); }
export function expired(s) { return s.issuedAt !== null && s.now - s.issuedAt >= OTP_TTL; }
export function transition(state, event) {
  const s = { ...state };
  switch (event.type) {
    case 'START': s.screen = 'email'; s.error = ''; break;
    case 'BROWSE': s.screen = 'boundary'; s.boundary = 'discover'; s.error = ''; break;
    case 'EMAIL': s.email = event.value; s.error = ''; break;
    case 'CODE': s.code = event.value.replace(/\D/g, '').slice(0, 6); s.error = ''; break;
    case 'SEND': {
      if (s.screen !== 'email') break;
      const email = s.email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { s.error = 'Enter a valid email address.'; break; }
      if (!email.toLowerCase().endsWith('@example.test')) { s.error = 'For this preview, use an @example.test address.'; break; }
      if (s.sendFailure) { s.sendFailure = false; s.error = 'We couldn’t request a code. Your email is still here. Try again.'; break; }
      s.email = email; s.issuedAt = s.now; s.resendAt = s.now + RESEND_COOLDOWN;
      s.challenge += 1; s.code = ''; s.error = ''; s.screen = 'code'; s.verified = false; break;
    }
    case 'RESEND':
      if (s.screen !== 'code' || resendRemaining(s) > 0) break;
      if (s.sendFailure) { s.sendFailure = false; s.error = 'We couldn’t request a new code. Try again.'; break; }
      s.issuedAt = s.now; s.resendAt = s.now + RESEND_COOLDOWN;
      s.challenge += 1; s.code = ''; s.error = ''; break;
    case 'VERIFY':
      if (s.screen !== 'code') break;
      if (expired(s)) { s.error = 'This code has expired. Request a new code.'; break; }
      if (s.code.length !== 6) { s.error = 'Enter the 6-digit code.'; break; }
      if (s.verifyFailure) { s.verifyFailure = false; s.error = 'We couldn’t verify your code. Your input is still here. Try again.'; break; }
      if (s.code !== demoCode(s)) { s.error = 'That code doesn’t match. Try again.'; break; }
      s.verified = true; s.code = ''; s.error = ''; s.screen = 'verified'; break;
    case 'CHANGE_EMAIL':
      s.screen = 'email'; s.code = ''; s.error = ''; s.issuedAt = null; s.resendAt = null; break;
    case 'CANCEL':
      s.screen = 'boundary'; s.boundary = s.origin; s.code = ''; s.error = ''; s.issuedAt = null; s.resendAt = null; break;
    case 'CONTINUE':
      if (!s.verified) break;
      s.screen = 'boundary'; s.boundary = s.profileComplete ? s.origin : 'profile'; break;
    case 'ADVANCE': s.now += Math.max(0, Number(event.seconds) || 0); break;
    case 'FAIL_SEND': s.sendFailure = true; break;
    case 'FAIL_VERIFY': s.verifyFailure = true; break;
    default: break;
  }
  return s;
}
