import type { ReactElement } from 'react';
import { LEGAL_PATHS, LegalRedirect } from '../features/legal/LegalRedirect.tsx';
import { HomePage } from '../features/home/HomePage.tsx';
import { GetAppPage } from '../features/home/GetAppPage.tsx';
import { lazyPage, type LazyPage } from './lazyPage.tsx';

/*
 * Route-level code splitting: the shell, home page and legal redirects are in the entry chunk;
 * every other page loads with its route group (one chunk per file in ./pages) on first visit.
 */
const discover = () => import('./pages/discover.ts');
const meals = () => import('./pages/meals.ts');
const auth = () => import('./pages/auth.ts');
const apply = () => import('./pages/apply.ts');
const create = () => import('./pages/create.ts');
const host = () => import('./pages/host.ts');
const inbox = () => import('./pages/inbox.ts');
const profile = () => import('./pages/profile.ts');
const account = () => import('./pages/account.ts');
const postMeal = () => import('./pages/post-meal.ts');

const DiscoverPage = lazyPage(discover, (m) => m.DiscoverPage);
const MealDetailPage = lazyPage(meals, (m) => m.MealDetailPage);
const MyMealsPage = lazyPage(meals, (m) => m.MyMealsPage);
const CancellationTermsPage = lazyPage(meals, (m) => m.CancellationTermsPage);
const SignInPage = lazyPage(auth, (m) => m.SignInPage);
const OAuthCallbackPage = lazyPage(auth, (m) => m.OAuthCallbackPage);
const ApplyPage = lazyPage(apply, (m) => m.ApplyPage);
const ApplicationStatusPage = lazyPage(apply, (m) => m.ApplicationStatusPage);
const CreatePage = lazyPage(create, (m) => m.CreatePage);
const EditMealPage = lazyPage(create, (m) => m.EditMealPage);
const HostPage = lazyPage(host, (m) => m.HostPage);
const InboxPage = lazyPage(inbox, (m) => m.InboxPage);
const NotificationsPage = lazyPage(inbox, (m) => m.NotificationsPage);
const ChatPage = lazyPage(inbox, (m) => m.ChatPage);
const ProfilePage = lazyPage(profile, (m) => m.ProfilePage);
const ProfileEditPage = lazyPage(profile, (m) => m.ProfileEditPage);
const PublicProfilePage = lazyPage(profile, (m) => m.PublicProfilePage);
const SettingsPage = lazyPage(account, (m) => m.SettingsPage);
const SurveyPage = lazyPage(account, (m) => m.SurveyPage);
const DeletionPage = lazyPage(account, (m) => m.DeletionPage);
const DeletionStatusPage = lazyPage(account, (m) => m.DeletionStatusPage);
const BlockedMembersPage = lazyPage(account, (m) => m.BlockedMembersPage);
const ReportPage = lazyPage(account, (m) => m.ReportPage);
const ReportStatusPage = lazyPage(account, (m) => m.ReportStatusPage);
const PostMealPage = lazyPage(postMeal, (m) => m.PostMealPage);

/** Every lazily loaded page (tests preload them; see src/test/setup.ts). */
export const lazyPages: readonly LazyPage<object>[] = [
  DiscoverPage, MealDetailPage, MyMealsPage, CancellationTermsPage, SignInPage, OAuthCallbackPage, ApplyPage, ApplicationStatusPage,
  CreatePage, EditMealPage, HostPage, InboxPage, NotificationsPage, ChatPage, ProfilePage, ProfileEditPage as LazyPage<object>, PublicProfilePage,
  SettingsPage, SurveyPage, DeletionPage, DeletionStatusPage, BlockedMembersPage, ReportPage, ReportStatusPage, PostMealPage,
];
export const preloadAllPages = () => Promise.all(lazyPages.map((page) => page.preload())).then(() => undefined);

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
  { path: '/meals/:mealId/edit/introduce', element: <EditMealPage /> },
  { path: '/meals/:mealId/edit/costs', element: <EditMealPage /> },
  { path: '/meals/:mealId/edit/review', element: <EditMealPage /> },
  { path: '/meals/:mealId/apply', element: <ApplyPage /> },
  { path: '/meals/:mealId/status', element: <ApplicationStatusPage /> },
  { path: '/meals/:mealId/host', element: <HostPage /> },
  { path: '/cancellation-terms', element: <CancellationTermsPage /> },
  { path: '/meals/:mealId/:slug', element: <MealDetailPage /> },
  { path: '/create', element: <CreatePage /> },
  { path: '/create/introduce', element: <CreatePage /> },
  { path: '/create/costs', element: <CreatePage /> },
  { path: '/create/review', element: <CreatePage /> },
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
  { path: '/deletion-status', element: <DeletionStatusPage /> },
  { path: '/report', element: <ReportPage /> },
  { path: '/blocked-members', element: <BlockedMembersPage /> },
  { path: '/settings/reports/:reportId', element: <ReportStatusPage /> },
  { path: '/post-meal/:mealId', element: <PostMealPage /> },
  ...LEGAL_PATHS.map((path) => ({ path, element: <LegalRedirect path={path} /> })),
];
