import type { LucideIcon } from "lucide-react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type StepperStep = {
  key: string
  label: string
  icon?: LucideIcon
}

function Stepper({
  steps,
  currentKey,
  doneKeys,
  onStepClick,
  className,
}: {
  steps: StepperStep[]
  currentKey: string
  doneKeys: Set<string> | string[]
  onStepClick?: (key: string) => void
  className?: string
}) {
  const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys)

  return (
    <nav className={cn("flex gap-1 overflow-x-auto", className)} aria-label="Steps">
      {steps.map((step, i) => {
        const active = currentKey === step.key
        const isDone = done.has(step.key)
        const Icon = step.icon
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onStepClick?.(step.key)}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full border text-[10px]",
                active
                  ? "border-primary-foreground"
                  : isDone
                    ? "border-transparent bg-success text-success-foreground"
                    : "border-current"
              )}
            >
              {isDone ? <Check className="size-2.5" /> : i + 1}
            </span>
            {Icon && <Icon className="size-3.5" />}
            {step.label}
          </button>
        )
      })}
    </nav>
  )
}

export { Stepper }
