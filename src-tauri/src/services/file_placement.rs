use crate::{DawInfo, PlacementFile, PlacementPreview, Product};
use dirs;
use std::io::Read;
use std::path::{Path, PathBuf};

// ─── Helper ───────────────────────────────────────────────────

fn home() -> PathBuf {
    dirs::home_dir().unwrap_or_default()
}

fn docs() -> PathBuf {
    dirs::document_dir().unwrap_or_else(|| home().join("Documents"))
}

// ─── DAW Template Folders (cross-platform) ────────────────────

fn logic_templates() -> PathBuf {
    // Logic Pro is macOS only
    home().join("Music/Audio Music Apps/Project Templates")
}

fn ableton_templates() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Ableton").join("User Library").join("Templates")
    } else {
        home().join("Music/Ableton/User Library/Templates")
    }
}

fn cubase_templates() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Steinberg").join("Cubase").join("User Templates")
    } else {
        home().join("Documents/Steinberg/Cubase/User Templates")
    }
}

fn flstudio_templates() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Image-Line").join("FL Studio").join("Projects").join("Templates")
    } else {
        home().join("Documents/Image-Line/FL Studio/Projects/Templates")
    }
}

fn bitwig_templates() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Bitwig Studio").join("Library").join("Templates")
    } else {
        home().join("Documents/Bitwig Studio/Library/Templates")
    }
}

fn studio_one_templates() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Studio One").join("Templates")
    } else {
        home().join("Documents/Studio One/Templates")
    }
}

// ─── Synth Preset Folders (cross-platform) ────────────────────

fn serum_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Xfer").join("Serum Presets").join("Presets")
    } else {
        home().join("Documents/Xfer/Serum Presets/Presets")
    }
}

fn massive_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Native Instruments").join("Massive").join("Sounds")
    } else {
        home().join("Documents/Native Instruments/Massive/Sounds")
    }
}

fn sylenth_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        // Sylenth1 on Windows uses ProgramData, not user Documents
        PathBuf::from(r"C:\ProgramData\LennarDigital\Sylenth1\Presets\WMDM")
    } else {
        home().join("Library/Application Support/LennarDigital/Sylenth1/WMDM")
    }
}

fn vital_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Vital").join("User").join("Presets")
    } else {
        home().join("Documents/Vital/User/Presets")
    }
}

fn omnisphere_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        // Omnisphere on Windows uses ProgramData
        PathBuf::from(r"C:\ProgramData\Spectrasonics\STEAM\Omnisphere\Settings Library\Patch Library\WMDM")
    } else {
        home().join("Library/Application Support/Spectrasonics/STEAM/Omnisphere/Settings Library/Patch Library/WMDM")
    }
}

fn pigments_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Arturia").join("Presets").join("Pigments").join("WMDM")
    } else {
        home().join("Library/Arturia/Presets/Pigments/WMDM")
    }
}

fn diva_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("u-he").join("Diva.data").join("Presets").join("WMDM")
    } else {
        home().join("Library/Audio/Presets/u-he/Diva/WMDM")
    }
}

fn phase_plant_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Kilohearts").join("presets").join("Phase Plant").join("WMDM")
    } else {
        home().join("Documents/Kilohearts/presets/Phase Plant/WMDM")
    }
}

fn kontakt_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Native Instruments").join("User Content").join("Kontakt")
    } else {
        home().join("Documents/Native Instruments/User Content/Kontakt/WMDM")
    }
}

fn nexus_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("reFX").join("Nexus").join("Presets").join("WMDM")
    } else {
        home().join("Documents/reFX/Nexus/Presets/WMDM")
    }
}

fn spire_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Reveal Sound").join("Spire").join("Presets").join("WMDM")
    } else {
        home().join("Library/Audio/Presets/Reveal Sound/Spire/WMDM")
    }
}

fn dune_presets() -> PathBuf {
    if cfg!(target_os = "windows") {
        docs().join("Synapse Audio").join("DUNE 3").join("Presets").join("WMDM")
    } else {
        home().join("Library/Audio/Presets/Synapse Audio/DUNE 3/WMDM")
    }
}

// ─── Path Context Detection ────────────────────────────────────

/// Check if a ZIP entry path contains a DAW-specific folder name.
/// e.g. "My Product/Logic Pro/Template.logicx" → Some("logic")
fn detect_daw_from_path(entry_path: &str) -> Option<&'static str> {
    let lower = entry_path.to_lowercase();
    // Check folder names in the path (not the filename itself)
    if lower.contains("/logic pro/") || lower.contains("/logic/") || lower.starts_with("logic pro/") || lower.starts_with("logic/") {
        Some("logic")
    } else if lower.contains("/ableton/") || lower.contains("/ableton live/") || lower.starts_with("ableton/") {
        Some("ableton")
    } else if lower.contains("/cubase/") || lower.starts_with("cubase/") {
        Some("cubase")
    } else if lower.contains("/fl studio/") || lower.contains("/fl_studio/") || lower.starts_with("fl studio/") || lower.starts_with("fl_studio/") {
        Some("flstudio")
    } else if lower.contains("/bitwig/") || lower.starts_with("bitwig/") {
        Some("bitwig")
    } else if lower.contains("/studio one/") || lower.starts_with("studio one/") {
        Some("studio_one")
    } else {
        None
    }
}

/// Check if a ZIP entry path is inside a samples/audio subfolder.
fn is_in_samples_folder(entry_path: &str) -> bool {
    let lower = entry_path.to_lowercase();
    lower.contains("/samples/") || lower.contains("/audio/")
        || lower.starts_with("samples/") || lower.starts_with("audio/")
}

/// Check if a ZIP entry path is inside a stems subfolder.
fn is_in_stems_folder(entry_path: &str) -> bool {
    let lower = entry_path.to_lowercase();
    lower.contains("/stems/") || lower.contains("/stem/")
        || lower.starts_with("stems/") || lower.starts_with("stem/")
}

/// Check if a product is a stems product based on format_type or name.
fn is_stems_product(product: &Product) -> bool {
    product.format_type == "sample" && (
        product.name.to_lowercase().contains("stem")
        || product.name.to_lowercase().contains("multitracks")
        || product.name.to_lowercase().contains("multi-track")
    )
}

/// Check if a ZIP entry path is inside a MIDI subfolder.
fn is_in_midi_folder(entry_path: &str) -> bool {
    let lower = entry_path.to_lowercase();
    lower.contains("/midi/") || lower.starts_with("midi/")
}

// ─── Synth Detection from Product Metadata ─────────────────────

/// Get the preset destination folder based on the product's synth metadata.
fn synth_preset_folder(product: &Product) -> Option<PathBuf> {
    let synth = product.daws.iter()
        .chain(product.genres.iter()) // sometimes synth info is in unexpected places
        .map(|s| s.to_lowercase())
        .find(|s| {
            ["serum", "massive", "sylenth", "vital", "omnisphere", "pigments",
             "diva", "phase plant", "kontakt", "nexus", "spire", "dune"]
                .iter().any(|syn| s.contains(syn))
        });

    // Also check product name for synth hints
    let name_lower = product.name.to_lowercase();

    if synth.as_deref().map_or(false, |s| s.contains("serum")) || name_lower.contains("serum") {
        Some(serum_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("massive")) || name_lower.contains("massive") {
        Some(massive_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("sylenth")) || name_lower.contains("sylenth") {
        Some(sylenth_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("vital")) || name_lower.contains("vital preset") {
        Some(vital_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("omnisphere")) || name_lower.contains("omnisphere") {
        Some(omnisphere_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("pigments")) || name_lower.contains("pigments") {
        Some(pigments_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("diva")) || name_lower.contains("diva") {
        Some(diva_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("phase plant")) || name_lower.contains("phase plant") {
        Some(phase_plant_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("kontakt")) || name_lower.contains("kontakt") {
        Some(kontakt_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("nexus")) || name_lower.contains("nexus") {
        Some(nexus_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("spire")) || name_lower.contains("spire") {
        Some(spire_presets())
    } else if synth.as_deref().map_or(false, |s| s.contains("dune")) || name_lower.contains("dune") {
        Some(dune_presets())
    } else {
        None
    }
}

// ─── Main Placement Logic ──────────────────────────────────────

/// Place extracted files into the correct DAW/content directories.
pub async fn place_files(
    zip_path: &str,
    product: &Product,
    daw_config: &[DawInfo],
    base_dir: &str,
) -> Result<Vec<PlacementFile>, String> {
    let zip_path = PathBuf::from(zip_path);
    let base_dir = PathBuf::from(base_dir);
    let product = product.clone();
    let daw_config = daw_config.to_vec();

    tokio::task::spawn_blocking(move || {
        extract_and_place(&zip_path, &product, &daw_config, &base_dir)
    })
    .await
    .map_err(|e| format!("Placement task failed: {e}"))?
}

fn extract_and_place(
    zip_path: &Path,
    product: &Product,
    _daw_config: &[DawInfo],
    base_dir: &Path,
) -> Result<Vec<PlacementFile>, String> {
    let file = std::fs::File::open(zip_path).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {e}"))?;

    let mut placed = Vec::new();
    let product_folder = sanitize_product_name(&product.name);

    // First pass: detect if ZIP contains .logicx bundles
    let has_logicx = (0..archive.len()).any(|i| {
        archive.by_index(i)
            .map(|e| {
                let n = e.name();
                n.contains(".logicx/") || n.ends_with(".logicx")
                    || n.contains(".logic/") || n.ends_with(".logic")
            })
            .unwrap_or(false)
    });

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Zip entry error: {e}"))?;

        let entry_name = entry.name().to_string();

        // Skip macOS metadata and hidden files
        if entry_name.starts_with("__MACOSX") || entry_name.contains("/__MACOSX/")
            || entry_name.contains("/.") || entry_name.starts_with('.') {
            continue;
        }

        // Handle directories — create them for Logic bundles (.logicx / .logic)
        if entry.is_dir() {
            if has_logicx && (entry_name.contains(".logicx") || entry_name.contains(".logic")) {
                let dest = logicx_dest(&entry_name);
                std::fs::create_dir_all(&dest).ok();
            }
            continue;
        }

        // Determine destination
        let dest_path = if has_logicx && (entry_name.contains(".logicx/") || entry_name.contains(".logic/")) {
            logicx_dest(&entry_name)
        } else {
            determine_placement(&entry_name, product, base_dir, &product_folder, has_logicx)
        };

        // Ensure parent directory exists
        if let Some(parent) = dest_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create dir {}: {e}", parent.display()))?;
        }

        // Extract file
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf)
            .map_err(|e| format!("Failed to read zip entry: {e}"))?;
        std::fs::write(&dest_path, &buf)
            .map_err(|e| format!("Failed to write {}: {e}", dest_path.display()))?;

        let file_type = classify_file(&entry_name);
        placed.push(PlacementFile {
            source_path: entry_name,
            destination_path: dest_path.to_string_lossy().to_string(),
            file_type,
        });
    }

    // Clean up the ZIP after successful extraction
    std::fs::remove_file(zip_path).ok();

    Ok(placed)
}

/// Core routing: determine where a file goes based on extension + path context + product metadata.
fn determine_placement(
    entry_name: &str,
    product: &Product,
    base_dir: &Path,
    product_folder: &str,
    has_logicx: bool,
) -> PathBuf {
    let ext = Path::new(entry_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let file_name = Path::new(entry_name).file_name().unwrap_or_default();
    let path_daw = detect_daw_from_path(entry_name);

    // ── 1. Logic .logicx bundles (directory packages) ──
    if has_logicx && entry_name.contains(".logicx/") {
        return logicx_dest(entry_name);
    }
    if has_logicx && entry_name.contains(".logicx") {
        return logicx_dest(entry_name);
    }

    // ── 1b. Older Logic .logic files (pre-Logic Pro X) ──
    if ext == "logic" {
        return logic_templates().join(file_name);
    }

    // ── 2. DAW template/project files by extension ──
    match ext.as_str() {
        // Ableton
        "als" => return ableton_templates().join(file_name),
        "alp" => return ableton_templates().join(file_name), // Ableton Live Pack
        "adg" => return home().join("Music/Ableton/User Library/Presets/Audio Effects/WMDM").join(file_name), // Ableton device group
        "adv" => return home().join("Music/Ableton/User Library/Presets/Instruments/WMDM").join(file_name), // Ableton instrument rack
        // Cubase
        "cpr" => return cubase_templates().join(file_name),
        "vstpreset" => {
            if let Some(folder) = synth_preset_folder(product) {
                return folder.join(product_folder).join(file_name);
            }
            return base_dir.join("Presets").join(product_folder).join(file_name);
        }
        // FL Studio
        "flp" => return flstudio_templates().join(file_name),
        "fst" => return flstudio_templates().join(file_name), // FL Studio state file
        // Bitwig
        "bwproject" => return bitwig_templates().join(file_name),
        "bwpreset" => return home().join("Documents/Bitwig Studio/Library/Presets/WMDM").join(file_name),
        // Studio One
        "song" => return studio_one_templates().join(file_name),
        _ => {}
    }

    // ── 3. Synth presets by extension + product metadata ──
    match ext.as_str() {
        "fxp" | "fxb" => {
            // .fxp is used by Serum, Sylenth, Spire, etc. — use product metadata to disambiguate
            if let Some(folder) = synth_preset_folder(product) {
                return folder.join(product_folder).join(file_name);
            }
            // Fallback: generic presets folder
            return base_dir.join("Presets").join(product_folder).join(file_name);
        }
        "nmsv" => return massive_presets().join(product_folder).join(file_name),
        "vital" | "vitalbank" => return vital_presets().join(product_folder).join(file_name),
        "h2p" => return diva_presets().join(product_folder).join(file_name),
        "nki" | "nkm" | "nkx" => return kontakt_presets().join(product_folder).join(file_name),
        "pgtx" => return pigments_presets().join(product_folder).join(file_name),
        "vstpreset" => {
            // Steinberg VST preset — could be for various synths
            return base_dir.join("Presets").join(product_folder).join(file_name);
        }
        _ => {}
    }

    // ── 4a. Stems — dedicated folder ──
    if is_in_stems_folder(entry_name) || (is_stems_product(product) && matches!(ext.as_str(), "wav" | "aiff" | "aif" | "flac")) {
        return base_dir.join("Stems").join(product_folder).join(file_name);
    }

    // ── 4b. Samples — route based on path context or extension ──
    if is_in_samples_folder(entry_name) || matches!(ext.as_str(), "wav" | "aiff" | "aif" | "flac") {
        // If path has a DAW context folder, put samples with that DAW
        if let Some(daw) = path_daw {
            let daw_base = match daw {
                "logic" => home().join("Music/Audio Music Apps/Samples"),
                "ableton" => {
                    if cfg!(target_os = "windows") {
                        docs().join("Ableton").join("User Library").join("Samples")
                    } else {
                        home().join("Music/Ableton/User Library/Samples")
                    }
                }
                "flstudio" => {
                    if cfg!(target_os = "windows") {
                        docs().join("Image-Line").join("FL Studio").join("Data").join("Packs")
                    } else {
                        home().join("Documents/Image-Line/FL Studio/Data/Packs")
                    }
                }
                _ => base_dir.join("Samples"),
            };
            return daw_base.join(product_folder).join(file_name);
        }
        return base_dir.join("Samples").join(product_folder).join(file_name);
    }

    // ── 5. MIDI files ──
    if is_in_midi_folder(entry_name) || matches!(ext.as_str(), "mid" | "midi") {
        return base_dir.join("MIDI").join(product_folder).join(file_name);
    }

    // ── 6. Audio files (mp3, ogg — usually previews/demos) ──
    if matches!(ext.as_str(), "mp3" | "ogg") {
        return base_dir.join("Audio").join(product_folder).join(file_name);
    }

    // ── 7. Documentation ──
    if matches!(ext.as_str(), "pdf" | "txt" | "nfo" | "rtf" | "doc" | "docx" | "url") {
        return base_dir.join("Docs").join(product_folder).join(file_name);
    }

    // ── 8. Images (cover art, screenshots) ──
    if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "gif" | "bmp") {
        return base_dir.join("Docs").join(product_folder).join(file_name);
    }

    // ── 9. Fallback ──
    base_dir.join(product_folder).join(file_name)
}

/// Build destination path for files inside a .logicx bundle.
fn logicx_dest(entry_name: &str) -> PathBuf {
    let templates = logic_templates();
    if let Some(logicx_pos) = entry_name.find(".logicx") {
        let prefix = &entry_name[..logicx_pos];
        let bundle_start = prefix.rfind('/').map(|p| p + 1).unwrap_or(0);
        let relative = &entry_name[bundle_start..];
        templates.join(relative)
    } else {
        templates.join(entry_name)
    }
}

/// Generate a placement preview without actually extracting.
pub fn preview_placement(
    product: &Product,
    _daw_config: &[DawInfo],
    base_dir: &str,
) -> PlacementPreview {
    let daw_name = product.daws.first().cloned().unwrap_or_else(|| "Unknown".to_string());

    let dest_desc = match product.format_type.as_str() {
        "template" => {
            let daw_folder = if daw_name.contains("logic") {
                logic_templates().to_string_lossy().to_string()
            } else if daw_name.contains("ableton") {
                ableton_templates().to_string_lossy().to_string()
            } else if daw_name.contains("cubase") {
                cubase_templates().to_string_lossy().to_string()
            } else if daw_name.contains("fl") {
                flstudio_templates().to_string_lossy().to_string()
            } else {
                base_dir.to_string()
            };
            daw_folder
        }
        "preset" => {
            synth_preset_folder(product)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| format!("{}/Presets", base_dir))
        }
        "sample" => format!("{}/Samples", base_dir),
        "midi" => format!("{}/MIDI", base_dir),
        _ => base_dir.to_string(),
    };

    PlacementPreview {
        product_id: product.id,
        files: vec![PlacementFile {
            source_path: product.name.clone(),
            destination_path: dest_desc,
            file_type: product.format_type.clone(),
        }],
        daw_name,
        content_path: base_dir.to_string(),
    }
}

fn classify_file(name: &str) -> String {
    let ext = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "logicx" => "Logic Project".into(),
        "logic" => "Logic Project".into(),
        "als" => "Ableton Live Set".into(),
        "alp" => "Ableton Live Pack".into(),
        "adg" => "Ableton Audio Effect".into(),
        "adv" => "Ableton Instrument".into(),
        "cpr" => "Cubase Project".into(),
        "flp" => "FL Studio Project".into(),
        "fst" => "FL Studio State".into(),
        "bwproject" => "Bitwig Project".into(),
        "bwpreset" => "Bitwig Preset".into(),
        "song" => "Studio One Project".into(),
        "fxp" | "fxb" => "Synth Preset".into(),
        "nmsv" => "Massive Preset".into(),
        "vital" | "vitalbank" => "Vital Preset".into(),
        "h2p" => "Diva Preset".into(),
        "nki" | "nkm" => "Kontakt Preset".into(),
        "pgtx" => "Pigments Preset".into(),
        "vstpreset" => "VST Preset".into(),
        "wav" | "aiff" | "aif" => "Audio Sample".into(), // classify_file doesn't know if it's a stem — placement logic handles that
        "mp3" | "ogg" | "flac" => "Audio".into(),
        "mid" | "midi" => "MIDI".into(),
        "pdf" | "txt" | "nfo" => "Documentation".into(),
        "jpg" | "jpeg" | "png" => "Image".into(),
        _ => "Other".into(),
    }
}

fn sanitize_product_name(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim()
        .to_string()
}
