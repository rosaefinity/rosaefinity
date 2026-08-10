import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 hover:shadow-primary/30",
        secondary: "bg-secondary text-white hover:bg-secondary-hover shadow-lg shadow-secondary/20",
        accent: "bg-accent text-black hover:bg-accent-hover shadow-lg shadow-accent/20",
        outline: "border border-white/10 bg-transparent hover:bg-white/5 text-white",
        ghost: "text-white/50 hover:text-white hover:bg-white/5",
        success: "bg-success text-white hover:bg-success-hover shadow-lg shadow-success/20",
        danger: "bg-danger text-white hover:bg-danger-hover shadow-lg shadow-danger/20",
        glass: "bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] text-white hover:bg-white/[0.08]",
        google: "bg-white text-[#1a1a2e] hover:bg-gray-100 shadow-lg",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-lg px-6",
        xl: "h-12 rounded-xl px-8 text-base",
        icon: "h-9 w-9 rounded-lg",
        "icon-sm": "h-8 w-8 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
