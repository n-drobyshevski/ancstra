"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DataCardProps extends React.ComponentProps<"div"> {
  asChild?: boolean
  selected?: boolean
  interactive?: boolean
}

function DataCard({
  className,
  selected,
  interactive = true,
  ...props
}: DataCardProps) {
  return (
    <div
      data-slot="data-card"
      data-selected={selected || undefined}
      className={cn(
        "group/data-card relative flex min-h-11 items-stretch gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-xs transition-colors",
        interactive &&
          "hover:bg-muted/40 focus-within:bg-muted/40 data-[selected]:border-primary/50 data-[selected]:bg-primary/5",
        className
      )}
      {...props}
    />
  )
}

function DataCardLeading({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-card-leading"
      className={cn("flex shrink-0 items-center", className)}
      {...props}
    />
  )
}

function DataCardBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-card-body"
      className={cn("flex min-w-0 flex-1 flex-col justify-center gap-0.5", className)}
      {...props}
    />
  )
}

function DataCardTitle({
  className,
  asChild,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  if (asChild) {
    return (
      <div data-slot="data-card-title" className={cn("min-w-0 truncate font-medium text-foreground", className)} {...props} />
    )
  }
  return (
    <div
      data-slot="data-card-title"
      className={cn("min-w-0 truncate font-medium text-foreground", className)}
      {...props}
    />
  )
}

function DataCardSubtitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-card-subtitle"
      className={cn("min-w-0 truncate text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function DataCardMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-card-meta"
      className={cn(
        "mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function DataCardActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-card-actions"
      className={cn(
        "flex shrink-0 items-center gap-1 self-start [&>button]:min-h-11 [&>button]:min-w-11",
        className
      )}
      {...props}
    />
  )
}

export {
  DataCard,
  DataCardLeading,
  DataCardBody,
  DataCardTitle,
  DataCardSubtitle,
  DataCardMeta,
  DataCardActions,
}
