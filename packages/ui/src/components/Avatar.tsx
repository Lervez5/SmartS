import { ReactNode } from "react";
import { cn } from "@schoolos/utils";
import { User } from "lucide-react";

export interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Avatar({ src, alt, fallback, size = "md", className }: AvatarProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const iconSize = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
    xl: "w-8 h-8",
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt || "Avatar"}
        className={cn(
          "rounded-full object-cover bg-gray-200",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-primary to-brand-light flex items-center justify-center text-white font-bold shadow-inner",
        sizeClasses[size],
        className
      )}
    >
      {fallback || <User className={iconSize[size]} />}
    </div>
  );
}