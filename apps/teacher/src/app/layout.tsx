import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '@/styles/globals.css';
import { AuthSessionGate, AuthProvider } from '@schoolos/auth';
import { ThemeProvider } from '@schoolos/auth/ui';
import { Toaster } from '@schoolos/ui';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Teacher Portal - School OS',
  description: 'Teacher portal for the School Management Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={plusJakartaSans.className}>
        <ThemeProvider>
          <AuthProvider>
            <AuthSessionGate>{children}</AuthSessionGate>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
