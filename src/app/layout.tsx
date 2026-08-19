import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "D-Maths Assistant",
  description: "Personal productivity & finance assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
