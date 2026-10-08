import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { AuthSessionGate, AuthProvider } from '@schoolos/auth';
import { ThemeProvider } from '@schoolos/auth/ui';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Admin Portal - School OS',
  description: 'Admin portal for the School Management Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <AuthSessionGate>{children}</AuthSessionGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
