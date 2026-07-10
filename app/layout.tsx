import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e293b',
};

export const metadata: Metadata = {
  title: 'URLBoost Pro — Free SEO Analyzer & Submission Tool',
  description: 'Analyze your website SEO, get actionable fixes, submit to free directories, and download professional reports by Ambaig Designs.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'URLBoost Pro',
    startupImage: '/icon-512x512.png',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png',  sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png',  sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'application-name': 'URLBoost Pro',
    'msapplication-TileColor': '#1e293b',
    'msapplication-TileImage': '/icon-144x144.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* PWA service worker registration */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js')
                .then(function(reg) { console.log('SW registered'); })
                .catch(function(err) { console.log('SW failed:', err); });
            });
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
