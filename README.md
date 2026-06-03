# WMDM Desktop

**Free desktop app + AU/VST3 plugin for music producers.** Your sample library, templates, and DAW projects — unified in one place, ready to drag straight into your session.

A self-hosted, sample-manager alternative to Splice / Loopcloud — without the subscription. Works with Logic Pro, Ableton Live, Cubase, FL Studio, Bitwig, Studio One.

📥 **[Download for Mac](https://d2xaunaa4wjkl.cloudfront.net/site-assets/app/downloads/WMDM_1.1.0_macOS.pkg)** (signed + notarized, includes Bridge plugin)
📥 **[Download for Windows](https://d2xaunaa4wjkl.cloudfront.net/site-assets/app/downloads/WMDM_1.1.1_Windows.exe)** (BETA — unsigned, SmartScreen warning)
🌐 [Landing page](https://www.wmdm.io/io/app)

---

## Features

### Desktop app
- **Unified library** — every purchase from wemakedancemusic.com, logictemplates.com, abletontemplates.net, cubasetemplates.com, flstudiotemplates.com, wmdm.io, and progressivegrooves.com in one place
- **One-click install** — templates land directly in your DAW's user folder
- **Audio preview** — waveform-aware player with spacebar + arrow-key shortcuts
- **Download manager** — 3 concurrent downloads, pause/resume/retry, speed + ETA
- **Sample indexer** — pure-Rust audio decode (Symphonia), FFT-based key detection (Krumhansl-Schmuckler), spectral feature fallback for untagged content
- **Apple Silicon + Intel** — universal binary on Mac

### WMDM Bridge plugin (Mac, AU + VST3, bundled with Mac install)
- Runs inside your DAW — Logic, Live, Cubase, FL Studio, Bitwig, Studio One
- Browse your sample library + drag straight onto the timeline
- Preview samples at host tempo
- Filter by harmonic key, BPM, instrument family
- Signed for macOS Gatekeeper, AU-validated by Logic Pro

---

## Tech stack

- **Tauri 2** (Rust + WKWebView) for the desktop app — small bundle, fast startup, native performance
- **React 19 + Vite + TypeScript** for the frontend
- **JUCE** for the AU/VST3/Standalone audio plugin (universal binary, Apple Silicon + Intel)
- **SQLite + sqlx** for local cache
- **Zustand** for state, **react-router-dom** for nav
- **Stripe** for in-app license purchases
- **Apple Developer ID** code signing + Apple notarization on the Mac installer

---

## System requirements

| Platform | Minimum | Architecture |
|---|---|---|
| macOS | 12.0 Monterey | Apple Silicon (arm64) + Intel (x86_64) |
| Windows | 10 / 11 | 64-bit |

---

## Build from source

Prerequisites: Node 20+, Rust stable, Xcode (Mac) or MSVC (Windows). For the Bridge plugin: CMake 3.22+, JUCE 7+.

```bash
# Desktop app
git clone https://github.com/We-Make-Dance-Music/wmdm-desktop.git
cd wmdm-desktop
npm install
npm run tauri -- build --bundles app                    # current arch
npm run tauri -- build --target universal-apple-darwin  # universal Mac

# Bridge plugin (separate repo)
git clone https://github.com/We-Make-Dance-Music/wmdm-bridge.git
cd wmdm-bridge
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --parallel
```

---

## Auto-updates

The Tauri updater plugin checks `latest.json` on every release. New versions install over the existing app — your library, settings, and saved license keys are preserved (stored in the system keychain via the `keyring` crate).

---

## License

Source-available, free to use. Built and maintained by [We Make Dance Music](https://www.wmdm.io).

## Support

- 🐛 [Report a bug](https://github.com/We-Make-Dance-Music/wmdm-desktop/issues/new)
- 💬 [Get help](https://www.wmdm.io/support)
- 📧 support@wmdm.io
