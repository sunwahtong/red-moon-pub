# Red Moon Pub V17.2 — GitHub / Render Clean

Online-ready build of the Red Moon Pub website + Node.js staff system.

## Deploy
1. Upload the contents of this folder to a GitHub repository (do not upload the ZIP itself).
2. In Render choose **New → Blueprint** and select the repository.
3. Set `OWNER_USERNAME` and `OWNER_PASSWORD` in Render when prompted.
4. Deploy. Render provides `DATABASE_URL` to the web service automatically.
5. Open `/` for the public site and `/staff.html` for Staff.

## Security
- No real/test passwords are stored in this repository.
- The first OWNER is created from `OWNER_USERNAME` / `OWNER_PASSWORD` only when the PostgreSQL database is initialized for the first time.
- Do not commit `.env`, credentials, API keys, or real customer data.

## Local
Local development is intentionally not packaged with BAT/PowerShell launchers. Run with:

`npm install`

`npm start`

Without `DATABASE_URL`, the server uses `data/seed.json` as its local seed state.


## V53 — Quality / Performance
- Unified the overlapping V46/V49/V50 pointer-reactive loops into one V53 controller.
- Added persistent Cinematic / Balanced / Lite Quality control on every page.
- Quality is stored in localStorage under `redmoon-quality` and applies site-wide on that browser.
- Preserved the V50 smoke/filter support in the unified controller.
