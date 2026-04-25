import "../styles/globals.css";
import type { ReactNode } from "react";
import { LayoutWrapper } from "../components/layout/layout-wrapper";
import { RootProvider } from "../providers/root-provider";

export const metadata = {
  title: "SmartSprout | Learning Reimagined",
  description: "AI-powered primary education platform for the next generation of sprouts."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full bg-background text-foreground font-sans selection:bg-primary/20">
        <RootProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </RootProvider>
      </body>
    </html>
  );
}


