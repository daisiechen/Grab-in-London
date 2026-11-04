import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { ChatBubbleIcon, MagnifyingGlassIcon, PersonIcon, PlusIcon } from '@radix-ui/react-icons';
import { useSignedIn } from '../api/session.tsx';
import { Avatar } from '../ui/components.tsx';
import { signInPath } from '../lib/returnTo.ts';

type Glyph = 'search' | 'person' | 'chat';

/** iOS TabGlyph: Radix outline when idle, a filled 24px glyph when the tab is current. */
function TabGlyph({ kind, active }: { kind: Glyph; active: boolean }) {
  if (!active) {
    const Icon = kind === 'search' ? MagnifyingGlassIcon : kind === 'chat' ? ChatBubbleIcon : PersonIcon;
    return <Icon width={24} height={24} aria-hidden="true" />;
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" data-filled="true" fill="currentColor">
      {kind === 'chat' ? (
        <><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M7 9h10M7 13h7" stroke="white" strokeWidth="1.5" /></>
      ) : kind === 'person' ? (
        <><circle cx="12" cy="7" r="5" /><path d="M3 23v-3a9 9 0 0 1 18 0v3Z" /></>
      ) : (
        <><circle cx="10" cy="10" r="8" /><path d="m16 16 6 6" stroke="currentColor" strokeWidth="4" /><circle cx="10" cy="10" r="4" fill="white" /></>
      )}
    </svg>
  );
}

const TABS = [
  { to: '/discover', label: 'Discover', glyph: 'search' },
  { to: '/meals', label: 'Meals', glyph: 'person' },
  { to: '/inbox', label: 'Inbox', glyph: 'chat' },
  { to: '/profile', label: 'Profile', glyph: 'person' },
] as const;

/** Guests tapping Create go to sign-in with /create remembered (iOS CreateTabButton; no auto-create). */
function useCreateHref() {
  const session = useSignedIn();
  return session ? '/create' : signInPath('/create');
}

/** Phones: four destinations plus the raised central Create meal circle (iOS FancyTabBar). */
export function BottomNav() {
  const createHref = useCreateHref();
  const tab = (t: (typeof TABS)[number]) => (
    <NavLink key={t.to} to={t.to} end>
      {({ isActive }) => <><TabGlyph kind={t.glyph} active={isActive} /><span>{t.label}</span></>}
    </NavLink>
  );
  return (
    <nav className="tabbar" aria-label="Main navigation">
      {tab(TABS[0])}
      {tab(TABS[1])}
      <Link to={createHref} className="create" aria-label="Create meal">
        <span className="create-circle" aria-hidden="true"><PlusIcon width={28} height={28} /></span>
        <span aria-hidden="true">Create meal</span>
      </Link>
      {tab(TABS[2])}
      {tab(TABS[3])}
    </nav>
  );
}

/** Tablet and desktop: wordmark, the main destinations, Host a meal and the account entry. */
export function TopNav() {
  const session = useSignedIn();
  const location = useLocation();
  const navigate = useNavigate();
  const createHref = useCreateHref();
  const here = location.pathname === '/' ? '/discover' : location.pathname + location.search;
  return (
    <header className="topnav">
      <Link className="wordmark" to="/" aria-label="Fancy home">Fancy</Link>
      <nav aria-label="Main navigation">
        <NavLink to="/discover" end>Discover</NavLink>
        <NavLink to="/meals" end>My meals</NavLink>
        <NavLink to="/inbox" end>Inbox</NavLink>
      </nav>
      <div className="right">
        <Link className="link" to={createHref}><PlusIcon width={14} height={14} aria-hidden="true" />Host a meal</Link>
        {session ? (
          <NavLink to="/profile" end aria-label="Your profile" className="avatar-link">
            <Avatar name={session.user.displayName} url={session.user.avatarUrl} size={34} />
          </NavLink>
        ) : (
          <button type="button" className="btn" onClick={() => navigate(signInPath(here))}>Sign in</button>
        )}
      </div>
    </header>
  );
}
