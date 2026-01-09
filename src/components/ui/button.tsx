import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  `
    group/button inline-flex shrink-0 cursor-pointer items-center justify-center
    rounded-md border border-transparent bg-clip-padding text-sm font-medium
    whitespace-nowrap transition-all outline-none select-none
    focus-visible:border-ring focus-visible:ring-[3px]
    focus-visible:ring-ring/50
    disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50
    aria-invalid:border-destructive aria-invalid:ring-[3px]
    aria-invalid:ring-destructive/20
    dark:aria-invalid:border-destructive/50
    dark:aria-invalid:ring-destructive/40
    [&_svg]:pointer-events-none [&_svg]:shrink-0
    [&_svg:not([class*='size-'])]:size-4
  `,
  {
    variants: {
      variant: {
        default: `
          bg-primary text-primary-foreground
          hover:bg-primary/80
        `,
        outline: `
          border-border bg-background shadow-xs
          hover:bg-muted hover:text-foreground
          aria-expanded:bg-muted aria-expanded:text-foreground
          dark:border-input dark:bg-input/30
          dark:hover:bg-input/50
        `,
        secondary: `
          bg-secondary text-secondary-foreground
          hover:bg-secondary/80
          aria-expanded:bg-secondary aria-expanded:text-secondary-foreground
        `,
        ghost: `
          hover:bg-muted hover:text-foreground
          aria-expanded:bg-muted aria-expanded:text-foreground
          dark:hover:bg-muted/50
        `,
        destructive: `
          bg-destructive/10 text-destructive
          hover:bg-destructive/20
          focus-visible:border-destructive/40 focus-visible:ring-destructive/20
          dark:bg-destructive/20
          dark:hover:bg-destructive/30
          dark:focus-visible:ring-destructive/40
        `,
        link: `
          text-primary underline-offset-4
          hover:underline
        `,
        // Semantic action variants with improved light mode disabled states
        commit: `
          bg-purple-600 text-white
          hover:bg-purple-700
          disabled:cursor-not-allowed disabled:bg-purple-300
          disabled:text-purple-100 disabled:opacity-100
          dark:hover:bg-purple-500
          dark:disabled:bg-purple-900 dark:disabled:text-purple-500
        `,
        execute: `
          bg-teal-600 text-white
          hover:bg-teal-700
          disabled:cursor-not-allowed disabled:bg-teal-300
          disabled:text-teal-100 disabled:opacity-100
          dark:hover:bg-teal-500
          dark:disabled:bg-teal-900 dark:disabled:text-teal-500
        `,
        warning: `
          bg-yellow-600 text-white
          hover:bg-yellow-700
          disabled:cursor-not-allowed disabled:bg-yellow-300
          disabled:text-yellow-100 disabled:opacity-100
          dark:hover:bg-yellow-500
          dark:disabled:bg-yellow-900 dark:disabled:text-yellow-500
        `,
        // Toolbar-specific variants
        "toolbar-outline": `
          border-border bg-background text-xs font-medium shadow-xs
          hover:bg-muted hover:text-foreground
          dark:border-input dark:bg-input/30
          dark:hover:bg-input/50
        `,
        "toolbar-ghost": `
          text-xs font-medium
          hover:bg-muted hover:text-foreground
          dark:hover:bg-muted/50
        `,
      },
      size: {
        default: `
          h-9 gap-1.5 px-2.5
          in-data-[slot=button-group]:rounded-md
          has-data-[icon=inline-end]:pr-2
          has-data-[icon=inline-start]:pl-2
        `,
        xs: `
          h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs
          in-data-[slot=button-group]:rounded-md
          has-data-[icon=inline-end]:pr-1.5
          has-data-[icon=inline-start]:pl-1.5
          [&_svg:not([class*='size-'])]:size-3
        `,
        sm: `
          h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5
          in-data-[slot=button-group]:rounded-md
          has-data-[icon=inline-end]:pr-1.5
          has-data-[icon=inline-start]:pl-1.5
        `,
        lg: `
          h-10 gap-1.5 px-2.5
          has-data-[icon=inline-end]:pr-3
          has-data-[icon=inline-start]:pl-3
        `,
        icon: "size-9",
        "icon-xs": `
          size-6 rounded-[min(var(--radius-md),8px)]
          in-data-[slot=button-group]:rounded-md
          [&_svg:not([class*='size-'])]:size-3
        `,
        "icon-sm": `
          size-8 rounded-[min(var(--radius-md),10px)]
          in-data-[slot=button-group]:rounded-md
        `,
        "icon-lg": "size-10",
        // Toolbar-specific size (h-8 with gap-1.5 for consistent toolbar buttons)
        toolbar: `
          h-8 gap-1.5 rounded-[min(var(--radius-md),10px)] px-3 text-xs
          [&_svg:not([class*='size-'])]:size-4
        `,
        "toolbar-icon": `
          size-8 rounded-[min(var(--radius-md),10px)]
          [&_svg:not([class*='size-'])]:size-4
        `,
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
