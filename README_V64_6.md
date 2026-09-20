# Red Moon Pub V59.6

POS részlegek javítása a V59.5 alapján.

## POS részlegek
A Command Center → Eladás részben a részlegek fix, kért sorrendben jelennek meg:

1. Összes
2. Sörök — Barracho, Kőbaltás
3. Borok / Pezsgők — Syrah, Two Roosters, Vinewood, Bleuter'D
4. Tömény Italok — Ragga, The Mount, Chernekov, Cazafortunas, Sinmisito
5. Alkoholmentes Italok — E-Cola, Sprunk, Rainé
6. Kellékek — Sörnyitó

A régi adatbázisokban is explicit ID- és név-alapú besorolás történik, ezért a termékek nem esnek véletlenül az Egyéb kategóriába.

## V59.10 — DJ Access account selector fix
- Added DJ Access to the active Command Center Owner account create/edit dialogs.
- The existing server API already accepts the `dj` role; the UI now exposes it consistently as `DJ Access`.
- Added an Owner-facing hint in the legacy account panel as well.

## V59.9 — DJ Access / Console polish
- Fixed DJ toast notifications being visually hidden under the fixed navigation/header.
- Refined DJ console panels, controls, logout button and login screen to match the Red Moon neon design.
- Added an OWNER-only DJ ACCESS creation selector inside the Staff Command Center account panel.
- DJ accounts remain restricted to the DJ portal by the existing server-side role/portal checks.
- OWNER account editor can now also edit DJ ACCESS accounts.


## V61
Global readability pass: accidental black/inherited text is replaced with white/red-neon typography while preserving the existing Red Moon dark theme.

V64.6: invoice duplicate protection UX, premium dark receipt/invoice/shift-close documents, print actions removed.
