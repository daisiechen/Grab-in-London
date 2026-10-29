import { useState } from 'react';
import { toFailure } from '../../api/failure.ts';
import { Icon } from '../../components/Icon.tsx';
import type { Translate } from '../../i18n.ts';
import { useConsole } from '../../state/console.tsx';

/** Full-page navigation to the identity provider (replaceable in tests; jsdom cannot navigate). */
export const navigation = { assign: (url: string) => window.location.assign(url) };

let returnedError: string | null = null;

/**
 * Reads and removes `?signin_error=<CODE>`, set by the API callback when a secure sign-in did not
 * finish, so a reload does not repeat the message. Called once when the console starts; the sign-in
 * page shows it once.
 */
export function captureSignInError(): void {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('signin_error');
  if (code === null) return;
  url.searchParams.delete('signin_error');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  returnedError = /^[A-Z_]{1,40}$/.test(code) ? code : 'UNKNOWN';
}
const takeSignInError = () => { const code = returnedError; returnedError = null; return code; };

/**
 * Starts the secure sign-in: the provider's hosted login (email code, Google or Apple, whichever the
 * tenant enables) with multi-factor authentication requested, returning to this console.
 */
export function SecureSignInButton({ t, className = 'button primary' }: { t: Translate; className?: string }) {
  const c = useConsole();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try { navigation.assign((await c.api.startSecureSignIn()).authorizationUrl); }
    catch (e) {
      const { kind } = toFailure(e);
      setError(kind === 'forbidden' ? t('当前地址不能用于后台登录。', 'Sign-in is not allowed from this address.')
        : kind === 'rate_limited' ? t('尝试过于频繁，请稍后再试。', 'Too many attempts. Wait a moment and try again.')
          : t('暂时无法开始登录，请稍后重试。', 'Sign-in could not start. Try again shortly.'));
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={() => void go()}>{t('安全登录', 'Sign in securely')}</button>
      {error && <p className="inline-error" role="alert">{error}</p>}
    </>
  );
}

/**
 * Staff sign-in (cookie session on this origin). Production: only the secure sign-in, because staff
 * areas require provider-verified MFA and an email code alone never carries it. Development builds
 * also offer the email-code form for the synthetic local staff account (simulated MFA, refused outside
 * development/test by config).
 */
export function SignIn({ t, emailCode = import.meta.env.DEV }: { t: Translate; emailCode?: boolean }) {
  const c = useConsole();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returned] = useState(takeSignInError);

  const returnedMessage = (code: string) => {
    if (code === 'FORBIDDEN') return t('这个登录方式没有关联员工账号。请使用账号原来的登录方式（同一邮箱或已关联的 Google）。', 'This sign-in is not linked to a staff account. Use the method your account already uses (the same email or a linked Google account).');
    if (code === 'STATE_CONFLICT') return t('登录已取消或已过期，请重新登录。', 'Sign-in was cancelled or expired. Please try again.');
    if (code === 'PROVIDER_UNAVAILABLE') return t('暂时无法连接登录服务，请稍后重试。', 'Sign-in is temporarily unavailable. Try again shortly.');
    if (code === 'ACCOUNT_SUSPENDED') return t('此账号已停用。', 'This account has been suspended.');
    return t('登录未完成，请重试。', 'Sign-in did not finish. Please try again.');
  };

  const message = (e: unknown) => {
    const { kind } = toFailure(e);
    if (kind === 'rate_limited') return t('尝试过于频繁，请稍后再试。', 'Too many attempts. Wait a moment and try again.');
    if (kind === 'invalid' || kind === 'not_found') return t('验证码不正确或已过期。', 'The code is wrong or has expired.');
    if (kind === 'conflict') return t('此验证已使用或过期，请重新获取验证码。', 'This code was already used or expired. Request a new code.');
    if (kind === 'forbidden') return t('当前地址不能用于后台登录。', 'Sign-in is not allowed from this address.');
    if (kind === 'network' || kind === 'unavailable') return t('暂时无法连接登录服务，请稍后重试。', 'Sign-in is temporarily unavailable. Try again shortly.');
    return t('登录未完成，请重试。', 'Sign-in did not finish. Please try again.');
  };

  const start = async () => {
    if (!/^[^\s@]+@[^\s@]+$/.test(email.trim())) { setError(t('请输入有效的员工邮箱。', 'Enter a valid staff email.')); return; }
    setBusy(true); setError(null);
    try { setChallengeId((await c.api.startSignIn(email.trim())).challengeId); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    if (!challengeId || !/^[0-9]{6}$/.test(code)) { setError(t('请输入6位验证码。', 'Enter the 6-digit code.')); return; }
    setBusy(true); setError(null);
    try {
      const outcome = await c.api.verifySignIn(challengeId, code);
      if (outcome.outcome !== 'AUTHENTICATED') { setError(t('此邮箱需要先用原登录方式关联，请联系管理员。', 'This email must be linked with its original sign-in method first. Contact an admin.')); return; }
      c.reloadSession();
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="panel sign-in">
      <div role="alert" className="sign-in-head">
        <Icon name="quality" size={32} />
        <h2>{t('请重新登录', 'Please sign in again')}</h2>
        <p>{t('用员工账号登录，并完成多因素验证（验证器应用或通行密钥）。后台权限由服务端校验。', 'Sign in with your staff account and complete multi-factor verification (authenticator app or passkey). Roles are checked by the server.')}</p>
      </div>
      {returned && <p className="inline-error" role="alert">{returnedMessage(returned)}</p>}
      <div className="sign-in-form">
        <SecureSignInButton t={t} />
      </div>
      {emailCode && (
        <>
          <p className="method-note">{t('开发环境：本地合成员工账号可用邮箱验证码登录（模拟 MFA，生产环境不提供）。', 'Development only: the synthetic local staff account can use an email code (simulated MFA; not offered in production).')}</p>
          {!challengeId ? (
            <form className="sign-in-form" onSubmit={(e) => { e.preventDefault(); void start(); }}>
              <label>{t('员工邮箱', 'Staff email')}
                <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <button className="button" disabled={busy}>{t('发送验证码', 'Send code')}</button>
            </form>
          ) : (
            <form className="sign-in-form" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
              <label>{t('邮件中的6位验证码', '6-digit code from the email')}
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </label>
              <button className="button primary" disabled={busy}>{t('登录', 'Sign in')}</button>
              <button type="button" className="text-button" onClick={() => { setChallengeId(null); setCode(''); setError(null); }}>{t('更换邮箱', 'Use another email')}</button>
            </form>
          )}
        </>
      )}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
  );
}
