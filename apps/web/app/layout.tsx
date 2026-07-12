import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nera Platform',
  description: 'פלטפורמת נרה',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
