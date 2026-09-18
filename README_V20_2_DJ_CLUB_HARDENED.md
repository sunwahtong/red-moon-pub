# Red Moon V20.2 — DJ Club hardened

This build hardens the DJ Club system:
- public live start/stop notification sounds when the browser has been unlocked by user interaction
- no duplicate `DJ DJ` label when a DJ account name already starts with DJ
- Red Moon Club link is ensured on public navigation and the Club page keeps the full public nav
- server-side 5 second chat/request cooldown
- DJ approval required before public chat/request access
- DJ chat message deletion
- chat messages expire after 30 seconds with client fade-out and server-side purge
- listener heartbeat every 10 seconds
- DJ moderation ban by IP with duration and mandatory reason
- distinct chat/request/name/live notification tones
- synchronized DJ player state remains server-authoritative

## YouTube limitation
The Club continues to use the official YouTube embedded player. YouTube does not permit extracting only the audio track or hiding the embedded video to turn it into an audio-only stream. Therefore this build does not attempt to mask or strip the YouTube video. For a true audio-only visualizer, use audio files/streams for which Red Moon has the necessary streaming rights.
