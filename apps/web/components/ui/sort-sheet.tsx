"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SortDir = "asc" | "desc"

export interface SortOption<K extends string = string> {
  value: K
  label: string
  /** If set, default direction when this option is first picked. Defaults to 'asc'. */
  defaultDir?: SortDir
}

export interface SortValue<K extends string = string> {
  key: K
  dir: SortDir
}

interface SortSheetProps<K extends string = string> {
  options: readonly SortOption<K>[]
  value: SortValue<K>
  onValueChange: (next: SortValue<K>) => void
  /** Label shown on the trigger button. Defaults to t('sort'). */
  triggerLabel?: string
  /** Heading inside the sheet. */
  title?: string
  /** Additional class on the trigger Button. */
  className?: string
}

export function SortSheet<K extends string>({
  options,
  value,
  onValueChange,
  triggerLabel = "Sort",
  title = "Sort by",
  className,
}: SortSheetProps<K>) {
  const [open, setOpen] = React.useState(false)
  const current = options.find((o) => o.value === value.key)

  const handleSelect = (option: SortOption<K>) => {
    if (option.value === value.key) {
      // Same option → flip direction
      onValueChange({ key: value.key, dir: value.dir === "asc" ? "desc" : "asc" })
    } else {
      onValueChange({
        key: option.value,
        dir: option.defaultDir ?? "asc",
      })
    }
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("h-11 gap-1.5 px-3", className)}
        onClick={() => setOpen(true)}
      >
        <ArrowUpDown className="size-3.5" />
        <span className="truncate">
          {current ? `${triggerLabel}: ${current.label}` : triggerLabel}
        </span>
        {value.dir === "asc" ? (
          <ArrowUp className="size-3.5" aria-label="ascending" />
        ) : (
          <ArrowDown className="size-3.5" aria-label="descending" />
        )}
      </Button>
      <SheetContent
        side="bottom"
        className="rounded-t-xl pb-safe"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <ul role="radiogroup" aria-label={title} className="flex flex-col gap-0.5 px-2 pb-4">
          {options.map((option) => {
            const selected = option.value === value.key
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "flex w-full min-h-12 items-center justify-between gap-3 rounded-lg px-3 text-sm transition-colors",
                    "hover:bg-muted/60 active:bg-muted",
                    selected && "bg-primary/10 text-foreground"
                  )}
                >
                  <span className="truncate text-left">{option.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                    {selected ? (
                      <>
                        {value.dir === "asc" ? (
                          <ArrowUp className="size-4" aria-label="ascending" />
                        ) : (
                          <ArrowDown className="size-4" aria-label="descending" />
                        )}
                        <Check className="size-4 text-primary" aria-hidden />
                      </>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="px-4 pb-2 text-xs text-muted-foreground">
          Tap the active option to flip direction.
        </p>
      </SheetContent>
    </Sheet>
  )
}
