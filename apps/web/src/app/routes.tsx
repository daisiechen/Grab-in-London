import type { ReactElement } from 'react';
import { SignInPage } from '../features/auth/SignInPage.tsx';
import { OAuthCallbackPage } from '../features/auth/OAuthCallbackPage.tsx';
import { ProfilePage } from '../features/profile/ProfilePage.tsx';
import { ProfileEditPage } from '../features/profile/ProfileEditPage.tsx';
import { PublicProfilePage } from '../features/profile/PublicProfilePage.tsx';
import { SettingsPage } from '../features/settings/SettingsPage.tsx';
import { DiscoverPage } from '../features/discover/DiscoverPage.tsx';
import { MealDetailPage } from '../features/meals/MealDetailPage.tsx';
import { MyMealsPage } from '../features/meals/MyMealsPage.tsx';
import { CreatePage } from '../features/create/CreatePage.tsx';
import { TermsPage } from '../features/create/TermsPage.tsx';
import { EditMealPage } from '../features/create/EditMealPage.tsx';

export interface AppRoute { path: string; element: ReactElement }

/** Route table; each feature slice registers its pages here. */
export const appRoutes: AppRoute[] = [
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/auth/callback', element: <OAuthCallbackPage /> },
  { path: '/discover', element: <DiscoverPage /> },
  { path: '/meals', element: <MyMealsPage /> },
  { path: '/meals/:mealId', element: <MealDetailPage /> },
  { path: '/meals/:mealId/edit', element: <EditMealPage /> },
  { path: '/create', element: <CreatePage /> },
  { path: '/create/terms', element: <TermsPage /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/profile/edit', element: <ProfileEditPage /> },
  { path: '/profiles/:userId', element: <PublicProfilePage /> },
  { path: '/settings', element: <SettingsPage /> },
];
