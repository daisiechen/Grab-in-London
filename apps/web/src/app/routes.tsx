import type { ReactElement } from 'react';
import { SurveyPage } from '../features/settings/SurveyPage.tsx';
import { DeletionPage } from '../features/settings/DeletionPage.tsx';
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
import { EditMealPage } from '../features/create/EditMealPage.tsx';
import { ApplyPage } from '../features/apply/ApplyPage.tsx';
import { HostPage } from '../features/host/HostPage.tsx';
import { InboxPage } from '../features/inbox/InboxPage.tsx';
import { NotificationsPage } from '../features/inbox/NotificationsPage.tsx';
import { ChatPage } from '../features/inbox/ChatPage.tsx';
import { PostMealPage } from '../features/post-meal/PostMealPage.tsx';
import { ReportStatusPage } from '../features/reports/ReportStatusPage.tsx';

export interface AppRoute { path: string; element: ReactElement }

/** Route table; each feature slice registers its pages here. */
export const appRoutes: AppRoute[] = [
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/auth/callback', element: <OAuthCallbackPage /> },
  { path: '/discover', element: <DiscoverPage /> },
  { path: '/meals', element: <MyMealsPage /> },
  { path: '/meals/:mealId', element: <MealDetailPage /> },
  { path: '/meals/:mealId/edit', element: <EditMealPage /> },
  { path: '/meals/:mealId/apply', element: <ApplyPage /> },
  { path: '/meals/:mealId/host', element: <HostPage /> },
  { path: '/create', element: <CreatePage /> },
  { path: '/create/terms', element: <CreatePage /> },
  { path: '/inbox', element: <InboxPage /> },
  { path: '/inbox/notifications', element: <NotificationsPage /> },
  { path: '/inbox/:conversationId', element: <ChatPage /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/profile/edit', element: <ProfileEditPage /> },
  { path: '/profiles/:userId', element: <PublicProfilePage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/settings/survey', element: <SurveyPage /> },
  { path: '/settings/deletion', element: <DeletionPage /> },
  { path: '/settings/reports/:reportId', element: <ReportStatusPage /> },
  { path: '/post-meal/:mealId', element: <PostMealPage /> },
];
