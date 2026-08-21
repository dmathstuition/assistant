import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "D-Maths Assistant",
  description: "Personal productivity & finance assistant",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "D-Maths",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  // Next emits the Apple-prefixed flag from appleWebApp; add the modern
  // standard name too so Chrome/Android treats it as an installable web app.
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A1628",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved (or system) theme before first paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}if(t==='light'){document.documentElement.setAttribute('data-theme','light');var m=document.querySelector('meta[name=\\"theme-color\\"]');if(m)m.setAttribute('content','#eef3fb');}}catch(e){}})();`,
          }}
        />
        {/* Capture Chrome's install prompt as early as possible. It fires once
            and often before React mounts, so we stash it on window and notify
            the Install button, which may attach its listener later. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bipEvent=e;window.dispatchEvent(new Event('bip-ready'));});window.addEventListener('appinstalled',function(){window.__bipEvent=null;});})();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
