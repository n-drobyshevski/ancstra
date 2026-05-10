"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ResponsiveTableProps {
  /** Rendered at `md` and up. Typically a `<Table>...</Table>` block. */
  desktop: React.ReactNode
  /** Rendered below `md`. Typically a `<MobileCardList>` of `<DataCard>`s. */
  mobile: React.ReactNode
  /** Optional wrapper className applied to both surfaces' parent. */
  className?: string
  /** Visual pending state (e.g. while a transition is queued). */
  pending?: boolean
  /** Optional aria-busy override; defaults to `pending`. */
  ariaBusy?: boolean
}

/**
 * Layout primitive: shows the desktop slot at `md+` and the mobile slot
 * below `md`. Both subtrees are mounted (CSS-driven), so no hydration flash;
 * for very large datasets, prefer rendering the heavy variant lazily.
 */
function ResponsiveTable({
  desktop,
  mobile,
  className,
  pending = false,
  ariaBusy,
}: ResponsiveTableProps) {
  return (
    <div
      className={cn(
        pending && "motion-safe:opacity-50 motion-safe:transition-opacity",
        className,
      )}
      aria-busy={ariaBusy ?? pending}
    >
      <div className="hidden md:block">{desktop}</div>
      <div className="md:hidden">{mobile}</div>
    </div>
  )
}

interface MobileCardListProps extends React.ComponentProps<"ul"> {
  /** Gap between cards. Defaults to `space-y-2`. */
  gap?: "tight" | "default" | "loose"
}

function MobileCardList({
  className,
  gap = "default",
  ...props
}: MobileCardListProps) {
  return (
    <ul
      role="list"
      data-slot="mobile-card-list"
      className={cn(
        "flex flex-col",
        gap === "tight" && "gap-1.5",
        gap === "default" && "gap-2",
        gap === "loose" && "gap-3",
        className,
      )}
      {...props}
    />
  )
}

function MobileCardListItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return <li className={cn("list-none", className)} {...props} />
}

/**
 * Standardized empty state for mobile card lists. Use inside MobileCardList
 * when there are no rows. Pairs with whatever empty state the desktop side
 * shows inside its `<TableBody>`.
 */
function MobileCardListEmpty({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export {
  ResponsiveTable,
  MobileCardList,
  MobileCardListItem,
  MobileCardListEmpty,
}
