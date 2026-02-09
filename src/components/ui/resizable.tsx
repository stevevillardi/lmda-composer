"use client"

import * as React from "react"
import * as ResizablePrimitive from "react-resizable-panels"
import { GripHorizontal, GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({
  className,
  direction,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group> & {
  direction?: "horizontal" | "vertical"
}) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        `
          cn-resizable-panel-group flex size-full
          data-[panel-group-direction=vertical]:flex-col
        `,
        className
      )}
      orientation={direction}
      {...props}
    />
  )
}

function ResizablePanel({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return (
    <ResizablePrimitive.Panel
      data-slot="resizable-panel"
      className={cn("min-h-0 min-w-0", className)}
      {...props}
    />
  )
}

function ResizableHandle({
  withHandle,
  withVerticalHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean
  withVerticalHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        // Base styles
        `
          relative flex items-center justify-center bg-border transition-colors
          hover:bg-primary/30
          focus-visible:ring-1 focus-visible:ring-ring
          focus-visible:outline-hidden
        `,
        // Vertical direction (stacked panels) - thin horizontal line, full width
        `
          data-[panel-group-direction=vertical]:h-[2px]
          data-[panel-group-direction=vertical]:w-full
          data-[panel-group-direction=vertical]:cursor-row-resize
        `,
        // Horizontal direction (side by side) - thin vertical line
        `
          data-[panel-group-direction=horizontal]:h-full
          data-[panel-group-direction=horizontal]:w-[2px]
          data-[panel-group-direction=horizontal]:cursor-col-resize
        `,
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="
          absolute top-1/2 left-1/2 z-10 flex h-2 w-6 -translate-1/2
          items-center justify-center rounded-sm border bg-muted/80
          transition-colors
          hover:bg-muted
        ">
          <GripHorizontal className="size-2.5 text-muted-foreground" />
        </div>
      )}
      {withVerticalHandle && (
        <div className="
          absolute top-1/2 left-1/2 z-10 flex h-6 w-2 -translate-1/2
          items-center justify-center rounded-sm border bg-muted/80
          transition-colors
          hover:bg-muted
        ">
          <GripVertical className="size-2.5 text-muted-foreground" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }