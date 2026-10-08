import "@schoolos/ui/styles/globals.css";
import type { ReactNode } from "react";
import { LayoutWrapper } from "@schoolos/ui";
import { RootProvider } from "@/providers/root-provider";

export const metadata = {
  title: "SmartSprout | Parent Portal",
  description: "Track your child's progress and school updates.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full bg-background text-foreground font-sans selection:bg-primary/20">
        <RootProvider>
          <LayoutWrapper
            role="parent"
            navbarProps={{ showSearch: true }}
            authRoutes={["/", "/login", "/register", "/forgot-password", "/reset-password", "/activate-account"]}
          >
            {children}
          </LayoutWrapper>
        </RootProvider>
      </body>
    </html>
  );
}
