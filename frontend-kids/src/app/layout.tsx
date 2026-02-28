import "../styles/globals.css";
import type { ReactNode } from "react";
import { LayoutWrapper } from "../components/layout-wrapper";

import { ThemeProvider } from "../components/theme-provider";

export const metadata = {
  title: "SmartSprout | Learning Reimagined",
  description: "AI-powered primary education platform for the next generation of sprouts."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full bg-background text-foreground font-sans selection:bg-primary/20">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}


