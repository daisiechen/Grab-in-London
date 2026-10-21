# @fancy/ios — React Native / Expo development build (T-03)

Native iOS client for Fancy. Same business paths, copy and visual tokens as the prototype
(`demo/src/Prototype.tsx`, `demo/DESIGN.md`, `demo/UX-CONTRACT.md`) adapted to native navigation,
system controls and the system keyboard. No WebView screens, no Expo Go acceptance, no payments
(external booking is pay-at-venue only), no push notifications.

Authoritative rules live in `docs/` (PRD §0, `docs/engineering/api-and-client-contract.zh-CN.md` §5,
`core-development-plan.zh-CN.md`, `validation-and-release.zh-CN.md`) and `tasks/todo.md` (T24/T25/T26/A07).
This file only records the iOS module layout and how to run it.

## Stack

| Concern | Choice |
| --- | --- |
| Runtime | Expo SDK 58 (expo 58.0.16), React Native 0.88.0, React 19.3.0, New Architecture, Hermes |
| Navigation | expo-router 58 (file routes on react-native-screens native stack + native tabs) |
| API | `@fancy/client` (`createApiClient` bearer credentials, `withRetry`, `newIntentKey`, `ApiError`), DTO types from `@fancy/contracts` |
| Auth | expo-auth-session + expo-web-browser (system browser, PKCE app challenge) → one-time `handoffCode` → `exchangeHandoff`; email OTP via same API |
| Session storage | access token in memory only; rotating refresh token in expo-secure-store (Keychain, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`); install marker so a reinstall never reuses an old Keychain item |
| Time input | `@react-native-community/datetimepicker` + server 422 `TIME_AMBIGUOUS` choices (explicit BST/GMT) / `TIME_NONEXISTENT` error |
| Tests | jest-expo 58 (`jest-expo/ios` preset) + @testing-library/react-native 14, isolated mock `fetch` only |
| Types | TypeScript 5.9.3 (workspace version) extending `expo/tsconfig.base` with the workspace strict flags |

## Module layout

```
app/                                   expo-router routes (thin; render feature screens)
  _layout.tsx                          polyfills, SessionProvider, AppState poll lifecycle, Stack
  (tabs)/_layout.tsx                   Discover · Meals · [Create circle] · Inbox · Profile
  (tabs)/index.tsx                     Discover (map/list)
  (tabs)/meals.tsx                     Meals: Upcoming / Applications / Hosting / Past / Cancelled
  (tabs)/inbox.tsx                     Inbox: Chats / Applications
  (tabs)/profile.tsx                   Own profile
  welcome.tsx, sign-in.tsx, otp.tsx    entrance, provider choice, email OTP
  auth/callback.tsx                    deep-link return (fancy://auth/callback)
  profile-setup.tsx                    profileGate completion, then resume pending intent
  meal/[mealId]/index.tsx              meal detail (guest projection)
  meal/[mealId]/apply.tsx              application draft (20–300 chars) + login/profileGate resume
  meal/[mealId]/host.tsx               host view: approve/decline (If-Match, 409 recovery), cancel
  create/{arrange,introduce,costs,review}.tsx   four-step create (stack, back keeps draft)
  chat/[conversationId].tsx            group/direct chat
  post-meal/[mealId].tsx               attendance, ratings, public review, mutual choice; survey separate
  profiles/[userId].tsx, settings.tsx, terms.tsx
src/
  platform/polyfills.ts                crypto.randomUUID via expo-crypto (Hermes)        [phase 1]
  api/client.ts                        single ApiClient, base URL from EXPO_PUBLIC_API_BASE_URL, 401 → refresh once → re-auth
  api/cache.ts                         in-memory query cache; cleared on logout/account deletion/403
  api/ai.ts                            A07 only
  features/auth/                       session store, oauth (AuthSession+PKCE), otp, secure-storage, profileGate, logout
  features/profile/                    Me view/edit (lengths 2–40 / 20–1000), public profile
  features/discover/                   filters (dates OR, cross-field AND), map/list, Places attribution
  features/create/                     draft, TimeInput (BST/GMT choice, nonexistent error), venue confirm, booking declaration
  features/meals/                      detail, apply, host approval, five sections
  features/inbox/                      conversations, poller (foreground 2s, paused in background, 2/4/8/16/30s jittered backoff, catch-up on resume after re-auth), no offline send queue
  features/post-meal/                  attendance/ratings/review/survey
  features/settings/                   logout, report/deletion receipts (reauth), privacy
  features/assistant/                  A07 only
  ui/                                  tokens (forest #123f35, ink #10241f, muted #6c746f, border #e4e7e2, surface #f5f6f1, peach #ffb49b, danger #a93b32; radius 7/11/19; page 21; button 45, field 43, create circle 53), Field, Primary, ChoiceChips, BottomSheet, StatusBanner
  test/                                mockFetch, fixtures built from @fancy/contracts DTO shapes
```

Phase order: T24 (shell, auth, profile) → T25 (discover, venue, create, approve) → T26 (inbox, post-meal,
settings) → A07 (assistant). Each feature keeps its `*.test.ts(x)` next to the code.

## Commands

From the repository root after `source infra/dev-env.sh`:

- `pnpm --filter @fancy/ios typecheck`
- `pnpm --filter @fancy/ios test` — jest-expo; files are `*.test.ts(x)` so the root vitest
  `unit` project (`*.unit.test.ts`) never collects React Native tests
- `pnpm --filter @fancy/ios start` — Metro for a development build (needs `expo run:ios` first)

Native build (`expo prebuild` / `expo run:ios`), simulator and device runs are blocked by G-IOS
(full Xcode, Apple Developer team, signing). `ios.bundleIdentifier` `com.example.fancy.dev` is a
placeholder; no team id is committed. Generated `ios/` is not committed (Continuous Native Generation).


## Codex takeover verification (2026-10-21)

The transferred T24–T26 client includes auth/profile, discovery/list filters, restaurant selection,
four-step hosting, applications/host decisions, inbox/chat, post-meal feedback, reporting and deletion
receipt screens. Their fetch tests use isolated API responses; this is not proof of server integration.

The takeover adds session-lifetime response guards, serialized Keychain writes/deletes, a real
`expo-file-system` sandbox install marker, storage-failure recovery, strict callback matching,
account-scoped private React state, stopped-poller response guards and complete own-list/history
cursor traversal. Regression tests cover late responses after logout, an old Keychain write racing a
new sign-in, cleanup failures, cross-account chat/profile drafts and callback prefix confusion.

Run JS bundle validation without accounts or Xcode license acceptance:

```sh
EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 pnpm --filter @fancy/ios exec expo export --platform ios --output-dir /private/tmp/fancy-ios-export
```

This produces an iOS Hermes bundle, not a signed app. Native compilation, simulator/device keyboard
and navigation, actual OAuth/email, native Maps/Places and cross-end API flows remain unverified.
The map surface is pending the native map integration. Dual-proof `LINK_REQUIRED` completion and
reauth completion require server protocol agreement. A07 AI assistant is not implemented; no AI
operation exists in the current shared SDK contract. No fake AI response is substituted.
