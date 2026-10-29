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
import { ApplicationStatusPage } from '../features/apply/ApplicationStatusPage.tsx';
import { HostPage } from '../features/host/HostPage.tsx';
import { InboxPage } from '../features/inbox/InboxPage.tsx';
import { NotificationsPage } from '../features/inbox/NotificationsPage.tsx';
import { ChatPage } from '../features/inbox/ChatPage.tsx';
import { PostMealPage } from '../features/post-meal/PostMealPage.tsx';
import { ReportStatusPage } from '../features/reports/ReportStatusPage.tsx';
import { LEGAL_PATHS, LegalRedirect } from '../features/legal/LegalRedirect.tsx';
import { HomePage } from '../features/home/HomePage.tsx';
import { GetAppPage } from '../features/home/GetAppPage.tsx';
import { CancellationTermsPage } from '../features/meals/CancellationTermsPage.tsx';
import { ReportPage } from '../features/reports/ReportPage.tsx';
import { BlockedMembersPage } from '../features/settings/BlockedMembersPage.tsx';

export interface AppRoute { path: string; element: ReactElement }

/** Route table. Paths match the iOS app (apps/ios/app) so shared links and emails open the same page on both. */
export const appRoutes: AppRoute[] = [
  { path: '/', element: <HomePage /> },
  { path: '/get-app', element: <GetAppPage /> },
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/auth/callback', element: <OAuthCallbackPage /> },
  { path: '/discover', element: <DiscoverPage /> },
  { path: '/meals', element: <MyMealsPage /> },
  { path: '/meals/:mealId', element: <MealDetailPage /> },
  { path: '/meals/:mealId/edit', element: <EditMealPage /> },
  { path: '/meals/:mealId/apply', element: <ApplyPage /> },
  { path: '/meals/:mealId/status', element: <ApplicationStatusPage /> },
  { path: '/meals/:mealId/host', element: <HostPage /> },
  { path: '/cancellation-terms', element: <CancellationTermsPage /> },
  { path: '/meals/:mealId/:slug', element: <MealDetailPage /> },
  { path: '/create', element: <CreatePage /> },
  { path: '/create/terms', element: <CreatePage /> },
  { path: '/inbox', element: <InboxPage /> },
  { path: '/notifications', element: <NotificationsPage /> },
  { path: '/chat/:conversationId', element: <ChatPage /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/profile-edit', element: <ProfileEditPage /> },
  { path: '/profile-setup', element: <ProfileEditPage key="setup" mode="setup" /> },
  { path: '/profiles/:userId', element: <PublicProfilePage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/survey', element: <SurveyPage /> },
  { path: '/delete-account', element: <DeletionPage /> },
  { path: '/deletion-status', element: <DeletionPage /> },
  { path: '/report', element: <ReportPage /> },
  { path: '/blocked-members', element: <BlockedMembersPage /> },
  { path: '/settings/reports/:reportId', element: <ReportStatusPage /> },
  { path: '/post-meal/:mealId', element: <PostMealPage /> },
  ...LEGAL_PATHS.map((path) => ({ path, element: <LegalRedirect path={path} /> })),
];
