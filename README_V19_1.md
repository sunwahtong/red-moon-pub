# Red Moon Pub V19.1

Realtime staff hardening and notification polish.
- Kasszanyitás/zárás, invoice deletion, inventory and other DB writes refresh staff clients automatically.
- 5-second polling safety net in addition to SSE, so F5 is not required if SSE is delayed.
- OWNER password changes immediately revoke the target user's active sessions and notify that browser, which is then returned to login.
- Staff toast notifications are positioned at the top of the screen.
