// ============================================================
// WMDM Desktop App — Help / FAQ Page
// ============================================================

import { useState } from "react";
import { open } from "@tauri-apps/plugin-shell";

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FaqItem[] = [
  // ─── Getting Started ───
  {
    category: "Getting Started",
    question: "What is the WMDM Desktop App?",
    answer:
      "The WMDM Desktop App is your all-in-one music production hub. Browse the full WMDM store, preview tracks with our advanced player, purchase products with in-app checkout, and download everything — templates, presets, samples, MIDI, stems. Files are automatically placed in the right folders for your DAW and plugins. No more manual file management.",
  },
  {
    category: "Getting Started",
    question: "Which account do I use to log in?",
    answer:
      "Use the same email and password you use on any WMDM store. Customer accounts are shared globally across all 7 stores — wemakedancemusic.com, logictemplates.com, abletontemplates.net, cubasetemplates.com, flstudiotemplates.com, wmdm.io, and progressivegrooves.com. One login, everything in one place.",
  },
  {
    category: "Getting Started",
    question: "I purchased from multiple WMDM stores. Will I see all my products?",
    answer:
      "Yes! The app automatically detects all purchases linked to your email across all 7 WMDM stores. Everything appears in one unified library. You can filter by DAW, format type, genre, BPM, and key.",
  },
  {
    category: "Getting Started",
    question: "Can I create an account directly in the app?",
    answer:
      "Yes. On the login screen, switch to 'Create Account' and fill in your details. Your account works across all 7 WMDM stores and the app immediately.",
  },
  {
    category: "Getting Started",
    question: "What happens the first time I open the app?",
    answer:
      "The app runs a welcome wizard that scans for installed DAWs (Logic Pro, Ableton Live, Cubase, FL Studio, Bitwig, Studio One) on your system. This helps the app know where to place your templates and presets. You can customize these paths later in Settings.",
  },

  // ─── Smart File Placement ───
  {
    category: "File Placement",
    question: "How does smart file placement work?",
    answer:
      "When you download a product, the app automatically extracts the ZIP and places each file in the correct location based on its type:\n\n" +
      "• DAW templates (.logicx, .als, .cpr, .flp) → your DAW's template folder\n" +
      "• Synth presets (.fxp, .nmsv, .vital, etc.) → the synth's preset folder\n" +
      "• Samples (WAV/AIFF) → ~/Music/WMDM/Samples/\n" +
      "• Stems → ~/Music/WMDM/Stems/\n" +
      "• MIDI files → ~/Music/WMDM/MIDI/\n" +
      "• Documentation → ~/Music/WMDM/Docs/\n\n" +
      "No dragging files, no manual organizing. Open your DAW or synth — your new content is already there.",
  },
  {
    category: "File Placement",
    question: "Where do my templates go?",
    answer:
      "Templates are placed directly in your DAW's template folder so they appear in the template chooser:\n\n" +
      "• Logic Pro → ~/Music/Audio Music Apps/Project Templates/\n" +
      "• Ableton Live → ~/Music/Ableton/User Library/Templates/\n" +
      "• Cubase → ~/Documents/Steinberg/Cubase/User Templates/\n" +
      "• FL Studio → ~/Documents/Image-Line/FL Studio/Projects/Templates/\n" +
      "• Bitwig → ~/Documents/Bitwig Studio/Library/Templates/\n" +
      "• Studio One → ~/Documents/Studio One/Templates/\n\n" +
      "Open your DAW → File → New from Template → your WMDM templates are right there.",
  },
  {
    category: "File Placement",
    question: "Where do synth presets go?",
    answer:
      "Presets go directly into the synth's preset folder — open the plugin and they're in the browser:\n\n" +
      "• Serum → ~/Documents/Xfer/Serum Presets/Presets/\n" +
      "• Massive → ~/Documents/Native Instruments/Massive/Sounds/\n" +
      "• Sylenth1 → ~/Library/Application Support/LennarDigital/Sylenth1/\n" +
      "• Vital → ~/Documents/Vital/User/Presets/\n" +
      "• Omnisphere → ~/Library/Application Support/Spectrasonics/.../Presets/\n" +
      "• Pigments → ~/Library/Arturia/Presets/Pigments/\n" +
      "• Diva → ~/Library/Audio/Presets/u-he/Diva/\n" +
      "• Phase Plant → ~/Documents/Kilohearts/presets/Phase Plant/\n" +
      "• Kontakt → ~/Documents/Native Instruments/User Content/Kontakt/\n" +
      "• Nexus, Spire, Dune — all supported\n\n" +
      "12 synths supported. No more dragging .fxp files manually.",
  },
  {
    category: "File Placement",
    question: "What about multi-DAW products?",
    answer:
      "Products containing templates for multiple DAWs are handled automatically. The .logicx goes to Logic's folder, the .als goes to Ableton's folder, the .flp goes to FL Studio's folder — all from the same download. Samples and MIDI included in the product go to their respective folders too.",
  },
  {
    category: "File Placement",
    question: "What about stems?",
    answer:
      "Stems (multi-track audio files) go to ~/Music/WMDM/Stems/{product name}/. The app detects stems based on the product type and folder structure inside the ZIP. They're kept separate from one-shot samples for easy organization.",
  },

  // ─── Store & Purchasing ───
  {
    category: "Store",
    question: "How does the built-in store work?",
    answer:
      "The Store tab opens the full WMDM website (wmdm.io) inside the app. You can browse categories, view product pages, use the advanced audio player, read descriptions, and purchase — all without leaving the app. You're automatically logged in.",
  },
  {
    category: "Store",
    question: "Can I buy products directly in the app?",
    answer:
      "Yes! The app has built-in Stripe checkout. Click 'Buy Now' on any product, enter your card details, and the payment is processed securely via Stripe. The product immediately appears in your Library ready to download. You can also browse and purchase through the embedded WMDM store.",
  },
  {
    category: "Store",
    question: "Are prices the same as on the website?",
    answer:
      "Yes. The app shows the same prices as the WMDM website. All currencies, discounts, and promotions apply.",
  },
  {
    category: "Store",
    question: "What are the product recommendations?",
    answer:
      "While downloading, the app shows 'You might also like' recommendations based on the genre, format, and DAW of what you're downloading. Product detail panels also show 'More from this creator' with play buttons and buy links. These help you discover new content that matches your production style.",
  },

  // ─── Audio Preview & Player ───
  {
    category: "Player",
    question: "How do I preview tracks?",
    answer:
      "There are two ways to preview:\n\n" +
      "1. Library — hover over any product card and click the play button on the thumbnail. A mini player with waveform visualization appears at the bottom.\n\n" +
      "2. Store — the embedded WMDM website has the full advanced audio player with playlists, track navigation, and all the features you're used to on the website.",
  },
  {
    category: "Player",
    question: "What are the keyboard shortcuts?",
    answer:
      "• Space — play/pause the current track\n" +
      "• Left Arrow — seek backward 5 seconds\n" +
      "• Right Arrow — seek forward 5 seconds\n" +
      "• Escape — close the product detail panel\n" +
      "• Cmd+F (Mac) / Ctrl+F (Win) — focus the search bar\n\n" +
      "Shortcuts don't fire when you're typing in a text field.",
  },
  {
    category: "Player",
    question: "What is the waveform in the player?",
    answer:
      "The mini player shows a real waveform unique to each track — it's the actual audio shape, not a generic visualization. Click anywhere on the waveform to jump to that position in the track.",
  },

  // ─── Library Features ───
  {
    category: "Library",
    question: "How do I find specific products?",
    answer:
      "Multiple ways:\n\n" +
      "• Search bar — search by name, creator, or genre (Cmd+F to focus)\n" +
      "• Format tabs — All, Templates, Presets, Samples, MIDI\n" +
      "• Filters — DAW type, genre, BPM range, key\n" +
      "• Favorites — star products and filter by ★ Favorites tab\n" +
      "• Sort — Recent Purchases, Name A-Z, Creator, Format",
  },
  {
    category: "Library",
    question: "What are favorites?",
    answer:
      "Click the star icon on any product card to add it to your favorites. Favorites are stored locally and persist across sessions. Click the '★ Favorites' tab to see only your starred products. Great for marking templates you want to download later.",
  },
  {
    category: "Library",
    question: "What is 'New This Week'?",
    answer:
      "At the top of the Library page, the app shows products you purchased in the last 7 days in a horizontal scroll. This helps you quickly find and download your most recent purchases.",
  },
  {
    category: "Library",
    question: "How does syncing work?",
    answer:
      "The app syncs automatically when you open it and periodically in the background. If new products are found, a notification appears ('3 new products synced'). You can also manually sync by clicking the Sync button. Products are cached locally in SQLite so your library loads instantly — even offline.",
  },
  {
    category: "Library",
    question: "What does 'Download All' do?",
    answer:
      "The 'Download All' button in the Library header downloads all undownloaded products in your current filtered view. If you're viewing Templates only, it downloads all templates. It respects your active filters and skips products you've already downloaded.",
  },

  // ─── Plugin Scanner ───
  {
    category: "Plugins",
    question: "What is the Plugin Scanner?",
    answer:
      "Go to Settings → Installed Plugins → Scan System. The app scans your Mac for all installed audio plugins (AU, VST3, VST, CLAP) and shows:\n\n" +
      "• Total plugins found on your system\n" +
      "• Compatibility score — how many of the 22 WMDM-relevant plugins you have\n" +
      "• Green checkmarks for installed plugins (Serum, Massive, Sylenth1, Vital, Omnisphere, etc.)\n\n" +
      "This helps you know which templates you can fully use before downloading or buying.",
  },
  {
    category: "Plugins",
    question: "Which plugins does the scanner check for?",
    answer:
      "22 plugins commonly used in WMDM templates:\n\n" +
      "Serum, Massive, Sylenth1, Vital, Omnisphere, Pigments, Diva, Phase Plant, Kontakt, Nexus, Spire, Dune, FabFilter Pro-Q, FabFilter Pro-L, OTT, Valhalla Room, Valhalla Vintage Verb, Soundtoys, FabFilter suite, iZotope suite, and Waves.",
  },

  // ─── Settings ───
  {
    category: "Settings",
    question: "Can I change the download location?",
    answer:
      "Yes. Go to Settings and click 'Choose' to pick a different folder. Note: DAW templates always go to the DAW's native template folder. Synth presets always go to the synth's preset folder. The download path setting affects samples, stems, MIDI, and other files.",
  },
  {
    category: "Settings",
    question: "How does DAW detection work?",
    answer:
      "The app scans your Applications folder for Logic Pro, Ableton Live, Cubase, FL Studio, Bitwig, and Studio One. Detected DAWs show a green checkmark in Settings with their version and install path. You can customize the content path for each DAW using the Browse button.",
  },
  {
    category: "Settings",
    question: "How do I log out or switch accounts?",
    answer:
      "Go to Settings → Account → Sign Out. Logging out clears your local product cache, download history, and auth token. When you log in with a different account, the app syncs that account's purchases fresh.",
  },

  // ─── Troubleshooting ───
  {
    category: "Troubleshooting",
    question: "Templates don't appear in my DAW",
    answer:
      "Try these steps:\n\n" +
      "1. Check the Downloads page — make sure the download shows 'Complete'\n" +
      "2. Restart your DAW — most DAWs only scan for new templates on launch\n" +
      "3. Verify the files exist in the correct folder:\n" +
      "   • Logic: ~/Music/Audio Music Apps/Project Templates/\n" +
      "   • Ableton: ~/Music/Ableton/User Library/Templates/\n" +
      "   • Cubase: ~/Documents/Steinberg/Cubase/User Templates/\n" +
      "   • FL Studio: ~/Documents/Image-Line/FL Studio/Projects/Templates/\n" +
      "4. Logic .logicx files are folder bundles — don't unzip them further\n" +
      "5. Older Logic projects (.logic) are also supported",
  },
  {
    category: "Troubleshooting",
    question: "Presets don't appear in my synth",
    answer:
      "1. Make sure the download completed successfully\n" +
      "2. Close and reopen the synth plugin — some plugins only scan presets on load\n" +
      "3. Check the correct folder (listed in Settings → Installed Plugins)\n" +
      "4. If the product contains .fxp files, make sure you have the correct synth — Serum and Sylenth1 both use .fxp format. The app uses the product metadata to route to the right synth.",
  },
  {
    category: "Troubleshooting",
    question: "Sync fails or shows an error",
    answer:
      "1. Check your internet connection\n" +
      "2. Log out and log back in — your session token may have expired\n" +
      "3. Wait 30 seconds and try again\n" +
      "4. If the error mentions '429' or 'rate limit', the server is throttling requests — wait a minute\n" +
      "5. If the error persists, contact support@wemakedancemusic.com",
  },
  {
    category: "Troubleshooting",
    question: "Downloads are slow",
    answer:
      "Downloads stream directly from CloudFront CDN. Speeds depend on your internet connection and file size. Large packs (100MB+) may take a few minutes. The app runs up to 3 concurrent downloads. You can adjust this in Settings.",
  },
  {
    category: "Troubleshooting",
    question: "The Store page shows a blank screen",
    answer:
      "The Store tab loads the WMDM website inside the app. If it's blank:\n\n" +
      "1. Check your internet connection\n" +
      "2. Click a different sidebar item, then click Store again\n" +
      "3. Restart the app\n" +
      "4. If you see a Cloudflare challenge, wait a moment — it should resolve automatically",
  },
  {
    category: "Troubleshooting",
    question: "macOS says 'unidentified developer'",
    answer:
      "The app isn't code-signed yet (coming soon). To open it:\n\n" +
      "1. Right-click the WMDM app → Open\n" +
      "2. Click 'Open' in the dialog\n" +
      "3. macOS will remember your choice — you won't be asked again\n\n" +
      "Or go to System Preferences → Security & Privacy → 'Open Anyway'.",
  },
];

const CATEGORIES = [
  "Getting Started",
  "File Placement",
  "Store",
  "Player",
  "Library",
  "Plugins",
  "Settings",
  "Troubleshooting",
];

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Getting Started");

  const filtered = FAQ_DATA.filter((f) => f.category === activeCategory);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-wmdm-text">Help & FAQ</h1>
          <p className="text-sm text-wmdm-text-muted mt-1">
            Everything you need to know about the WMDM Desktop App
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setOpenIndex(null);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-wmdm-accent text-white"
                  : "bg-wmdm-surface text-wmdm-text-muted hover:text-wmdm-text border border-wmdm-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQ items */}
        <div className="space-y-2">
          {filtered.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-wmdm-surface border border-wmdm-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-wmdm-bg/50 transition-colors"
                >
                  <span className="text-sm font-medium text-wmdm-text pr-4">
                    {faq.question}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`shrink-0 text-wmdm-text-muted transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-wmdm-text-muted whitespace-pre-line leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact support */}
        <div className="mt-8 p-4 bg-wmdm-surface border border-wmdm-border rounded-lg text-center">
          <p className="text-sm text-wmdm-text-muted">
            Can't find what you're looking for?
          </p>
          <button
            onClick={() => open("mailto:support@wemakedancemusic.com")}
            className="text-sm text-wmdm-accent hover:text-wmdm-accent-hover mt-1 inline-block"
          >
            Contact support@wemakedancemusic.com
          </button>
        </div>

        {/* Version info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-wmdm-text-muted">WMDM Desktop v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
