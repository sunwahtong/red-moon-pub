# Red Moon Pub V57 — Command Center Rebuild

V57 is a full Staff Command Center rebuild based on V56.3.

## Included
- Fixed left-side Command Center navigation.
- Persistent top-right logout inside Command Center.
- Working POS catalog with product images, cart, payment selection and shift-membership enforcement.
- Drink and food product categories; backend sales now accepts both `drink` and `food`.
- Stock/restock workflow with +1/+5/+10, supplier/source, unit cost and restock logs.
- Manager sees restock notifications only; Owner has full audit log.
- Shift opening/closing and closed-shift history.
- Employee directory and Owner-only account editing.
- Public review administration and Owner-only deletion.
- Dedicated Owner price-control tab.
- Product creation with name, category, price, stock, minimum stock, image path and subtitle.
- Personal profile editing with nickname and profile image.
- Owner finance / overall revenue reset and event creation.
- Public menu polls `/api/public-products` so Owner price changes appear without a page refresh.
- Existing authentication and backend audit system retained.

Deploy the whole package on Render, including `server.js`, `public/`, and `data/`.
