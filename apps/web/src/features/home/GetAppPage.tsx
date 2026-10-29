import { BellIcon, ChatBubbleIcon, PlusIcon } from '@radix-ui/react-icons';
import { Notice, PrimaryLink, TitleBar } from '../../ui/components.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';

const ROWS = [
  [<BellIcon key="b" />, 'Instant notifications', 'Know the moment a host replies or your table changes.'],
  [<PlusIcon key="p" />, 'Host from your phone', 'Choose a restaurant, set a time and review requests on the go.'],
  [<ChatBubbleIcon key="c" />, 'Your tables in your pocket', 'The same account, meals and group chats as on the web.'],
] as const;

/**
 * “Get the app” (spec §5). Store buttons stay hidden until the App Store listing exists (D8);
 * everything the app does is also available here on the web.
 */
export function GetAppPage() {
  useDocumentMeta({ title: 'The Fancy app · Fancy', description: 'Fancy for iPhone is coming soon. Everything works on the web in the meantime.', canonical: '/get-app' });
  return (
    <div className="scroll">
      <TitleBar title="Fancy is also an app." subtitle="Same account, same tables — plus instant updates." back="/" />
      {ROWS.map(([icon, t, d], i) => (
        <div key={t} className={`lr${i ? '' : ' first'}`} style={{ minHeight: 64 }}>
          <span className="ci" aria-hidden="true">{icon}</span>
          <span className="lb">{t}<small>{d}</small></span>
        </div>
      ))}
      <Notice>The iPhone app is coming soon. Until then, everything — joining, hosting, chatting and feedback after the meal — works right here on the web.</Notice>
      <PrimaryLink to="/discover">Find a table</PrimaryLink>
      <p className="caption" style={{ textAlign: 'center' }}>iPhone only at launch. Once it’s installed, links to meals open in the app automatically.</p>
    </div>
  );
}
