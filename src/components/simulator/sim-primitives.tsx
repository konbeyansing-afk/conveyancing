"use client";

/**
 * Small building blocks shared by every simulator screen.
 *
 * The simulator deliberately does NOT use the academy's design tokens — it has
 * to look like the Windows practice-management app the trainee will actually
 * sit in front of, so colours here are hard-coded on purpose.
 */

import type { ComponentProps, ReactNode } from "react";
import { X as XIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Ribbon button: line-art icon above a small stacked label. */
export function RibbonButton({
  icon: Icon,
  label,
  tone = "blue",
  onClick,
  disabled,
  unavailable,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "blue" | "red" | "green" | "orange" | "purple";
  onClick?: () => void;
  disabled?: boolean;
  /**
   * Why this control isn't part of the simulation. Renders the button greyed
   * out with the reason on hover, so a trainee can tell "outside the
   * simulator" apart from "broken".
   */
  unavailable?: string;
  /** Draws attention to the control a guided task wants the trainee to press. */
  highlight?: boolean;
}) {
  const toneClass = {
    blue: "text-[#2f7fd0]",
    red: "text-[#d0454c]",
    green: "text-[#3f9e5a]",
    orange: "text-[#e08a2e]",
    purple: "text-[#8b5cc7]",
  }[tone];

  const isOff = disabled || Boolean(unavailable);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isOff}
      title={unavailable ? `${label} — ${unavailable}` : label}
      className={cn(
        "group relative flex h-full w-[62px] shrink-0 flex-col items-center justify-start gap-1 rounded px-1 pt-2 pb-1 text-center transition-colors",
        isOff ? "cursor-not-allowed opacity-40 grayscale" : "hover:bg-[#e8f1fb]",
        highlight && "ring-2 ring-[#e08a2e] ring-offset-1",
      )}
    >
      <Icon className={cn("size-[22px] shrink-0 stroke-[1.5]", toneClass)} />
      <span className="text-[10px] leading-[1.15] text-[#3c4653]">{label}</span>
    </button>
  );
}

export function RibbonDivider() {
  return <div className="mx-1 my-3 w-px self-stretch bg-[#dfe5ec]" />;
}

/** Uppercase section header bar used above nearly every pane. */
export function PaneHeader({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-[#dfe5ec] bg-[#eef3f8] px-3 py-1.5",
        className,
      )}
    >
      <span className="text-[11px] font-semibold tracking-wide text-[#4a5768] uppercase">
        {children}
      </span>
      {actions}
    </div>
  );
}

/** Card with the app's standard 1px border + white body. */
export function SimPanel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("flex min-h-0 flex-col border border-[#dfe5ec] bg-white", className)}>
      {title && <PaneHeader actions={actions}>{title}</PaneHeader>}
      <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Column header row for the app's dense data grids. */
export function GridHeader({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex border-b border-[#d5dde6] bg-[#f4f7fa] text-[11px] font-semibold text-[#4a5768]">
      {children}
    </div>
  );
}

export function GridCell({
  children,
  className,
  width,
  grow,
}: {
  children?: ReactNode;
  className?: string;
  width?: number;
  grow?: boolean;
}) {
  return (
    <div
      style={width ? { width, flex: "0 0 auto" } : undefined}
      className={cn(
        "truncate border-r border-[#e6ebf1] px-2 py-1.5 last:border-r-0",
        grow && "min-w-0 flex-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GridRow({
  children,
  selected,
  onClick,
  className,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "flex border-b border-[#eef2f6] text-[12px] text-[#22303f]",
        onClick && "cursor-pointer",
        selected ? "bg-[#dcebfa]" : onClick && "hover:bg-[#f2f7fc]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Windows-style text input. */
export function SimInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "h-[26px] min-w-0 rounded-[2px] border border-[#a9bcd0] bg-white px-2 text-[12px] text-[#22303f] outline-none placeholder:text-[#9aa8b6] focus:border-[#2f7fd0] focus:ring-1 focus:ring-[#2f7fd0]/40 disabled:bg-[#f1f4f7] disabled:text-[#8b98a6]",
        className,
      )}
    />
  );
}

export function SimTextarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[64px] w-full rounded-[2px] border border-[#a9bcd0] bg-white px-2 py-1.5 text-[12px] leading-relaxed text-[#22303f] outline-none placeholder:text-[#9aa8b6] focus:border-[#2f7fd0] focus:ring-1 focus:ring-[#2f7fd0]/40",
        className,
      )}
    />
  );
}

export function SimSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "h-[26px] min-w-0 rounded-[2px] border border-[#a9bcd0] bg-white px-1.5 text-[12px] text-[#22303f] outline-none focus:border-[#2f7fd0] focus:ring-1 focus:ring-[#2f7fd0]/40",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function SimFieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "block text-[10px] font-semibold tracking-wide text-[#5b6b7d] uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The app's green ADD / primary action button. */
export function SimActionButton({
  children,
  onClick,
  disabled,
  variant = "add",
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "add" | "primary" | "plain";
  className?: string;
  type?: "button" | "submit";
}) {
  const variantClass = {
    add: "border-[#a8ce9f] bg-[#d9edd2] text-[#2f6b39] hover:bg-[#c9e5bf]",
    primary: "border-[#2f7fd0] bg-[#2f7fd0] text-white hover:bg-[#2a71ba]",
    plain: "border-[#a9bcd0] bg-[#f4f7fa] text-[#3c4653] hover:bg-[#e8eef4]",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-[26px] shrink-0 rounded-[2px] border px-3 text-[11px] font-semibold tracking-wide uppercase transition-colors disabled:cursor-default disabled:opacity-45",
        variantClass,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SimCheckbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-[#22303f]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-[14px] accent-[#2f7fd0]"
      />
      {label}
    </label>
  );
}

/** Small status pill (OPEN / INCOMPLETE / COMPLETED …). */
export function SimTag({
  children,
  tone = "blue",
  className,
}: {
  children: ReactNode;
  tone?: "blue" | "red" | "green" | "amber" | "gray" | "teal";
  className?: string;
}) {
  const toneClass = {
    blue: "bg-[#2f7fd0] text-white",
    red: "bg-[#e8434c] text-white",
    green: "bg-[#3f9e5a] text-white",
    amber: "bg-[#e08a2e] text-white",
    gray: "bg-[#d7dee6] text-[#3c4653]",
    teal: "bg-[#7fe3c4] text-[#134d3c]",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[2px] px-1.5 py-px text-[10px] font-bold tracking-wide uppercase",
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Modal used by the ribbon's create actions (contact, phone message, document). */
export function SimDialog({
  title,
  children,
  onClose,
  footer,
  width = 460,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/25 pt-16">
      <div
        style={{ width }}
        className="max-h-[80%] overflow-auto border border-[#a9bcd0] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#dfe5ec] bg-[#46566c] px-3 py-2">
          <span className="text-[12px] font-semibold text-white">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close">
            <XIcon className="size-4 text-white/80 hover:text-white" />
          </button>
        </div>
        <div className="grid gap-2.5 p-3">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[#dfe5ec] bg-[#f7fafc] px-3 py-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyPane({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center p-6 text-center text-[12px] text-[#8b98a6]">
      {children}
    </div>
  );
}
