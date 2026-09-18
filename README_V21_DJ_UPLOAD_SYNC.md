# Red Moon Pub V21 — DJ Upload & Sync

A V20.2 DJ/Club system YouTube dependency is replaced by uploaded audio files.

## DJ
- Upload MP3/WAV/OGG/M4A/AAC/WEBM audio files (max 80 MB/file).
- Library, queue, play/pause/seek/next.
- Server-controlled playback state is synchronized to Club listeners.
- Owner/Manager can open DJ Console; STAFF can access STAFF, while a pure DJ account cannot.
- Realtime requests, name approval and chat remain.

## Club
- Native HTML audio player; no YouTube iframe/video.
- First visit may require one click to enable audio because of browser autoplay rules.
- Same uploaded track/position is followed by listeners through realtime state sync.
- Public navigation includes the Club page and STAFF is shown only to staff-capable roles.

## Storage note
Uploaded audio is stored under `public/assets/dj-music` on the running service. On a Render Free web service this filesystem is ephemeral, so uploaded tracks can disappear after a restart/redeploy. For permanent production storage, attach persistent storage/object storage later without changing the Club playback model.
