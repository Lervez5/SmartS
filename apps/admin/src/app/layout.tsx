import "@schoolos/ui/styles/globals.css";
import type { ReactNode } from "react";
import { LayoutWrapper } from "@schoolos/ui";
import { RootProvider } from "@/providers/root-provider";

export const metadata = {
  title: "SmartSprout | Admin Center",
  description: "System administration for users, cohorts, courses and reporting.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full bg-background text-foreground font-sans selection:bg-primary/20">
        <RootProvider>
          <LayoutWrapper
            role="super_admin"
            navbarProps={{ showSearch: true }}
            authRoutes={["/", "/login", "/forgot-password", "/reset-password", "/activate-account"]}
          >
            {children}
          </LayoutWrapper>
        </RootProvider>
      </body>
    </html>
  );
}
