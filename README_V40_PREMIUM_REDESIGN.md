# Red Moon Pub — V40 Premium Redesign

V40 is a visual/UX redesign layer built on the verified V39 base.

## What changed
- Premium cinematic visual system across public pages
- Refined fixed glass/dark navigation with scroll state
- Stronger typography hierarchy and CTA treatment
- Softer rounded cards, depth, shadows and red-moon glow
- Scroll reveal animations with reduced-motion support
- Pointer-follow glow on desktop cards
- Refined public page heroes, menu cards, event cards, owners, VIP and journal sections
- Club player, audience, chat and live-room visual polish
- DJ control-room visual polish
- Staff Command Center visual polish while preserving existing functionality
- Mobile spacing, card sizing and layout refinements

## Functional baseline
V40 starts from V39 and does not intentionally change server endpoints, authentication, permissions, POS/cart logic, shift logic, invoices, realtime events or GoCast behavior.

## Validation
- `node --check public/js/v40-premium.js`
- `node --check public/js/staff.js`
- `node --check server.js`
