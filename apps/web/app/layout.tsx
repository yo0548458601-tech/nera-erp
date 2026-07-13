import './globals.css';
import type { Metadata } from 'next';
import { SessionProvider } from '../src/context/SessionContext';
import { isDemoModeEnabled } from '../src/lib/auth/demoAuth';

export const metadata: Metadata = {
  title: 'Nera Platform',
  description: 'פלטפורמת נרה',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <SessionProvider demoModeEnabled={isDemoModeEnabled()}>{children}</SessionProvider>
      </body>
    </html>
  );
}
