use crate::platform;
use crate::DawInfo;
use std::path::Path;

/// Detect installed DAWs by scanning known installation paths.
pub fn detect() -> Vec<DawInfo> {
    let scan_list = platform::daw_scan_paths();
    let mut results = Vec::new();

    for (daw_id, daw_name, paths) in scan_list {
        let mut detected = false;
        let mut install_path: Option<String> = None;
        let mut version: Option<String> = None;

        // First try filesystem scan
        for p in &paths {
            if Path::new(p).exists() {
                detected = true;
                install_path = Some(p.clone());
                version = extract_version_from_path(p);
                break;
            }
        }

        // On Windows, also check the registry if not found on disk
        #[cfg(target_os = "windows")]
        if !detected {
            if let Some((reg_path, reg_version)) = check_windows_registry(&daw_id) {
                detected = true;
                install_path = Some(reg_path);
                version = reg_version;
            }
        }

        let (_, content_path) = platform::default_daw_paths(&daw_id);

        results.push(DawInfo {
            name: daw_name,
            slug: daw_id,
            detected,
            install_path,
            content_path: if detected { Some(content_path) } else { None },
            version,
        });
    }

    results
}

/// Try to extract a version number from the application path.
fn extract_version_from_path(path: &str) -> Option<String> {
    // Look for patterns like "Live 12", "Cubase 14", "FL Studio 21"
    let parts: Vec<&str> = path.split(|c: char| c == '/' || c == '\\').collect();
    for part in parts {
        // Remove .app suffix if present
        let name = part.strip_suffix(".app").unwrap_or(part);
        // Find the last word that looks like a version number
        for word in name.split_whitespace().rev() {
            if word.chars().all(|c| c.is_ascii_digit() || c == '.') && !word.is_empty() {
                return Some(word.to_string());
            }
        }
    }
    None
}

/// Check the Windows registry for DAW installations.
/// Returns (install_path, version) if found.
#[cfg(target_os = "windows")]
fn check_windows_registry(daw_id: &str) -> Option<(String, Option<String>)> {
    use std::process::Command;

    // Registry paths to check for each DAW
    let registry_queries: Vec<(&str, &str)> = match daw_id {
        "ableton" => vec![
            (r"HKLM\SOFTWARE\Ableton\Live", "InstallDir"),
        ],
        "cubase" => vec![
            (r"HKLM\SOFTWARE\Steinberg\Cubase", "InstallDir"),
        ],
        "flstudio" => vec![
            (r"HKLM\SOFTWARE\Image-Line\FL Studio", "InstallPath"),
        ],
        "bitwig" => vec![
            (r"HKLM\SOFTWARE\Bitwig\Bitwig Studio", "InstallDir"),
        ],
        "studio_one" => vec![
            (r"HKLM\SOFTWARE\PreSonus\Studio One", "InstallPath"),
        ],
        _ => return None,
    };

    for (key, value_name) in registry_queries {
        // Use reg.exe to query the registry (avoids winreg crate dependency)
        let output = Command::new("reg")
            .args(["query", key, "/v", value_name])
            .output()
            .ok()?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Parse the reg query output to extract the value
            for line in stdout.lines() {
                let line = line.trim();
                if line.contains(value_name) {
                    // Format: "ValueName    REG_SZ    Value"
                    let parts: Vec<&str> = line.splitn(3, "REG_SZ").collect();
                    if parts.len() >= 2 {
                        let path = parts[1].trim().to_string();
                        if !path.is_empty() {
                            let version = extract_version_from_path(&path);
                            return Some((path, version));
                        }
                    }
                }
            }
        }
    }

    None
}
