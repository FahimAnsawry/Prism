import { cva, type VariantProps } from "class-variance-authority";

// The board's two button styles: green fill (one per view) and secondary fill (slate by day,
// fog at night). Square corners,
// bold mono caps. Shared by <Button> and router <Link>s so both render identically.
export const ctaVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2.5 rounded-none border font-mono font-bold whitespace-nowrap uppercase transition-colors duration-150 ease-standard select-none cursor-pointer disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-transparent bg-brand text-slate hover:bg-brand/80 active:bg-brand/70",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/85 active:bg-secondary/75",
      },
      size: {
        sm: "h-[38px] px-3.5 text-[13px] tracking-[0.06em] [&_svg]:size-3.5",
        lg: "h-[45px] px-5.5 text-xs tracking-[0.08em] [&_svg]:size-3.5",
        block: "h-[42px] w-full px-5 text-xs tracking-[0.08em] [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

export type CtaVariants = VariantProps<typeof ctaVariants>;
