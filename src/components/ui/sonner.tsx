import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useEditorStore } from "@/editor/stores/editor-store"

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useEditorStore((state) => state.preferences.theme);
  
  // Resolve 'system' to actual theme for Sonner
  const resolvedTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-green-500" />
        ),
        info: (
          <InfoIcon className="size-4 text-blue-500" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-yellow-500" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-red-500" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast: "group toast !bg-background/80 !backdrop-blur-md !text-foreground !border-border !shadow-lg !rounded-xl data-[type=warning]:!bg-yellow-500/10 data-[type=warning]:!border-yellow-500/20 data-[type=error]:!bg-red-500/10 data-[type=error]:!border-red-500/20",
          description: "group-[.toast]:!text-muted-foreground",
          actionButton: "group-[.toast]:!bg-primary group-[.toast]:!text-primary-foreground",
          cancelButton: "group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
