# Red Moon Pub V23 — DJ Audio Fixed

This version fixes the DJ-side audio start path: selecting a track immediately primes the HTMLAudioElement from the user click, avoiding autoplay loss after an asynchronous server request. The server remains authoritative for playback state and broadcasts sync to Club listeners.

Club audio now resolves uploaded-file URLs against the site origin and gives an explicit browser-audio enable path.

STAFF navigation remains role-based: OWNER/MANAGER/STAFF can see STAFF from the Club/DJ navigation; DJ-only accounts cannot.
