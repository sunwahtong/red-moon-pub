# Red Moon Pub V19.2 — LIVE DJ

## What changed
- New `DJ` role in Command Center.
- DJ accounts only see the DJ console; POS, inventory, invoices, shifts, owner and manager tools are blocked server-side.
- Owner can create/edit DJ accounts.
- Live DJ uses browser WebRTC audio from the DJ's own computer.
- The DJ can share a browser tab/screen with audio, so a Spotify/YouTube tab or DJ software can be used as the local audio source, subject to those services' terms and music licensing requirements.
- When LIVE starts, the public site's Red Moon ambience automatically stops and the live DJ audio takes over.
- Public site shows `LIVE NOW`, DJ name and show title.
- When LIVE stops or the DJ disconnects, the public site automatically returns to the normal Red Moon ambience.
- No F5 is required for the live status switch.
- Existing public volume control controls the live audio too.

## DJ workflow
1. OWNER creates a user with role `DJ`.
2. DJ logs in at `/staff`.
3. DJ enters an optional show title.
4. Press `GO LIVE`.
5. In Chrome/Edge, choose the browser tab or screen containing the audio source and enable audio sharing.
6. The public site switches to `LIVE NOW`.
7. Press `STOP LIVE` to return to the normal Red Moon music.

## Browser audio note
For Spotify/YouTube, the browser's own tab/system-audio sharing is used. The website does not download or re-host the Spotify/YouTube track. Public rebroadcasting can require permission/licensing, and the terms of the source service still apply.

## Network note
This first live implementation is DJ-to-listener WebRTC. STUN servers are configured for NAT traversal. A TURN server is not included yet, so a small number of network combinations may fail to establish a direct connection. If needed later, TURN credentials can be added for stronger connectivity and a scalable streaming backend can replace the peer-to-peer layer.
