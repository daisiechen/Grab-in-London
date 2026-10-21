import type { ReactElement } from 'react';

export interface AppRoute { path: string; element: ReactElement }

/** Route table; each feature slice registers its pages here. */
export const appRoutes: AppRoute[] = [];
