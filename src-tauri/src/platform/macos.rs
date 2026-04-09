use dirs;

pub fn default_download_path() -> String {
    dirs::home_dir()
        .map(|h| h.join("Music").join("WMDM"))
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}

/// Returns (project_folder, content_folder) defaults for each DAW on macOS.
pub fn default_daw_paths(daw_id: &str) -> (String, String) {
    let home = dirs::home_dir().unwrap_or_default();
    match daw_id {
        "logic" => (
            home.join("Music").join("Logic").to_string_lossy().to_string(),
            home.join("Music").join("Audio Music Apps").to_string_lossy().to_string(),
        ),
        "ableton" => (
            home.join("Music").join("Ableton").join("User Library").to_string_lossy().to_string(),
            home.join("Music").join("Ableton").join("User Library").to_string_lossy().to_string(),
        ),
        "cubase" => (
            home.join("Documents").join("Steinberg").join("Cubase").to_string_lossy().to_string(),
            home.join("Documents").join("Steinberg").join("Cubase").to_string_lossy().to_string(),
        ),
        "flstudio" => (
            home.join("Documents").join("Image-Line").join("FL Studio").to_string_lossy().to_string(),
            home.join("Documents").join("Image-Line").join("FL Studio").to_string_lossy().to_string(),
        ),
        "bitwig" => (
            home.join("Documents").join("Bitwig Studio").join("Library").to_string_lossy().to_string(),
            home.join("Documents").join("Bitwig Studio").join("Library").to_string_lossy().to_string(),
        ),
        "studio_one" => (
            home.join("Documents").join("Studio One").to_string_lossy().to_string(),
            home.join("Documents").join("Studio One").to_string_lossy().to_string(),
        ),
        _ => (
            home.join("Music").join("WMDM").to_string_lossy().to_string(),
            home.join("Music").join("WMDM").to_string_lossy().to_string(),
        ),
    }
}

/// Returns Vec of (daw_id, daw_name, glob_patterns_in_Applications).
pub fn daw_scan_paths() -> Vec<(String, String, Vec<String>)> {
    vec![
        (
            "logic".into(),
            "Logic Pro".into(),
            vec![
                "/Applications/Logic Pro.app".into(),
                "/Applications/Logic Pro X.app".into(),
                "/Applications/Logic.app".into(),
            ],
        ),
        (
            "ableton".into(),
            "Ableton Live".into(),
            vec![
                "/Applications/Ableton Live 12 Suite.app".into(),
                "/Applications/Ableton Live 12 Standard.app".into(),
                "/Applications/Ableton Live 11 Suite.app".into(),
                "/Applications/Ableton Live 11 Standard.app".into(),
            ],
        ),
        (
            "cubase".into(),
            "Cubase".into(),
            vec![
                "/Applications/Cubase 14.app".into(),
                "/Applications/Cubase 13.app".into(),
                "/Applications/Cubase 12.app".into(),
            ],
        ),
        (
            "flstudio".into(),
            "FL Studio".into(),
            vec![
                "/Applications/FL Studio 24.app".into(),
                "/Applications/FL Studio 21.app".into(),
                "/Applications/FL Studio 20.app".into(),
            ],
        ),
        (
            "bitwig".into(),
            "Bitwig Studio".into(),
            vec![
                "/Applications/Bitwig Studio.app".into(),
            ],
        ),
        (
            "studio_one".into(),
            "Studio One".into(),
            vec![
                "/Applications/Studio One 6.app".into(),
                "/Applications/Studio One 5.app".into(),
            ],
        ),
    ]
}
