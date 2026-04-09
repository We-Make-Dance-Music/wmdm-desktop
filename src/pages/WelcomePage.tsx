// ============================================================
// WMDM Desktop App — Welcome / First-Run Page
// DAW selection wizard shown on first launch after login
// ============================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api/tauri";
import type { DawInfo } from "../types";

const DAW_COLORS: Record<string, string> = {
  logic: "from-gray-600 to-gray-800",
  ableton: "from-teal-600 to-teal-800",
  cubase: "from-red-600 to-red-800",
  flstudio: "from-orange-500 to-orange-700",
  bitwig: "from-amber-500 to-amber-700",
  studio_one: "from-blue-600 to-blue-800",
};

export default function WelcomePage() {
  const [step, setStep] = useState(0);
  const [daws, setDaws] = useState<DawInfo[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();

  // Auto-detect DAWs on mount
  useEffect(() => {
    detectDaws();
  }, []);

  const detectDaws = async () => {
    setDetecting(true);
    try {
      const detected = await api.detectDaws();
      setDaws(detected);
    } catch {
      // Detection failed — show empty list
    }
    setDetecting(false);
  };

  const handleContinue = async () => {
    if (step === 0) {
      setStep(1);
    } else {
      // Mark first run complete and sync
      setSyncing(true);
      try {
        await api.setSetting("first_run_complete", "true");
      } catch {
        // Best effort
      }
      navigate("/library");
    }
  };

  const detectedCount = daws.filter((d) => d.detected).length;

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-wmdm-bg relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-wmdm-accent/[0.03] blur-3xl" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-violet-600/[0.03] blur-3xl" />
      </div>

      <div data-tauri-drag-region className="absolute top-0 left-0 right-0 h-12" />

      <div className="relative w-full max-w-lg mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/wmdm-logo.png" alt="WMDM" className="w-14 h-14 rounded-2xl mb-3 shadow-lg" />
          <h1 className="text-2xl font-bold text-wmdm-text">Welcome to WMDM</h1>
          <p className="text-sm text-wmdm-text-muted mt-1">
            Let's set up your music production environment
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[0, 1].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? "w-8 bg-wmdm-accent" : "w-3 bg-wmdm-border"
              }`}
            />
          ))}
        </div>

        {step === 0 ? (
          /* Step 1: DAW Detection */
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-wmdm-text">Your DAWs</h2>
              <p className="text-xs text-wmdm-text-muted mt-1">
                {detecting
                  ? "Scanning for installed DAWs..."
                  : detectedCount > 0
                    ? `We found ${detectedCount} DAW${detectedCount > 1 ? "s" : ""} on your system`
                    : "No DAWs detected — you can set paths manually in Settings"}
              </p>
            </div>

            <div className="space-y-2">
              {daws.map((daw) => (
                <div
                  key={daw.slug}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    daw.detected
                      ? "bg-wmdm-surface border-wmdm-accent/30"
                      : "bg-wmdm-bg/50 border-wmdm-border/50 opacity-50"
                  }`}
                >
                  {/* DAW color indicator */}
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                      DAW_COLORS[daw.slug] || "from-gray-500 to-gray-700"
                    } flex items-center justify-center shrink-0`}
                  >
                    <span className="text-white text-xs font-bold">
                      {daw.name.charAt(0)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-wmdm-text">{daw.name}</p>
                    {daw.detected ? (
                      <p className="text-[11px] text-wmdm-text-muted truncate">
                        {daw.version ? `v${daw.version} — ` : ""}
                        {daw.installPath || "Detected"}
                      </p>
                    ) : (
                      <p className="text-[11px] text-wmdm-text-muted">Not installed</p>
                    )}
                  </div>

                  {daw.detected ? (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-wmdm-success shrink-0">
                      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-wmdm-text-muted/30 shrink-0">
                      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  )}
                </div>
              ))}
            </div>

            {detecting && (
              <div className="flex items-center justify-center gap-2 text-wmdm-text-muted">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                  <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-xs">Detecting...</span>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: How it works */
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-wmdm-text">How it works</h2>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: "1",
                  title: "Browse your library",
                  desc: "All your purchases from every WMDM store in one place",
                },
                {
                  icon: "2",
                  title: "Preview & download",
                  desc: "Listen to demos and download with one click",
                },
                {
                  icon: "3",
                  title: "Templates appear in your DAW",
                  desc: "Files are automatically placed in the right folders — open your DAW and they're ready",
                },
                {
                  icon: "4",
                  title: "Discover new products",
                  desc: "Browse the Store tab for the latest templates, presets, and samples",
                },
              ].map((item) => (
                <div key={item.icon} className="flex items-start gap-3 p-3">
                  <div className="w-8 h-8 rounded-full bg-wmdm-accent/10 text-wmdm-accent flex items-center justify-center shrink-0 text-sm font-bold">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-wmdm-text">{item.title}</p>
                    <p className="text-xs text-wmdm-text-muted mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={detecting || syncing}
          className="w-full mt-6 btn-primary py-3 text-sm font-medium flex items-center justify-center gap-2"
        >
          {syncing ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Setting up...
            </>
          ) : step === 0 ? (
            "Continue"
          ) : (
            "Go to Library"
          )}
        </button>

        {/* Skip */}
        {step === 0 && !detecting && (
          <button
            onClick={() => setStep(1)}
            className="w-full mt-2 text-xs text-wmdm-text-muted hover:text-wmdm-text transition-colors py-2"
          >
            Skip DAW detection
          </button>
        )}
      </div>
    </div>
  );
}
