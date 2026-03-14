import type { Metadata } from 'next';
import { Syne, Space_Mono, DM_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/Providers';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ToastProvider } from '@/components/ui/ToastProvider';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '600', '700', '800'],
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-space-mono',
  weight: ['400', '700'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'CommunityAlerts — Cape Town',
  description: 'Real-time community safety alerts for Cape Town suburbs',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceMono.variable} ${dmSans.variable}`}>
      <body className="bg-bg text-text-primary font-body antialiased overflow-hidden w-full h-full">
        <AuthProvider>
          <Providers>
            <div className="noise-overlay" />
            <ToastProvider />
            {children}
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
