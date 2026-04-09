// ============================================================
// WMDM Desktop App — Filter Bar
// DAW, Format, Genre, BPM, Key filters for the library
// ============================================================

import { useState } from "react";
import type { FormatType, ProductFilters } from "../../types";

interface FilterBarProps {
  filters: ProductFilters;
  onFilterChange: (filters: Partial<ProductFilters>) => void;
  onClear: () => void;
  availableGenres: string[];
}

const DAWS = [
  { slug: "logic", label: "Logic Pro" },
  { slug: "ableton", label: "Ableton" },
  { slug: "cubase", label: "Cubase" },
  { slug: "fl studio", label: "FL Studio" },
];

const FORMATS: { value: FormatType; label: string }[] = [
  { value: "template", label: "Templates" },
  { value: "preset", label: "Presets" },
  { value: "sample", label: "Samples" },
  { value: "midi", label: "MIDI" },
];

const KEYS = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
  "Cm", "C#m", "Dm", "D#m", "Em", "Fm",
  "F#m", "Gm", "G#m", "Am", "A#m", "Bm",
];

function ChipToggle({
  label,
  active,
  onClick,
  colorClass,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  colorClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-default
        ${
          active
            ? colorClass ??
              "bg-wmdm-accent/20 text-wmdm-accent border-wmdm-accent/40"
            : "bg-wmdm-bg text-wmdm-text-muted border-wmdm-border hover:border-wmdm-text-muted/30 hover:text-wmdm-text"
        }
      `}
    >
      {label}
    </button>
  );
}

export default function FilterBar({
  filters,
  onFilterChange,
  onClear,
  availableGenres,
}: FilterBarProps) {
  const [showGenres, setShowGenres] = useState(false);

  const toggleDaw = (slug: string) => {
    const current = filters.daw;
    const next = current.includes(slug)
      ? current.filter((d) => d !== slug)
      : [...current, slug];
    onFilterChange({ daw: next });
  };

  const toggleFormat = (format: FormatType) => {
    const current = filters.formatType;
    const next = current.includes(format)
      ? current.filter((f) => f !== format)
      : [...current, format];
    onFilterChange({ formatType: next });
  };

  const toggleGenre = (genre: string) => {
    const current = filters.genre;
    const next = current.includes(genre)
      ? current.filter((g) => g !== genre)
      : [...current, genre];
    onFilterChange({ genre: next });
  };

  const activeCount =
    filters.daw.length +
    filters.formatType.length +
    filters.genre.length +
    (filters.bpmRange ? 1 : 0) +
    (filters.key ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Filter sections row */}
      <div className="flex items-start gap-6 flex-wrap">
        {/* DAW filters */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider font-medium">
            DAW
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {DAWS.map((daw) => (
              <ChipToggle
                key={daw.slug}
                label={daw.label}
                active={filters.daw.includes(daw.slug)}
                onClick={() => toggleDaw(daw.slug)}
              />
            ))}
          </div>
        </div>

        {/* Format filters */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider font-medium">
            Format
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {FORMATS.map((fmt) => (
              <ChipToggle
                key={fmt.value}
                label={fmt.label}
                active={filters.formatType.includes(fmt.value)}
                onClick={() => toggleFormat(fmt.value)}
              />
            ))}
          </div>
        </div>

        {/* Key filter */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider font-medium">
            Key
          </p>
          <select
            value={filters.key ?? ""}
            onChange={(e) =>
              onFilterChange({ key: e.target.value || null })
            }
            className="text-xs bg-wmdm-bg border border-wmdm-border rounded-lg px-2.5 py-1.5
                       text-wmdm-text focus:outline-none focus:ring-1 focus:ring-wmdm-accent appearance-none pr-6
                       cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
            }}
          >
            <option value="">Any</option>
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {/* BPM range */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider font-medium">
            BPM
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min"
              min={0}
              max={300}
              value={filters.bpmRange?.[0] ?? ""}
              onChange={(e) => {
                const min = e.target.value ? parseInt(e.target.value) : null;
                const max = filters.bpmRange?.[1] ?? 300;
                onFilterChange({
                  bpmRange: min !== null ? [min, max] : null,
                });
              }}
              className="w-16 text-xs bg-wmdm-bg border border-wmdm-border rounded-lg px-2 py-1.5
                         text-wmdm-text focus:outline-none focus:ring-1 focus:ring-wmdm-accent"
            />
            <span className="text-xs text-wmdm-text-muted">-</span>
            <input
              type="number"
              placeholder="Max"
              min={0}
              max={300}
              value={filters.bpmRange?.[1] ?? ""}
              onChange={(e) => {
                const max = e.target.value ? parseInt(e.target.value) : null;
                const min = filters.bpmRange?.[0] ?? 60;
                onFilterChange({
                  bpmRange: max !== null ? [min, max] : null,
                });
              }}
              className="w-16 text-xs bg-wmdm-bg border border-wmdm-border rounded-lg px-2 py-1.5
                         text-wmdm-text focus:outline-none focus:ring-1 focus:ring-wmdm-accent"
            />
          </div>
        </div>

        {/* Genre toggle */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider font-medium">
            Genre
          </p>
          <button
            onClick={() => setShowGenres(!showGenres)}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-default flex items-center gap-1.5 ${
              filters.genre.length > 0
                ? "bg-wmdm-accent/20 text-wmdm-accent border-wmdm-accent/40"
                : "bg-wmdm-bg text-wmdm-text-muted border-wmdm-border hover:border-wmdm-text-muted/30"
            }`}
          >
            {filters.genre.length > 0
              ? `${filters.genre.length} selected`
              : "Select"}
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${showGenres ? "rotate-180" : ""}`}
            >
              <path d="M1 1l4 4 4-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Genre dropdown panel */}
      {showGenres && availableGenres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-wmdm-bg rounded-lg border border-wmdm-border max-h-40 overflow-y-auto">
          {availableGenres.map((genre) => (
            <ChipToggle
              key={genre}
              label={genre}
              active={filters.genre.includes(genre)}
              onClick={() => toggleGenre(genre)}
            />
          ))}
        </div>
      )}

      {/* Active filters summary + clear */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-wmdm-text-muted">
            {activeCount} filter{activeCount !== 1 ? "s" : ""} active
          </span>
          <button
            onClick={onClear}
            className="text-xs text-wmdm-accent hover:text-wmdm-accent-hover transition-default"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
