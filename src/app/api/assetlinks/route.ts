import { NextResponse } from "next/server";

// Digital Asset Links, served at /.well-known/assetlinks.json (via a rewrite in
// vercel.json). A Play-Store (TWA) build of the PWA needs this to verify it owns
// this domain and run full-screen without a browser address bar.
//
// After you package the app (PWABuilder / Bubblewrap), set these env vars in
// Vercel with the values it gives you, then redeploy:
//   ANDROID_PACKAGE_NAME  e.g. app.vercel.assistant_lyart_six.twa
//   ANDROID_CERT_SHA256   the SHA-256 signing fingerprint (colon-separated hex)
// Until then this returns an empty list, which is valid.
export const dynamic = "force-dynamic";

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME;
  const fingerprint = process.env.ANDROID_CERT_SHA256;

  const links =
    packageName && fingerprint
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: packageName,
              sha256_cert_fingerprints: fingerprint
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean),
            },
          },
        ]
      : [];

  return NextResponse.json(links, {
    headers: { "content-type": "application/json" },
  });
}
