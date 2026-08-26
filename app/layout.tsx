import type { Metadata } from "next";
import "./globals.css";

// Lets per-page metadata (like the share card's og:image) use relative
// URLs and have Next.js resolve them to absolute ones automatically.
// Update this once there's a real domain — while it's localhost, og
// images will only actually render when shared from a deployed URL.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "RateMyIdea",
  description:
    "Submit your business idea, get scored out of 100, and get one brutal line about it.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// Sets data-theme on <html> before first paint, so there's no flash of
// the wrong theme. Reads localStorage if the user has toggled before;
// otherwise respects prefers-color-scheme, matching
// homepage-prototype.html's "remember the choice, respect the system
// preference on a first visit" behavior. Runs synchronously and
// blocking (a plain <script>, not an event handler) specifically so it
// finishes before the browser paints anything.
const THEME_BOOTSTRAP = `
(function () {
  try {
    var stored = localStorage.getItem('rmi_theme');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
