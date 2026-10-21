import type { Failure } from '../../api/failure.ts';
import { Icon } from '../../components/Icon.tsx';
import type { Translate } from '../../i18n.ts';

const copy = (t: Translate, kind: Failure['kind']): [string, string] => {
  switch (kind) {
    case 'signed_out': return [t('请重新登录', 'Please sign in again'), t('登录已失效，页面数据已清除。请通过内部身份重新登录后再打开后台。', 'Your session has ended and cached data was cleared. Sign in with your staff identity, then reopen the console.')];
    case 'reauth': return [t('需要重新验证身份', 'Re-verification required'), t('后台需要近期完成的多因素验证。完成验证后重试。', 'The console needs a recent multi-factor verification. Verify, then retry.')];
    case 'forbidden': return [t('没有访问权限', 'No access'), t('当前账号没有产品分析权限。权限由服务端校验，请联系数据管理员。', 'This account has no analytics role. Access is checked by the server; contact a data admin.')];
    case 'network': return [t('无法连接服务', 'Cannot reach the service'), t('网络中断，没有展示旧数据。恢复连接后重试。', 'The network is unavailable and no stale data is shown. Retry when connected.')];
    case 'unavailable':
    case 'rate_limited': return [t('服务暂时不可用', 'Service temporarily unavailable'), t('没有展示旧图表，请稍后重试。', 'Stale charts are hidden. Try again shortly.')];
    default: return [t('加载失败', 'Loading failed'), t('没有展示旧图表，请重试。', 'Stale charts are hidden. Please retry.')];
  }
};

export function FailureScreen({ failure, t, onRetry }: { failure: Failure; t: Translate; onRetry?: () => void }) {
  const [title, body] = copy(t, failure.kind);
  return (
    <div className="panel load-error" role="alert">
      <Icon name="quality" size={36} />
      <h2>{title}</h2>
      <p>{body}</p>
      {failure.requestId && <p className="mono">requestId: {failure.requestId}</p>}
      {onRetry && <button className="button primary" onClick={onRetry}>{t('重试加载', 'Retry loading')}</button>}
    </div>
  );
}
