# Red Moon Pub V17.1 — ONLINE INDÍTÁS

## 1. GitHub
Töltsd fel ennek a mappának a teljes tartalmát egy új GitHub repositoryba.

## 2. Render
A Renderen válaszd: **New → Blueprint** és add meg a GitHub repositoryt.
A mellékelt `render.yaml` létrehozza a Node webszolgáltatást és a PostgreSQL adatbázist, és a `DATABASE_URL` változót automatikusan összeköti a kettővel.

## 3. Fontos a Free csomagról
A Free Web Service és Free Postgres tesztelésre jó. A Render dokumentációja szerint a Free Postgres adatbázis 30 nap után lejár, ezért valódi, tartós Red Moon adatokhoz a Postgrest később fizetős csomagra kell frissíteni.

## 4. Első deploy
A szerver indulásakor, ha az adatbázis üres, egyszer betölti a `data/db.json` kezdeti Red Moon adatait PostgreSQL-be.

## 5. Belépés
- owner / `RedMoon!2026`
- manager / `RedMoonManager!2026`
- staff / `RedMoonStaff!2026`

Éles használat előtt cseréld le a tesztjelszavakat.

## 6. Címek
A Render a deploy után ad egy `https://...onrender.com` címet. A publikus oldal a gyökér `/`, a Staff pedig `/staff`.

## 7. Saját domain később
A Render szolgáltatásához később saját domain, például `redmoonpub.hu`, is hozzáadható.
