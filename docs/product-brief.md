# Grab in London — confirmed product brief

> 中文正式需求与详细交互规格请以 [PRD](PRD.zh-CN.md) 为准。此文件保留早期讨论摘要。

## Purpose and audience
Help adults living in London build social connections over meals. International residents, newcomers and busy people with limited social circles are the primary audience. Networking and dating are incidental outcomes, not the main promise.

Confirmed slogan: “一起吃顿饭，认识新朋友。” / “Meet new people over a meal.”

## Demo versus delivery
The high-fidelity demo is an English-only mobile-style interactive web app using fictional profiles and simulated bookings and payments. It must not create real reservations or charges.

| Capability | Demo | Initial live release | Later releases |
| --- | --- | --- | --- |
| Party size, including host | 2–6, emphasize 3–6 | 3–6 | Add two-person meals |
| Reservations | In-app booking and externally booked meals | Host books externally and updates status | Integrate booking provider |
| Payments | Deposit or fixed-menu payment and refund states | Offline settlement with disclosed terms | Integrate payment provider |

## Discovery and profiles
Discover supports shared filters across list and map views: date/time, area, budget, cuisine, size, language, dietary needs and atmosphere. Map markers count matching meal events per neighbourhood; the selected area supports card pagination and a complete event list. Google Maps/Places data integration is not connected; a labelled external Maps URL opens the real neighbourhood for fictional venues.

Required profile fields: display name, avatar, introduction, London life situation, conversational languages and interests. Occupation, school and hometown are optional. Participation and feedback records are system-generated; new profiles explicitly have no history.

## Trust and participation
Logged-in members can view public host and confirmed participant profiles. Applicant lists are visible only to the host. Contact details, payment information and exact home addresses are private; complete historical attendance locations/times are not public by default.

Applicants send a short introduction. The host reviews profiles and accepts or declines; application-related questions remain tied to that meal. Pending applications do not occupy confirmed seats. After approval, payment-required meals display payment pending; payment confirms the seat. Meals without prepayment confirm immediately. Confirmed participants enter the meal group chat, with booking, time, location and payment arrangements pinned.

Past attendance does not automatically establish friendship. Continuing private chat requires mutual consent. Post-meal feedback and the private wish to meet again are separate. Public written feedback is revealed after both submit or the review window ends; private reports and block/report controls are separate. Do not give people a composite star score or imply verification guarantees safety. Specific deadlines remain to be designed.

## Booking, payments and cancellation
Support already-booked and pending-booking meals. Admission, payment, group formation and restaurant confirmation are separate states. Main demo path: host selects venue, slot and cost; applicant is approved; participant pays a deposit or fixed-menu fee; group and booking outcome is displayed. Estimated spend is not a fixed charge for ordinary a-la-carte meals.

Display cancellation deadlines and restaurant-specific deposit/refund terms before payment. Demo examples of insufficient attendance or booking failure show full refunds; do not promise one universal policy for all restaurants. Cancellation amounts and times are illustrative. Real provider and group-refund mechanics need validation before live implementation.

## Demo journeys and modules
Guest: discover a Friday four-person meal, switch list/map, inspect profiles, apply, receive approval, pay deposit, see reservation, join chat, review and mutually reconnect.

Host: create meal, choose venue and slot, set size and costs, review applications, manage reservation and participants. Include a two-person example.

Navigation: Discover, Meals, Inbox, Profile; prominent create-meal entry. Core screens include meal detail, profile, application, payment, booking outcome, meal chat and feedback. Familiar-person discovery is an optional proposed extension; private meals must not leak through it.

## Next design gate
Generate three distinct mobile discovery-screen concepts, choose one with the user, then implement the selected visual direction. No visual direction selected yet. Brand name remains provisional; the bilingual slogan is confirmed. Demo simulations must be clearly identified.
