# UX contract

Business source: ../docs/product/PRD.zh-CN.md §§3–10. Product brief is background only. All payment, reservation, permissions and lifecycle behavior in this prototype is a local simulation, not a live service.

| Capability     | Canonical owner                                              | Source of truth | Allowed variants                                 | Verification                             |
| -------------- | ------------------------------------------------------------ | --------------- | ------------------------------------------------ | ---------------------------------------- |
| Form           | Field + runtime KeyboardInput/KeyboardTextarea               | PRD §§6–10      | apply/create/profile/message                     | Browser main journeys; domain validation |
| Select/Listbox | Native select for creation; ChoiceGroup radios for discovery | PRD §§6–10      | creation slots; discovery filter chips           | Browser open/select and keyboard         |
| Date           | DateChoices native-radio month/day chooser                   | PRD §§6–10      | October2026 onward; demo past-date boundary16Oct | en-GB London date formatting             |
| Toast          | Prototype notify / single role=status                        | PRD §§6–10      | success/info/error context                       | Browser visible outcome                  |
| Scrollbar      | src/prototype.css                                            | PRD §§6–10      | global application + runtime scroll              | Browser computed styles                  |
| CRUD           | Prototype navigation + domain.ts                             | PRD §§6–10      | local meal creation and applications             | Browser create/read/cancel flow          |

No table selection applies. Local state resets on refresh. No network CRUD, provider calls, session or authentication is built.

Flow ledger: discover retains filters across list/map and back navigation; profile edits opened from application return to the preserved introduction; host approval precedes payment; successful payment only increments attendance once; a confirmed participant may chat; cancellation releases the seat and chat becomes inaccessible/read-only gate. A paid cancellation displays separate refund state. FR-04's real-time expiry and provider unknown-result handling remain target contracts, not implemented timers/providers. User closes or navigates away from text input by hiding the runtime keyboard. Native inputs are not used for text entry.

Create drafts remain in memory across back navigation. Re-opening creation resumes the draft; refresh/reset intentionally clears the demonstration. Published meals appear in Discover and Hosting. Decisions use immutable local state updates.

Feedback: public references and private reconnect choice are separate. Mutual connection is triggered by an explicit demo action. A block overrides private contact. Reports are recorded locally with an honest result, not sent to a support team.

Permissions/privacy target: profiles are fictional public projections; role switching is not authentication. Never infer production authorization from hidden buttons. User/host actions in this demo deliberately show what future service boundaries must enforce.

Discovery filtering uses pendingFilters separate from applied filters. Closing restores unchanged results; apply commits; clear affects the draft until apply. Quick date/size preserves other fields. Domain grouping counts matching events by area; selection falls back to a remaining area after filtering. Previous/next is bounded and disabled at ends. Whole-card semantic hit button is a sibling of avatar buttons, never nested around interactive content. Scope grip/list/pager controls outside the detail hit target. Source: PRD FR-01a / FR-03a.

## Create meal contract — 2026-10-16
- Four steps: Arrange, Introduce, Costs, Review. Reuse ChoiceGroup and DateChoices; app-owned restaurant cards extend selection without changing the mobile runtime.
- Venue/date/capacity determine fictional availability; invalidate incompatible time and external attestation. Step transitions reset scroll, preserve draft, and dismiss keyboard.
- Budget and charge are distinct. Offline £0 / variable deposit / fixed menu; publishing collects £0. Approval-time amount flows into Meal.deposit and guest payment displays.
- External booking is explicitly a host report, not provider verification. In-app selection is not a reservation hold.
- Publish requires final acknowledgement and revalidation. Success clears the draft; session-only drafts do not survive reload.

## Brand and account entrance
BrandEntrance reuses MobileScroll, keyboard-aware fields, ChoiceGroup and BottomSheet. Startup splash is skippable; guest browsing stays open. go/root guard participation and private destinations and remember afterAuth. New demo identities complete a minimal public profile; returning demo identities bypass setup. OTP is visibly fictional123456, resend30s, expiration5min; Google/Apple are labelled simulations and cancellable. No real authentication, emails, token storage, legal contract acceptance or permission requests. Login state is memory-only; refresh resets it. SelfProfileContext projects selected avatar/name consistently without mutating fixtures.

## Inbox, membership and Settings — 2026-10-16
Inbox contains application next steps and conversations; pending requests must not look like no activity. Shared inboxStage/groupChatAccess derive admission from per-meal membership. Host approval is the sole admission decision; paid meals also require successful payment. Restaurant PENDING/FAILED is independent. Former confirmed guests retain a frozen read-only archive after cancellation; never-confirmed requests never receive group access. Composer and list use the same permission helper. countUp records prior admission and avoids duplicates. Demo approval is explicitly labelled on each relevant Inbox card; Track in Inbox links from application status.
Settings lives only on one's own Profile. In-memory switches affect approval banners and Inbox previews. Sign-out confirmation, intro replay and demo reset are distinct. No real push permissions, fake account deletion or inactive language selector.


## Current brand copy — 2026-10-18
BRAND in src/brand.ts owns Fancy name, lowercase wordmark, invitation, supporting welcome sentence and bilingual slogan. Welcome/discovery use Fancy a bite? as the main invitation; account and splash share the revised wordmark. Keep HTML browser/social metadata aligned. PRD brand migration status must describe actual UI. Legacy technical selectors, repository and URL do not imply old product branding.

## Product presentation, 18 October 2026
Use the capitalized Fancy wordmark. Default product screens omit prototype annotations, city marginalia and scenario/replay/reset controls. Acceptance tools are opt-in at `?review=1`; costs, cancellation terms and membership permissions remain visible. No live backend integrations were added.

## Full-flow consistency — 2026-10-18
- Payment confirms membership without confirming the restaurant; only hosts change reservations. Failed bookings retain confirmed group access; cancelled participants retain read-only history.
- Keep Cancelled separate from Upcoming. Store refund values per meal, blocks per member, and direct messages per contact. Self-avatar navigation uses current profile data.
- Normal product errors and pending-state copy contain no implementation remarks. Keep simulation controls in explicit acceptance mode. See PRD v0.4 and full-product-audit report for evidence and limitations.


## Meal helper contract — 2026-10-18
Canonical overlay: runtime BottomSheet; canonical fields: KeyboardInput/KeyboardTextarea; keyboard geometry: useKeyboardInsets/useMobileDevice. App-specific helper lives in Prototype.tsx, pure local request logic in assistant.ts. A phone-scoped scrollable transcript sits between fixed panel tools and its composer. Clamp the sheet to available keyboard/safe-area height. Closing stops speech and hides the keyboard. The sprite can be tucked to an accessible restore control.

Searches inherit discovery conditions but never mutate them. Follow-up criteria persist, including explicit relaxation; recommendations exclude unavailable/full/past/owned meals and use upper estimated cost. Result cards return to existing detail navigation. Contextual application/coordination drafts only use public meal facts and enter existing editors, with original login and membership gates; no direct submit or publish. Creation resets incompatible schedule/confirmation fields and leaves a slot for the user to choose. Draft transfer buttons disclose replacement.

Preferences are a proposed card until confirmed. My preferences can correct or delete; deletion also clears the conversation and transient query. Conversation clearing alone preserves approved preferences. Helper state is in memory and clears when its component unmounts (including authentication) or the page refreshes. No chat-body ingestion, automatic profile inference or third-party private data. Speech starts only after disclosure and the user’s start action, yields an editable transcript, and falls back to typing on failure/unavailability. Mocked speech acceptance is separate from real microphone testing. PRD FR-12 is authoritative.


## Helper home, docking and conversation lifetime — 2026-10-18
User browser feedback supersedes earlier immediate-history reopening. Each sprite activation opens the helper home in compact view; preferences close and unexpired conversation appears only through Continue conversation. A new home request or New conversation replaces the active transcript/query; approved preferences remain. My preferences is the sole deletion surface; its label explains clearing the context that used deleted preferences.

Pointer capture owns sprite dragging, measures device scale, uses a 6px threshold to suppress click, then snaps to the nearest side and clamps height. Tucked state keeps a partially visible sprite/paws and a 44px target, including drag and keyboard repositioning; it is absent while another keyboard composer is active. Cancelled gestures never open the helper. Position is in-memory and normalized within current safe bounds.

Larger view / Compact view replaces arrow-only resize controls. Message times and conversation start use Europe/London, with full ISO datetime attributes. A single 30-minute idle timer, plus checks before opening/submission, clears old temporary context and stops speech. Typing and meaningful helper activity renew the timer. Timeout keeps approved preferences and unsent chat text, returns home and explains the restart; it does not change membership/payment/reservation/chat permissions. The active conversation is not a persistent multi-session history service. Tests use virtual clock advancement and wait for phone/sheet animations before screenshots.

## Simulated map and helper revision — 18 October 2026
The latest helper toolbar has My preferences and no size/close controls. Existing sheet drag, overlay and Escape remain exit paths. Sprite touch dragging is owned by the launcher, not parent scroll. Maps own pan/pinch gestures, suppress a tap following a drag, and expose zoom/reset plus keyboard pan. Discovery searches the current viewport explicitly and can show no meals. Restaurant markers/search rows select a candidate; Use this restaurant alone updates the meal draft through its existing schedule invalidation. Search with no results keeps the prior confirmed venue. Google Maps, Places, location and reservation APIs remain unconnected.
