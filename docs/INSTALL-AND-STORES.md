# Installing D-Maths & publishing to the app stores

There are **two different things** here:

1. **Install as an app** (add it to your phone's home screen so it opens like an
   app, full-screen). This works today — no store needed.
2. **Publish to Google Play / Apple App Store**. A web app (PWA) does **not**
   appear in the stores automatically — you package it and upload it. Steps below.

---

## 1. Install it on your phone (works now)

The #1 reason "Add to Home screen" doesn't make a real app: you opened the link
inside a **chat app's built-in browser** (Telegram, WhatsApp, Facebook). Those
cannot install apps.

**Do this:**
1. Open **Chrome** (Android) or **Safari** (iPhone) and go to the live URL
   directly (type it, or tap ⋮ → **Open in Chrome** if you came from a chat).
2. Wait a few seconds for it to load fully.
3. **Android/Chrome:** tap ⋮ (top-right) → **Install app** / **Add to Home
   screen** → **Install**. (Or use the "Install app" card on the dashboard.)
4. **iPhone/Safari:** tap **Share** → **Add to Home Screen** → **Add**.
5. Delete any older icon first so the new version takes over.

**If "Install app" doesn't appear in Chrome's menu**, the site isn't passing the
install check on that visit — almost always because (a) it's an in-app browser,
or (b) you're on an old/failed deployment. Confirm the deployment is the latest
successful build, then reload with Chrome.

**Verify it's installable** (on a laptop): open the site in desktop Chrome →
DevTools (F12) → **Application → Manifest**. It should list the name, icons, and
say it's installable. **Application → Service Workers** should show one active.

---

## 2. Put it on Google Play (Android)

Use **[PWABuilder](https://www.pwabuilder.com)** (free, mostly no-code):

1. Go to pwabuilder.com, paste your live URL, **Start**.
2. Fix anything it flags (the manifest/service worker are already in place).
3. **Package for stores → Android → Google Play** → download the package. It
   builds a **TWA** (a thin Android app that runs this PWA full-screen).
4. In **Google Play Console** (one-time $25): create an app, upload the `.aab`,
   fill the listing (name, screenshots, privacy policy), and submit for review.
5. **Remove the browser address bar** (Digital Asset Links): PWABuilder gives
   you a signing **SHA-256 fingerprint** and a **package name**. Set them in
   Vercel and redeploy:
   - `ANDROID_PACKAGE_NAME` = the package name (e.g. `com.dmaths.assistant`)
   - `ANDROID_CERT_SHA256` = the SHA-256 fingerprint (comma-separate if several)
   This site already serves `/.well-known/assetlinks.json` from those vars, which
   is what Android checks to trust the app.

## 3. Put it on the Apple App Store (iPhone)

Harder, and Apple requires a **Mac + Xcode** and an **Apple Developer account
($99/year)**:

1. In PWABuilder → **Package for stores → iOS** → download the Xcode project.
2. Open it in **Xcode** on a Mac, set your signing team, and archive.
3. Upload via Xcode/Transporter to **App Store Connect**, complete the listing,
   and submit. Apple sometimes rejects apps that are "just a website" — a few
   native touches (share, notifications, offline) help; this app has them.

---

## What I can and can't do for you

I've made the app **store-ready** (valid manifest, icons, service worker,
shortcuts, and the assetlinks endpoint). The actual store submission needs
**your developer accounts** (and a Mac for iOS) and can't be done from here — but
once you run PWABuilder and have the package + signing fingerprint, I can wire up
the `ANDROID_*` env vars and anything else the store flow needs.
