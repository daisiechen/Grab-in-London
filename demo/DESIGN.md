---
version: alpha
name: Grab in London
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

# Grab in London Design System

## Overview

### Creative North Star

The selected map-first reference shows central London, forest-green pins, a peach selected location, white meal sheet and bottom navigation. The user's revision places the prominent Create meal circle at the bottom centre. Recreate this reference, with live text/controls rather than a flattened screenshot.

### Product context and register

Product register. International adults living in London; English-only UI, GBP and London local time. Slogan: Meet new people over a meal. Chinese counterpart: 一起吃顿饭，认识新朋友。 Mobile use for arranging a meal and meeting friends. Do not emulate dating swipes, credential rankings or a marketing landing page. The signature is a restaurant map above a human-scale meal preview. All imagery and participants are fictional demo assets.

Token ownership: app tokens in `src/prototype.css` implement the values above. The protected mobile runtime owns frame geometry, status bar, device chooser and keyboard. No new theme or custom device chrome.

## Colors

Forest for primary actions, peach for the selected pin, white base, pale green information surfaces. Ink for text, muted for secondary copy, red only for errors/cancellation. Single light theme. A selected state includes text or pressed semantics.

## Typography

Arial/Helvetica for a close match to the chosen simple sans reference. Headings 27–29px, section titles17px, body14px, controls13px, supporting meal metadata11px, compact brand captions9–10px. Do not crowd map or preview with a feature inventory.

## Layout

App content is designed within the protected393×852 iPhone screen; Pixel427×952 also supported. Account for device safe areas, fixed tabs, and keyboard. Header → map/list → selected meal → nav. Detail pages scroll with fixed back toolbar. Bottom creation circle must not obscure View meal. Global scrollbar styles are in prototype.css; native fields use platform-owned geometry.

## Elevation & Depth

Use separation through whitespace and hairlines. Bottom sheets use the runtime Radix dialog. Shadows only on location controls, the raised create action and transient status message.

## Shapes

Controls11px, smaller labels7px, map preview19px top corners. Avatars and create button circular. Pins are interactive controls with one clear numeric meaning: total table capacity.

## Components

### Foundational visual states

Buttons have hover, pressed, visible focus, disabled and processing states. Form errors are inline with retained input. Status messages use a live region. Empty results include clear filters. Payment errors are recoverable and never clear approval.

### Buttons and actions

Primary and secondary share sizing. Destructive cancellation separated from keep-place action. Bottom navigation labels always visible. Create meal projects above nav.

### Navigation and data display

Four destinations plus central creation. Page back restores route history; discovery retains filters and selection. Membership, booking and payment statuses stay distinct.

### Forms and overlays

KeyboardInput/KeyboardTextarea, shared Field and Primary. Native select accepted for the demo's finite date/slot/size options. Runtime BottomSheet owns focus trapping and dismissal. No browser-native alerts/confirm/prompt. Every overlay fits phone bounds and scrolls.

## Motion

Runtime transitions remain intact. App motion restrained; respects prefers-reduced-motion.

## Content

Plain English and friendship-first intent. Display no real-booking/no-charge ribbon. Demo controls explicitly label simulated actions; no fake live inventory or real human response.
