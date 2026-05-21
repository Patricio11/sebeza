import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] text-sm font-medium transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[color:var(--color-brand)] text-white hover:bg-[color:var(--color-brand-strong)]",
        secondary:
          "border border-[color:var(--color-brand)] text-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-tint)]",
        ghost:
          "text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]",
        accent:
          "bg-[color:var(--color-accent)] text-white hover:opacity-90",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(button({ variant, size }), className)} {...props} />
  );
}
