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
| Auth | expo-auth-session + expo-web-browser (system browser, PKCE app challenge) → provider `code/state` → core `oauthCallback` JSON → one-time `handoffCode` → `exchangeHandoff`; email OTP via same API |
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

### Run on a simulator or iPhone with preview data (no server needed)

On a Mac with Xcode, from `apps/ios` (copy `.env.example` to `.env` and fill the Google key first):

- `pnpm ios:preview` — builds the development app and opens it in the iOS Simulator
- `pnpm ios:preview:device` — same, on a USB-connected iPhone (Xcode signs with your Apple ID team)

`EXPO_PUBLIC_FANCY_PREVIEW=1` swaps the API for the in-memory demo data in `src/preview/`
(sign in with any email and code `000000`). Without the Google key, Discover shows the illustrated map.

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
The Google native map and Ask Fancy implementation are described below. Missing map credentials
or a native Google map module produce a list fallback. Actual provider and device acceptance remain
external gates; no fake AI response is substituted.

### Ask Fancy and native map implementation

Ask Fancy uses the generated API operations. Only the anonymous guest bearer and its
fixed 24-hour expiresAt are stored in this-install SecureStore. AI device/session credentials,
conversation text, confirmed guest preferences and assistant drafts remain RAM-only.
Shared installation initialization clears old refresh and guest records before creating the
sandbox marker. Locked, corrupt or failed guest storage blocks AI requests rather than
creating a replacement subject. Retrying an uncertain request reuses its request ID. Exact idle
expiry preserves unsent input; NEW clears guest preferences. Account changes clear local
assistant state and delete the guest SecureStore record. Native login passes the restored
guest bearer only to verifyEmail/exchangeHandoff for atomic server revocation; other core
operations never receive this bearer. Active AI sessions also attempt revocation with captured
old guest credentials. If offline,
server TTL limits the unreachable session. Backgrounded/closed views ignore late answers.

Application, create-meal and live group-chat editors register only while focused. Transferring
a candidate validates server permissions and the current editor version, asks before replacing
existing text, checks again after the request, and never submits/publishes/sends the form.
Messages acknowledge only active viewability progress, with monotonic high water marks and
no automatic acknowledgement retry loop.

Google Places results use the Google native map provider only. Set the separate, bundle-visible
`EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` restricted to the iOS bundle ID and Maps SDK for iOS.
`app.config.js` configures the react-native-maps native plugin; this requires a new development
build. Missing key, Expo Go, or missing Google native module shows the list fallback. The
private server Places key must never be reused here. Google SDK/native rendering, device
installation, Apple signing, real DeepSeek credentials/pricing/token counting and real model
acceptance remain external gates; Jest native substitutes and JS export do not verify them.

### Optional native analytics

Usage analytics starts disabled. Explicit consent obtains a signed analytics-only scope via
`x-fancy-analytics-scope`; the native server branch sets no cookie. The scope and bounded fixed-metadata
event queue live only in RAM and clear on account/session changes. Source hooks report actual focused
foreground presentation, discovery proofs and continuous 50%/one-second list visibility. Search input,
message text and client-invented business success/result counts are not sent. Missing native protocol
fails closed; component tests do not establish the device networking stack's behavior.


### Native OAuth and account reauthentication bridge

Google/Apple returns the original provider `code/state` to the exact registered
`fancy://auth/callback` base. The app keeps the authorization URL's real provider state in RAM
(distinct from `stateTransactionId`), rejects duplicate fields/fragments or a mismatched state,
and relays code/state to the core `oauthCallback` API. Only the core exchanges the provider code
with its stored verifier/nonce. Login then redeems the core JSON handoff using the app verifier.
Raw `handoffCode` and link tickets from callback URLs are rejected; LINK_REQUIRED is accepted
only from the HTTPS core JSON response and kept in RAM. The app never receives provider secrets.

OAuth and emailed-code reauthentication return the existing family's JSON session. The client
revalidates that family and rechecks actor/generation before retrying the original deletion key
and receipt. It never signs in a replacement family to complete reauthentication. Failure,
account switch or screen unmount stops the pending path; repeated REAUTH_REQUIRED after a verified
attempt shows failure instead of recursively launching another deletion attempt. Local synthetic
protocol and race tests do not replace real Auth0/Google/Apple configuration and device acceptance.
