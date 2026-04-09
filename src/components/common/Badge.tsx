// ============================================================
// WMDM Desktop App — Badge Component
// Reusable badge for format types, DAW labels, status indicators
// ============================================================

import type { FormatType } from "../../types";

// --- Format Badge ---

const FORMAT_STYLES: Record<FormatType, string> = {
  template: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  preset: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sample: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  midi: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  other: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const FORMAT_LABELS: Record<FormatType, string> = {
  template: "Template",
  preset: "Preset",
  sample: "Sample",
  midi: "MIDI",
  other: "Other",
};

interface FormatBadgeProps {
  formatType: FormatType;
  size?: "sm" | "md";
}

export function FormatBadge({ formatType, size = "sm" }: FormatBadgeProps) {
  const sizeClass =
    size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${sizeClass} ${FORMAT_STYLES[formatType]}`}
    >
      {FORMAT_LABELS[formatType]}
    </span>
  );
}

// --- DAW Badge ---

const DAW_STYLES: Record<string, string> = {
  logic: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  ableton: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  cubase: "bg-red-500/20 text-red-400 border-red-500/30",
  "fl studio": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  flstudio: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const DAW_LABELS: Record<string, string> = {
  logic: "Logic",
  ableton: "Ableton",
  cubase: "Cubase",
  "fl studio": "FL Studio",
  flstudio: "FL Studio",
};

interface DawBadgeProps {
  daw: string;
  size?: "sm" | "md";
}

export function DawBadge({ daw, size = "sm" }: DawBadgeProps) {
  const key = daw.toLowerCase();
  const style = DAW_STYLES[key] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30";
  const label = DAW_LABELS[key] ?? daw;
  const sizeClass =
    size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${sizeClass} ${style}`}
    >
      {label}
    </span>
  );
}

// --- Status Badge ---

type StatusVariant = "success" | "warning" | "error" | "info" | "neutral";

const STATUS_STYLES: Record<StatusVariant, string> = {
  success: "bg-emerald-500/20 text-emerald-400",
  warning: "bg-amber-500/20 text-amber-400",
  error: "bg-red-500/20 text-red-400",
  info: "bg-blue-500/20 text-blue-400",
  neutral: "bg-gray-500/20 text-gray-400",
};

interface StatusBadgeProps {
  variant: StatusVariant;
  children: React.ReactNode;
  dot?: boolean;
}

export function StatusBadge({ variant, children, dot }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLES[variant]}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            variant === "success"
              ? "bg-emerald-400"
              : variant === "warning"
                ? "bg-amber-400"
                : variant === "error"
                  ? "bg-red-400"
                  : variant === "info"
                    ? "bg-blue-400"
                    : "bg-gray-400"
          }`}
        />
      )}
      {children}
    </span>
  );
}
