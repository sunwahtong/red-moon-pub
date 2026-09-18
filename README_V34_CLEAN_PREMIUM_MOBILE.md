# Red Moon Pub V34 — Clean Premium + Mobile POS

V34 is based on V33 and includes:
- Clean premium base background across Club, DJ and Staff; grain/noise overlay disabled.
- Fixed Club song-request flow: token identity is resolved server-side, and DJ realtime state includes requests/name requests.
- Staff inventory is now a 3-column product-card grid on desktop, 2-column tablet, 1-column small mobile.
- Product cards have image, price, stock and direct `＋ KOSÁRBA` action.
- No internal inventory scrollbar.
- Sales Log is a compact one-line desktop table with readable typography.
- Sales Log becomes touch-friendly stacked cards on mobile; no horizontal scrolling.
- Existing cart, checkout, invoice, permissions, realtime, Club, DJ and public-site functionality is preserved.

Checks:
- node --check server.js
- node --check public/js/staff.js
- node --check public/js/club.js
- node --check public/js/dj.js
- node --check public/js/site.js
