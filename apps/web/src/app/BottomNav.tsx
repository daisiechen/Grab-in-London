import { NavLink } from 'react-router';
import { ChatBubbleIcon, MagnifyingGlassIcon, PersonIcon, PlusIcon } from '@radix-ui/react-icons';

/** Filled active glyphs, as demo/src/Prototype.tsx NavGlyph. */
function NavGlyph({ kind, active }: { kind: 'search' | 'person' | 'chat'; active: boolean }) {
  if (!active) return kind === 'search' ? <MagnifyingGlassIcon /> : kind === 'chat' ? <ChatBubbleIcon /> : <PersonIcon />;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-filled="true" fill="currentColor">
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

const items = [
  { to: '/discover', label: 'Discover', kind: 'search' },
  { to: '/meals', label: 'Meals', kind: 'person' },
  { to: '/inbox', label: 'Inbox', kind: 'chat' },
  { to: '/profile', label: 'Profile', kind: 'person' },
] as const;

export function BottomNav() {
  const link = (item: (typeof items)[number]) => (
    <NavLink key={item.to} to={item.to} end={item.to === '/meals'} className={({ isActive }) => (isActive ? 'active' : '')}>
      {({ isActive }) => <><NavGlyph kind={item.kind} active={isActive} /><span>{item.label}</span></>}
    </NavLink>
  );
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {link(items[0])}
      {link(items[1])}
      <NavLink to="/create" className="create-nav">
        <span className="create-circle"><PlusIcon /></span>
        <span>Create meal</span>
      </NavLink>
      {link(items[2])}
      {link(items[3])}
    </nav>
  );
}
