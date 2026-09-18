# Red Moon Pub V19.3 — Global LIVE NOW DJ

- LIVE NOW indicator is injected globally by site.js and stays outside `<main>`, so it is visible on every public page and survives SPA navigation.
- Fixed top-right status shows `LIVE NOW` and the current DJ name while a DJ is live.
- While LIVE is active, the normal Red Moon ambience is paused and the WebRTC DJ audio is used instead.
- When LIVE ends, the normal ambience can resume according to the visitor's saved sound preference.
- `/api/live` is polled every 5 seconds as a safety net in addition to WebSocket state broadcasts.
- Viewer ICE candidates are routed to the DJ socket when no explicit target is supplied.
- Viewer WebSocket reconnects automatically while LIVE is active.
