#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

/// Default base download/content path.
pub fn default_download_path() -> String {
    #[cfg(target_os = "macos")]
    {
        macos::default_download_path()
    }
    #[cfg(target_os = "windows")]
    {
        windows::default_download_path()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        dirs::home_dir()
            .map(|h| h.join("Music").join("WMDM"))
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    }
}

/// DAW-specific default content paths.
pub fn default_daw_paths(daw_id: &str) -> (String, String) {
    #[cfg(target_os = "macos")]
    {
        macos::default_daw_paths(daw_id)
    }
    #[cfg(target_os = "windows")]
    {
        windows::default_daw_paths(daw_id)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = daw_id;
        (String::new(), String::new())
    }
}

/// Paths to scan for DAW installations.
pub fn daw_scan_paths() -> Vec<(String, String, Vec<String>)> {
    #[cfg(target_os = "macos")]
    {
        macos::daw_scan_paths()
    }
    #[cfg(target_os = "windows")]
    {
        windows::daw_scan_paths()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        vec![]
    }
}
