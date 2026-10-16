# UX contract

Business source: ../docs/PRD.zh-CN.md §§3–10. Product brief is background only. All payment, reservation, permissions and lifecycle behavior in this prototype is a local simulation, not a live service.

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
