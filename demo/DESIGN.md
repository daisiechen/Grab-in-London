---
version: alpha
name: Fancy
description: A map-first social dining app for London residents.
colors:
  primary: "#123f35"
  text: "#10241f"
  muted: "#6c746f"
  border: "#e4e7e2"
  surface: "#f5f6f1"
  accent: "#ffb49b"
  danger: "#a93b32"
typography:
  sans:
    fontFamily: "Arial, Helvetica, sans-serif"
rounded:
  DEFAULT: "11px"
  sm: "7px"
  lg: "19px"
spacing:
  page: "21px"
  section: "27px"
components:
  button: { minHeight: "45px" }
  field: { minHeight: "43px" }
  nav: { createDiameter: "53px" }
---

# Fancy Design System

## Overview

### Creative North Star

The selected map-first reference shows central London, forest-green pins, a peach selected location, white meal sheet and bottom navigation. The user's revision places the prominent Create meal circle at the bottom centre. Recreate this reference, with live text/controls rather than a flattened screenshot.

### Product context and register

Product register. International adults living in London; English-only UI, GBP and London local time. Slogan: Meet new people over a meal. Chinese counterpart: 吃个饭，认识一下。 Mobile use for arranging a meal and meeting friends. Do not emulate dating swipes, credential rankings or a marketing landing page. The signature is a restaurant map above a human-scale meal preview. All imagery and participants are fictional demo assets.

Token ownership: app tokens in `src/prototype.css` implement the values above. The protected mobile runtime owns frame geometry, status bar, device chooser and keyboard. No new theme or custom device chrome.

## Colors

Forest for primary actions, peach for the selected pin, white base, pale green information surfaces. Ink for text, muted for secondary copy, red only for errors/cancellation. Single light theme. A selected state includes text or pressed semantics.

## Typography

Arial/Helvetica for a close match to the chosen simple sans reference. Headings 27–29px, section titles17px, body14px, controls13px, supporting meal metadata11px, compact brand captions9–10px. Do not crowd map or preview with a feature inventory.

## Layout

App content is designed within the protected393×852 iPhone screen; Pixel427×952 also supported. Account for device safe areas, fixed tabs, and keyboard. Header → map/list → selected meal → nav. Detail pages scroll with fixed back toolbar. Bottom creation circle must not obscure event pagination or card content. Global scrollbar styles are in prototype.css; native fields use platform-owned geometry.

## Elevation & Depth

Use separation through whitespace and hairlines. Bottom sheets use the runtime Radix dialog. Shadows only on location controls, the raised create action and transient status message.

## Shapes

Controls11px, smaller labels7px, map preview19px top corners. Avatars and create button circular. Pins are interactive controls with one clear numeric meaning: number of filtered meals in the neighbourhood.

## Components

### Foundational visual states

Buttons have hover, pressed, visible focus, disabled and processing states. Form errors are inline with retained input. Status messages use a live region. Empty results include clear filters. Payment errors are recoverable and never clear approval.

### Buttons and actions

Primary and secondary share sizing. Destructive cancellation separated from keep-place action. Bottom navigation labels always visible. Create meal projects above nav.

### Navigation and data display

Four destinations plus central creation. Page back restores route history; discovery retains filters and selection. Membership, booking and payment statuses stay distinct.

### Forms and overlays

KeyboardInput/KeyboardTextarea, shared Field and Primary. Discovery uses shared styled native-radio choice groups and a month/day choice grid, with draft/apply semantics. Creation reuses those choices and the month calendar, with restaurant cards and availability-dependent time chips. Runtime BottomSheet owns focus trapping and dismissal. No browser-native alerts/confirm/prompt. Every overlay fits phone bounds and scrolls.

## Motion

Runtime transitions remain intact. App motion restrained; respects prefers-reduced-motion.

## Content

Plain English and friendship-first intent. Display no real-booking/no-charge ribbon. Demo controls explicitly label simulated actions; no fake live inventory or real human response.

## Discovery review revision

Date and Table size are the two primary filters. All-filter choices are outlined chips with pale-green selected surfaces and checkmarks; labels wrap rather than truncate. The map's selected area has an event count, whole-card action, independent avatars and bounded previous/next pagination. Grip/View all opens an area list. No duplicate View meal or arrow is present. Keep the map-first frame and established colour/type system.

## Create meal revision
Four steps: Arrange / Introduce / Costs / Review. Restaurant cards, shared native-radio choices and calendar own selection; money fields use KeyboardInput. White/forest surfaces and a dark payment receipt separate estimated spend from approval-time payment. Review groups link back to edit; schedule changes invalidate incompatible slots and external attestation. Demo inventory is explicitly fictional.

## Brand entrance — 2026-10-16
Fancy wordmark in bold compact lowercase with a directional icon; forest #123f35, citrus #d7ee79, ivory #f5f2e8 and vermilion #e96943. Brand artwork `public/images/brand-table.png` generated independently for this project. Welcome uses the table as the gathering metaphor; the existing map remains forest/white. Entrance owns expressive motion, with reduced-motion fallback and a skip action. Never copy the reference's handwritten identity, purple/black grid or gradient controls. Branding is an iterative prototype, not trademark clearance.

## Inbox and Settings refinement
Pending application cards use a three-step status track, membership explanation and pale-green demo panel. Approved payment-required cards reuse checkout. Conversation rows show the correct host and last message or hidden previews, and label archives. Settings groups notifications/previews, privacy/safety, account and demo tools using existing hairlines and controls; Profile gear appears only on the owner's page.

## Current brand — 2026-10-18
Fancy replaces the former Grab UI identity. Wordmark:fancy, no in London suffix; use72px welcome /96px splash /42px account sizes with less negative tracking. Main welcome and discovery invitation:Fancy a bite?; secondary welcome support:There’s a seat for you here.; slogan:Meet new people over a meal. / 吃个饭，认识一下。. Preserve table artwork and forest/citrus/ivory/vermilion palette. brand.ts owns app-visible copy; index.html owns browser/social metadata. The legacy repository/URL and .grab-app technical selectors remain intentionally.

## Product presentation, 18 October 2026
Use the capitalized Fancy wordmark. Default product screens omit prototype annotations, city marginalia and scenario/replay/reset controls. Acceptance tools are opt-in at `?review=1`; costs, cancellation terms and membership permissions remain visible. No live backend integrations were added.

## Full-flow consistency — 2026-10-18
- Payment confirms membership without confirming the restaurant; only hosts change reservations. Failed bookings retain confirmed group access; cancelled participants retain read-only history.
- Keep Cancelled separate from Upcoming. Store refund values per meal, blocks per member, and direct messages per contact. Self-avatar navigation uses current profile data.
- Normal product errors and pending-state copy contain no implementation remarks. Keep simulation controls in explicit acceptance mode. See PRD v0.4 and full-product-audit report for evidence and limitations.


## Meal helper — 2026-10-18
The approved signature is a small original forest-green SVG sprite with citrus leaf, ivory eyes and peach cheeks. It sits above the main content as a collapsed, dismissible edge entry and never replaces a bottom destination. Reuse existing typography, forest/white/surface colours, 11px controls and BottomSheet. Expanded chat uses a quiet white panel, forest user bubbles and factual meal cards. No unsolicited animation or messages. This addition introduces no shared token changes; protected device/runtime styling stays intact.


## Helper browser feedback — 2026-10-18
The sprite now owns a draggable, edge-snapping position; a tucked version peeks from either side with two small paws rather than becoming an unrelated icon. Reuse its original SVG and palette. Keep it below toolbars and above navigation, with a visible tap target and no continuous animation; edge-snap motion respects reduced motion. Assistant home/resume, clearly named conversation/preferences actions, textual panel-size controls and subdued London timestamps replace ambiguous controls. No shared palette/type/runtime token changes.
