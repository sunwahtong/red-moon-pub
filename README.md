# Red Moon Pub V59 — Command Center / Live Public Sync

V59 fixes the Command Center layout and connects the public site to the live staff data.

## Main fixes
- Site navigation remains visible above the Command Center.
- Access chooser is hidden after staff login so it cannot sit above the Command Center.
- Command Center reserves the header height and keeps sidebar/workspace separated.
- POS shows image-based drinks and food, cart, payment and cart history.
- Sales history groups line items by the same Cart ID used by the backend.
- Owner-created events appear automatically on both the homepage and Events page with countdowns.
- Public menu and homepage featured prices poll `/api/public-products` and update after Owner price changes.
- VAT text is shown on public prices.
- Public review cards use the same dark/red/gold visual language as Command Center review cards.

## Backend already included from V58
- Owner audit log.
- Manager + Owner restock permissions.
- Shift open/close and member management.
- Owner account management.
- Owner price control.
- Dynamic public product endpoint.
- Dynamic public events endpoint.

## Important
Upload the complete ZIP to Render. This release contains both frontend and backend files.
