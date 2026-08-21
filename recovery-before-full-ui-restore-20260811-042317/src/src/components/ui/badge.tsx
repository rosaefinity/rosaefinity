import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors border",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/10 text-primary-light",
        secondary: "border-secondary/30 bg-secondary/10 text-secondary-light",
        accent: "border-accent/30 bg-accent/10 text-accent",
        success: "border-success/30 bg-success/10 text-success",
        outline: "border-white/10 text-white/50",
        premium: "border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 text-yellow-400",
        free: "border-white/10 bg-white/5 text-white/50",
        new: "border-accent/30 bg-accent/10 text-accent",
        popular: "border-secondary/30 bg-secondary/10 text-secondary-light",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
