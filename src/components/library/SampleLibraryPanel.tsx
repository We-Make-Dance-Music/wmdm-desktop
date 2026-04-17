// Bridge plugin: Sample Library control panel.
// Manages library_roots and displays indexer progress.
// See ~/.claude/plans/calm-squishing-frog.md.

import { useEffect } from "react";
import { useSampleLibraryStore } from "../../stores/sampleLibraryStore";
import { listen } from "@tauri-apps/api/event";
import type { IndexStatus } from "../../api/tauri";

function KindBadge({ kind }: { kind: string }) {
  const label =
    kind === "wmdm_samples"
      ? "WMDM Samples"
      : kind === "wmdm_stems"
      ? "WMDM Stems"
      : kind === "daw_logic"
      ? "Logic"
      : kind === "daw_ableton"
      ? "Ableton"
      : kind === "daw_flstudio"
      ? "FL Studio"
      : "Custom";
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-wmdm-bg text-wmdm-text-muted border border-wmdm-border">
      {label}
    </span>
  );
}

export default function SampleLibraryPanel() {
  const roots = useSampleLibraryStore((s) => s.roots);
  const status = useSampleLibraryStore((s) => s.status);
  const isLoading = useSampleLibraryStore((s) => s.isLoading);
  const error = useSampleLibraryStore((s) => s.error);
  const loadRoots = useSampleLibraryStore((s) => s.loadRoots);
  const addRoot = useSampleLibraryStore((s) => s.addRoot);
  const removeRoot = useSampleLibraryStore((s) => s.removeRoot);
  const toggleRoot = useSampleLibraryStore((s) => s.toggleRoot);
  const rescan = useSampleLibraryStore((s) => s.rescan);
  const pollStatus = useSampleLibraryStore((s) => s.pollStatus);

  useEffect(() => {
    loadRoots();
  }, [loadRoots]);

  // Tauri event stream from the indexer.
  useEffect(() => {
    const unlistenPromise = listen<IndexStatus>("sample_index_progress", (ev) => {
      useSampleLibraryStore.setState({ status: ev.payload });
      if (!ev.payload.scanning) {
        // Final event; refresh per-root counts.
        loadRoots();
      }
    });
    return () => {
      unlistenPromise.then((u) => u());
    };
  }, [loadRoots]);

  // Fallback poll while scanning (in case an event is missed).
  useEffect(() => {
    if (!status.scanning) return;
    const id = setInterval(pollStatus, 1500);
    return () => clearInterval(id);
  }, [status.scanning, pollStatus]);

  const totalFiles = roots.reduce((acc, r) => acc + r.fileCount, 0);
  const totalTagged = roots.reduce((acc, r) => acc + r.taggedCount, 0);
  const progressPct =
    status.scanning && status.totalFiles > 0
      ? Math.round((status.taggedFiles / status.totalFiles) * 100)
      : totalFiles > 0
      ? Math.round((totalTagged / totalFiles) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full px-6 pt-4 pb-6 gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-wmdm-text">
            Sample Library (Bridge)
          </h2>
          <p className="text-xs text-wmdm-text-muted mt-1 max-w-xl">
            Folders scanned and tagged for the WMDM Bridge plugin. Tags include
            BPM, category (drum / vocal / bass / synth / fx) and shape
            (oneshot / loop / phrase). Bridge reads these tags read-only from
            inside your DAW.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addRoot}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            + Add folder
          </button>
          <button
            onClick={rescan}
            disabled={status.scanning}
            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
          >
            {status.scanning ? "Scanning…" : "Rescan all"}
          </button>
        </div>
      </header>

      {error && (
        <div className="text-xs text-wmdm-error bg-red-500/10 px-3 py-2 rounded">
          {error}
        </div>
      )}

      <div className="bg-wmdm-surface border border-wmdm-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-wmdm-text">
            {status.scanning
              ? `Tagging ${status.taggedFiles} / ${status.totalFiles}`
              : `${totalTagged.toLocaleString()} of ${totalFiles.toLocaleString()} files tagged`}
          </p>
          <p className="text-[11px] text-wmdm-text-muted">{progressPct}%</p>
        </div>
        <div className="h-1.5 rounded-full bg-wmdm-bg overflow-hidden">
          <div
            className="h-full bg-wmdm-accent transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {status.currentFile && status.scanning && (
          <p className="text-[11px] text-wmdm-text-muted mt-2 truncate">
            {status.currentFile}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-wmdm-text-muted border-b border-wmdm-border">
              <th className="py-2 pr-3 font-medium">Folder</th>
              <th className="py-2 pr-3 font-medium">Kind</th>
              <th className="py-2 pr-3 font-medium text-right">Files</th>
              <th className="py-2 pr-3 font-medium text-right">Tagged</th>
              <th className="py-2 pr-3 font-medium text-center">Enabled</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {roots.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-wmdm-text-muted">
                  No folders yet. Click "Add folder" to start.
                </td>
              </tr>
            )}
            {roots.map((r) => (
              <tr
                key={r.id}
                className="border-b border-wmdm-border/50 hover:bg-wmdm-surface/60"
              >
                <td className="py-2 pr-3 text-wmdm-text truncate max-w-[320px]">
                  <span title={r.path}>{r.path}</span>
                </td>
                <td className="py-2 pr-3">
                  <KindBadge kind={r.kind} />
                </td>
                <td className="py-2 pr-3 text-right text-wmdm-text-muted tabular-nums">
                  {r.fileCount.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right text-wmdm-text-muted tabular-nums">
                  {r.taggedCount.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-center">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => toggleRoot(r.id, e.target.checked)}
                  />
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => removeRoot(r.id)}
                    className="text-[11px] text-wmdm-text-muted hover:text-wmdm-error"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
