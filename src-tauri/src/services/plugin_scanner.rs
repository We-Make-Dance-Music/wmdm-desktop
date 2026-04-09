use serde::Serialize;
use std::path::{Path, PathBuf};

/// An installed audio plugin found on the user's system.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPlugin {
    pub name: String,
    pub vendor: String,
    pub format: String,    // "AU", "VST3", "VST", "CLAP"
    pub path: String,
    pub version: Option<String>,
}

/// Scan the system for installed audio plugins (AU, VST3, VST, CLAP).
pub fn scan_all() -> Vec<InstalledPlugin> {
    let mut plugins = Vec::new();

    #[cfg(target_os = "macos")]
    {
        // Audio Units
        scan_directory(
            &dirs::home_dir().unwrap_or_default().join("Library/Audio/Plug-Ins/Components"),
            "AU", &mut plugins,
        );
        scan_directory(
            Path::new("/Library/Audio/Plug-Ins/Components"),
            "AU", &mut plugins,
        );

        // VST3
        scan_directory(
            &dirs::home_dir().unwrap_or_default().join("Library/Audio/Plug-Ins/VST3"),
            "VST3", &mut plugins,
        );
        scan_directory(
            Path::new("/Library/Audio/Plug-Ins/VST3"),
            "VST3", &mut plugins,
        );

        // VST (legacy)
        scan_directory(
            &dirs::home_dir().unwrap_or_default().join("Library/Audio/Plug-Ins/VST"),
            "VST", &mut plugins,
        );
        scan_directory(
            Path::new("/Library/Audio/Plug-Ins/VST"),
            "VST", &mut plugins,
        );

        // CLAP
        scan_directory(
            &dirs::home_dir().unwrap_or_default().join("Library/Audio/Plug-Ins/CLAP"),
            "CLAP", &mut plugins,
        );
        scan_directory(
            Path::new("/Library/Audio/Plug-Ins/CLAP"),
            "CLAP", &mut plugins,
        );
    }

    #[cfg(target_os = "windows")]
    {
        // VST3
        scan_directory(
            Path::new(r"C:\Program Files\Common Files\VST3"),
            "VST3", &mut plugins,
        );

        // VST (legacy)
        scan_directory(
            Path::new(r"C:\Program Files\VSTPlugins"),
            "VST", &mut plugins,
        );
        scan_directory(
            Path::new(r"C:\Program Files\Steinberg\VSTPlugins"),
            "VST", &mut plugins,
        );

        // CLAP
        scan_directory(
            Path::new(r"C:\Program Files\Common Files\CLAP"),
            "CLAP", &mut plugins,
        );
    }

    // Deduplicate by name (same plugin may exist in multiple formats)
    plugins.sort_by(|a, b| a.name.cmp(&b.name));
    plugins.dedup_by(|a, b| a.name == b.name && a.format == b.format);

    plugins
}

/// Scan a directory for plugin bundles/files.
fn scan_directory(dir: &Path, format: &str, plugins: &mut Vec<InstalledPlugin>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return, // Directory doesn't exist or not accessible
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }

        let (plugin_name, vendor) = match format {
            "AU" => {
                // AU plugins are .component bundles
                if name.ends_with(".component") {
                    let clean = name.trim_end_matches(".component").to_string();
                    let vendor = extract_vendor_from_au(&path);
                    (clean, vendor)
                } else {
                    continue;
                }
            }
            "VST3" => {
                if name.ends_with(".vst3") {
                    let clean = name.trim_end_matches(".vst3").to_string();
                    let vendor = extract_vendor_from_path(&path);
                    (clean, vendor)
                } else if path.is_dir() {
                    // VST3 folder (contains .vst3 files inside)
                    scan_directory(&path, format, plugins);
                    continue;
                } else {
                    continue;
                }
            }
            "VST" => {
                if name.ends_with(".vst") {
                    let clean = name.trim_end_matches(".vst").to_string();
                    (clean, String::new())
                } else {
                    continue;
                }
            }
            "CLAP" => {
                if name.ends_with(".clap") {
                    let clean = name.trim_end_matches(".clap").to_string();
                    (clean, String::new())
                } else {
                    continue;
                }
            }
            _ => continue,
        };

        plugins.push(InstalledPlugin {
            name: plugin_name,
            vendor,
            format: format.to_string(),
            path: path.to_string_lossy().to_string(),
            version: None,
        });
    }
}

/// Try to extract vendor name from an AU component's Info.plist.
fn extract_vendor_from_au(path: &Path) -> String {
    let plist_path = path.join("Contents/Info.plist");
    if let Ok(content) = std::fs::read_to_string(&plist_path) {
        // Simple XML parsing — look for CFBundleIdentifier
        if let Some(start) = content.find("<key>CFBundleIdentifier</key>") {
            let rest = &content[start..];
            if let Some(s) = rest.find("<string>") {
                if let Some(e) = rest[s + 8..].find("</string>") {
                    let bundle_id = &rest[s + 8..s + 8 + e];
                    // Bundle IDs like "com.xferrecords.Serum" → "xferrecords"
                    let parts: Vec<&str> = bundle_id.split('.').collect();
                    if parts.len() >= 2 {
                        return parts[1].to_string();
                    }
                }
            }
        }
    }
    String::new()
}

/// Extract vendor from path (some VST3 plugins are in vendor subfolders).
fn extract_vendor_from_path(path: &Path) -> String {
    // If the parent folder isn't the root VST3 folder, it's likely the vendor name
    if let Some(parent) = path.parent() {
        let parent_name = parent.file_name().unwrap_or_default().to_string_lossy().to_string();
        if parent_name != "VST3" && parent_name != "Components" {
            return parent_name;
        }
    }
    String::new()
}

/// Known plugin names used in WMDM templates — for matching against installed plugins.
pub const KNOWN_PLUGINS: &[(&str, &[&str])] = &[
    ("Serum", &["Serum", "Xfer Serum", "Serum FX"]),
    ("Massive", &["Massive", "Massive X", "NI Massive"]),
    ("Sylenth1", &["Sylenth1", "LennarDigital Sylenth1"]),
    ("Vital", &["Vital", "Vitalium"]),
    ("Omnisphere", &["Omnisphere", "Omnisphere 2"]),
    ("Pigments", &["Pigments", "Arturia Pigments"]),
    ("Diva", &["Diva", "u-he Diva"]),
    ("Phase Plant", &["Phase Plant", "Kilohearts Phase Plant"]),
    ("Kontakt", &["Kontakt", "Kontakt 7", "Kontakt Player"]),
    ("Nexus", &["Nexus", "Nexus 4", "Nexus3", "reFX Nexus"]),
    ("Spire", &["Spire", "Reveal Sound Spire"]),
    ("Dune", &["DUNE", "DUNE 3", "Synapse DUNE"]),
    ("Pro-Q", &["Pro-Q 3", "FabFilter Pro-Q 3", "Pro-Q"]),
    ("Pro-L", &["Pro-L 2", "FabFilter Pro-L 2", "Pro-L"]),
    ("OTT", &["OTT", "Xfer OTT"]),
    ("Valhalla Room", &["ValhallaRoom", "Valhalla Room"]),
    ("Valhalla Vintage Verb", &["ValhallaVintageVerb", "Valhalla VintageVerb"]),
    ("Soundtoys", &["Decapitator", "EchoBoy", "Little AlterBoy", "PanMan", "Crystallizer"]),
    ("FabFilter", &["Pro-Q", "Pro-L", "Pro-C", "Pro-R", "Pro-MB", "Saturn"]),
    ("iZotope", &["Ozone", "Neutron", "RX", "Trash"]),
    ("Waves", &["SSL", "CLA", "H-Comp", "H-Delay", "Renaissance", "L2"]),
];

/// Check which known plugins the user has installed.
pub fn check_compatibility(installed: &[InstalledPlugin]) -> Vec<(String, bool)> {
    let installed_lower: Vec<String> = installed.iter()
        .map(|p| p.name.to_lowercase())
        .collect();

    KNOWN_PLUGINS.iter().map(|(canonical_name, variants)| {
        let found = variants.iter().any(|v| {
            let v_lower = v.to_lowercase();
            installed_lower.iter().any(|installed_name| {
                installed_name.contains(&v_lower) || v_lower.contains(installed_name)
            })
        });
        (canonical_name.to_string(), found)
    }).collect()
}
