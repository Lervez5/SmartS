import { ReactNode } from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
}

export function Label({ className, children, ...props }: LabelProps) {
  return (
    <label className={`block text-sm font-medium text-gray-700 ${className || ""}`} {...props}>
      {children}
    </label>
  );
}
