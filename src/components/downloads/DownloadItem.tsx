// ============================================================
// WMDM Desktop App — Download Item Row
// Shows progress, speed, ETA, and action buttons
// ============================================================

import { DownloadStatus } from "../../types";
import type { DownloadItem as DownloadItemType } from "../../types";
import { useDownloadStore } from "../../stores/downloadStore";
import { revealInFinder } from "../../api/tauri";

interface DownloadItemProps {
  item: DownloadItemType;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return "--";
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

const STATUS_CONFIG: Record<
  DownloadStatus,
  { label: string; color: string; barClass: string }
> = {
  [DownloadStatus.Queued]: {
    label: "Queued",
    color: "text-gray-400",
    barClass: "bg-gray-500",
  },
  [DownloadStatus.Downloading]: {
    label: "Downloading",
    color: "text-blue-400",
    barClass: "progress-bar-animated",
  },
  [DownloadStatus.Paused]: {
    label: "Paused",
    color: "text-amber-400",
    barClass: "bg-amber-500",
  },
  [DownloadStatus.Extracting]: {
    label: "Extracting",
    color: "text-violet-400",
    barClass: "bg-violet-500 extract-pulse",
  },
  [DownloadStatus.Placing]: {
    label: "Placing files",
    color: "text-emerald-400",
    barClass: "bg-emerald-500",
  },
  [DownloadStatus.Complete]: {
    label: "Complete",
    color: "text-emerald-400",
    barClass: "bg-emerald-500",
  },
  [DownloadStatus.Error]: {
    label: "Error",
    color: "text-red-400",
    barClass: "bg-red-500",
  },
};

// --- Action Icons ---

function PauseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <rect x="4" y="3" width="3" height="10" rx="0.5" />
      <rect x="9" y="3" width="3" height="10" rx="0.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M4.5 2.5l9 5.5-9 5.5V2.5z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4.5V12a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1H8L6.5 3.5H3A1 1 0 002 4.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5l3 3 6-6" />
    </svg>
  );
}

export default function DownloadItem({ item }: DownloadItemProps) {
  const pauseDownload = useDownloadStore((s) => s.pauseDownload);
  const resumeDownload = useDownloadStore((s) => s.resumeDownload);
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);

  const config = STATUS_CONFIG[item.status];

  const handleReveal = async () => {
    if (item.outputPath) {
      await revealInFinder(item.outputPath);
    }
  };

  return (
    <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4 space-y-3">
      {/* Top row: name + status + actions */}
      <div className="flex items-start gap-3">
        {/* File icon / status icon */}
        <div className="shrink-0 mt-0.5">
          {item.status === DownloadStatus.Complete ? (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckIcon />
            </div>
          ) : item.status === DownloadStatus.Error ? (
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
              <XIcon />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-wmdm-bg flex items-center justify-center text-wmdm-text-muted">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 2h7l3 3v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
                <path d="M10 2v3h3" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-wmdm-text truncate">
            {item.productName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            {item.status === DownloadStatus.Downloading && (
              <>
                <span className="text-[10px] text-wmdm-text-muted">
                  {formatSpeed(item.speed)}
                </span>
                <span className="w-0.5 h-0.5 rounded-full bg-wmdm-text-muted" />
                <span className="text-[10px] text-wmdm-text-muted">
                  ETA {formatEta(item.eta)}
                </span>
              </>
            )}
            {item.error && (
              <span className="text-[10px] text-red-400 truncate">
                {item.error}
              </span>
            )}
          </div>
        </div>

        {/* Size info */}
        <div className="shrink-0 text-right">
          <p className="text-xs text-wmdm-text-muted">
            {item.status === DownloadStatus.Complete ? (
              item.totalBytes > 0 ? formatBytes(item.totalBytes) : formatBytes(item.bytesDownloaded)
            ) : (
              <>
                {formatBytes(item.bytesDownloaded)}
                {item.totalBytes > 0 && (
                  <span> / {formatBytes(item.totalBytes)}</span>
                )}
              </>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex items-center gap-1">
          {item.status === DownloadStatus.Downloading && (
            <button
              onClick={() => pauseDownload(item.id)}
              className="btn-icon"
              title="Pause"
            >
              <PauseIcon />
            </button>
          )}
          {item.status === DownloadStatus.Paused && (
            <button
              onClick={() => resumeDownload(item.id)}
              className="btn-icon"
              title="Resume"
            >
              <PlayIcon />
            </button>
          )}
          {(item.status === DownloadStatus.Downloading ||
            item.status === DownloadStatus.Paused ||
            item.status === DownloadStatus.Queued) && (
            <button
              onClick={() => cancelDownload(item.id)}
              className="btn-icon text-wmdm-error/70 hover:text-wmdm-error"
              title="Cancel"
            >
              <XIcon />
            </button>
          )}
          {item.status === DownloadStatus.Complete && item.outputPath && (
            <button
              onClick={handleReveal}
              className="btn-icon"
              title="Show in Finder"
            >
              <FolderIcon />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {item.status !== DownloadStatus.Complete &&
        item.status !== DownloadStatus.Error && (
          <div className="w-full bg-wmdm-bg rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${config.barClass}`}
              style={{ width: `${Math.min(item.progress, 100)}%` }}
            />
          </div>
        )}
    </div>
  );
}
