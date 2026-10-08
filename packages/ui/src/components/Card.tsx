import { ReactNode } from "react";
import { cn } from "@schoolos/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div className={cn("rounded-lg border bg-white p-6 shadow", className)} {...props}>
      {children}
    </div>
  );
}
