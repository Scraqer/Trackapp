Trackapp 💊

A pill tracker PWA I built for my girlfriend. That's it, that's the app.

What it does
Tracks daily pill-taking with a calendar view
Blister pack management (start date + duration, auto-calculates end date)
Daily streak counter
Push notifications so she never forgets (works on Android, iOS is... complicated, see below)
Random cute gifs/messages on streak milestones
Local backup/export so nothing gets lost
Tech stack
Single index.html file. React + Babel loaded straight from a CDN, no build step, no bundler, no node_modules folder from hell.
Cloudflare Worker (worker.js) handling the push notification backend, because I didn't want to pay for a "real" server
Cloudflare KV for storing push subscriptions
Cron trigger checking every minute if it's pill time
Web Push (VAPID) for actual notification delivery
Heads up: this was ~90% vibecoded

I'm not a developer. I described what I wanted, an AI wrote most of the code, and I glued the rest together by asking a lot of "why is this broken" questions. If something looks weird or overengineered in here, that's probably why. It works though, which is the only bar I was trying to clear.

iOS notifications are janky, not my fault (mostly)

Apple only added web push for installed PWAs in iOS 16.4+, and even then it's flaky — works fine when the app was recently opened, sometimes just... doesn't fire when it's closed. This is a known, documented iOS/WebKit limitation, not a bug in this specific app. Android works reliably.

If you want it rock solid on iOS, the real fix is wrapping this in a native shell (Capacitor) with proper APNs push — which costs an Apple Developer account ($99/year) and way more effort than this project needs.

Setup (if you're forking this)

You'll need:

Your own VAPID keys (npx web-push generate-vapid-keys)
A Cloudflare account + Worker with a KV namespace bound as SUBSCRIPTIONS
Your VAPID private key added as a Cloudflare secret (npx wrangler secret put VAPID_PRIVATE_KEY)
Your VAPID public key pasted into both worker.js and index.html (has to match)
Personalization

Messages and gifs shown on streaks are meant to be personal, so they're not hardcoded in the public code — you set your own through the app's Settings, and they're stored locally on your device.

License

Open source, do whatever you want with it. I'm not translating this into other languages — if you want it in yours, that's a social network waiting to happen(dm me if you have any questions).
