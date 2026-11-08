import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { PrimaryLink, StateBlock, TitleBar } from '../ui/components.tsx';
import { useDocumentMeta } from '../seo/useDocumentMeta.ts';

export function NotFound() {
  useDocumentMeta({ title: 'Page not found · Fancy', robots: 'noindex' });
  return (
    <div className="scroll">
      <StateBlock headingLevel={1} icon={<MagnifyingGlassIcon width={28} height={28} aria-hidden="true" />} title="This page isn’t on the menu."
        action={<PrimaryLink to="/discover">Discover meals</PrimaryLink>}>
        The link may be old or mistyped. There are other meals to discover.
      </StateBlock>
    </div>
  );
}

/** Same page for “doesn’t exist” and “not yours to see” (spec §3.2): no hint which one it is. */
export function Unavailable({ kind = 'table' }: { kind?: 'table' | 'profile' }) {
  useDocumentMeta({ title: 'Not available · Fancy', robots: 'noindex' });
  return (
    <div className="scroll">
      <TitleBar title={kind === 'table' ? 'The table' : 'Member profile'} />
      <StateBlock icon={<MagnifyingGlassIcon width={28} height={28} aria-hidden="true" />}
        title={kind === 'table' ? 'This table isn’t available.' : 'This profile isn’t available.'}
        action={<PrimaryLink to="/discover">Discover meals</PrimaryLink>}>
        It may have been removed, or the link is incomplete. There are other meals to discover.
      </StateBlock>
    </div>
  );
}
