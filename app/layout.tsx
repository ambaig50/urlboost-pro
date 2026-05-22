import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'URLBoost Pro — Free SEO Analyzer & Submission Tool',
  description: 'Analyze your website SEO, get actionable fixes, submit to free directories, and download professional reports. No signup required.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
