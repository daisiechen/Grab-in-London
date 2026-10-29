import type { ReactNode } from 'react';

// Ported verbatim from admin/src/components.tsx (prototype icon set).
const paths: Record<string, ReactNode> = {
  overview: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 21v-7h7M14 14l7 7" /></>),
  journey: <path d="M4 4h16l-6 8v7l-4 2v-9z" />,
  supply: (<><path d="M3 7h18M5 7v13M19 7v13M8 3v4M16 3v4M3 13h18" /><circle cx="12" cy="17" r="1" /></>),
  retention: (<><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" /><path d="M12 8v4l3 2" /></>),
  quality: (<><path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" /><path d="M8 12l3 3 5-6" /></>),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  search: (<><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>),
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></>),
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  flag: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  globe: (<><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>),
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] ?? paths.info}
    </svg>
  );
}
