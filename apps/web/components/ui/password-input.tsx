"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type NativeInputProps = Omit<React.ComponentProps<typeof Input>, "type">

interface PasswordInputProps extends NativeInputProps {
  /** Label announced to assistive tech for the show/hide toggle. */
  toggleAriaLabel?: { show: string; hide: string }
  /** Hide the eye toggle (e.g. for confirmation flows that should never expose the value). */
  hideToggle?: boolean
}

/**
 * Password field with a built-in show/hide toggle. The toggle is a real
 * `<button type="button">` so it never submits the surrounding form, and it
 * inherits Phase 2's 44 px touch target on mobile via `Button[size="icon"]`.
 */
function PasswordInput({
  className,
  toggleAriaLabel,
  hideToggle = false,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)
  const showLabel = toggleAriaLabel?.show ?? "Show password"
  const hideLabel = toggleAriaLabel?.hide ?? "Hide password"

  if (hideToggle) {
    return <Input type="password" className={className} {...props} />
  }

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        // Reserve room on the right for the toggle so the value never sits
        // under the icon. 2.75rem = 44px (touch target on mobile) + a 4px gap.
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        tabIndex={0}
        className="absolute inset-y-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export { PasswordInput }
export type { PasswordInputProps }
