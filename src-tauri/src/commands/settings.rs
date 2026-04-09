use crate::AppSettings;
use sqlx::SqlitePool;
use tauri::State;

/// Get all application settings.
#[tauri::command]
pub async fn get_settings(db: State<'_, SqlitePool>) -> Result<AppSettings, String> {
    let rows: Vec<(String, String)> =
        sqlx::query_as("SELECT key, value FROM settings")
            .fetch_all(db.inner())
            .await
            .map_err(|e| format!("DB query error: {e}"))?;

    let mut settings = AppSettings::default();
    for (key, value) in rows {
        match key.as_str() {
            "download_path" => settings.download_path = value,
            "max_concurrent_downloads" => {
                settings.max_concurrent_downloads = value.parse().unwrap_or(3)
            }
            "auto_update" => settings.auto_update = value == "true",
            "launch_at_startup" => settings.launch_at_startup = value == "true",
            "notifications_enabled" => settings.notifications_enabled = value == "true",
            "theme" => settings.theme = value,
            _ => {}
        }
    }

    // Ensure download path has a sensible default
    if settings.download_path.is_empty() {
        settings.download_path = crate::platform::default_download_path();
    }

    Ok(settings)
}

/// Map camelCase frontend keys to snake_case DB keys.
fn normalize_key(key: &str) -> String {
    match key {
        "downloadPath" => "download_path".into(),
        "maxConcurrentDownloads" => "max_concurrent_downloads".into(),
        "autoUpdate" => "auto_update".into(),
        "launchAtStartup" => "launch_at_startup".into(),
        "notificationsEnabled" => "notifications_enabled".into(),
        _ => key.to_string(),
    }
}

/// Set a single setting by key.
#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    db: State<'_, SqlitePool>,
) -> Result<(), String> {
    let db_key = normalize_key(&key);
    // Strip JSON quotes if the value was JSON.stringify'd
    let clean_value = value.trim_matches('"').to_string();
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(&db_key)
        .bind(&clean_value)
        .execute(db.inner())
        .await
        .map_err(|e| format!("DB error: {e}"))?;
    Ok(())
}

/// Get the current download path.
#[tauri::command]
pub async fn get_download_path(db: State<'_, SqlitePool>) -> Result<String, String> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'download_path'")
            .fetch_optional(db.inner())
            .await
            .map_err(|e| format!("DB error: {e}"))?;

    Ok(row
        .map(|r| r.0)
        .unwrap_or_else(crate::platform::default_download_path))
}

/// Set the download path.
#[tauri::command]
pub async fn set_download_path(
    path: String,
    db: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('download_path', ?)")
        .bind(&path)
        .execute(db.inner())
        .await
        .map_err(|e| format!("DB error: {e}"))?;

    // Create the directory if it doesn't exist
    tokio::fs::create_dir_all(&path)
        .await
        .map_err(|e| format!("Failed to create directory: {e}"))?;

    Ok(())
}

/// Reveal a file/folder in Finder (macOS) or Explorer (Windows).
#[tauri::command]
pub async fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to reveal in Finder: {e}"))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to reveal in Explorer: {e}"))?;
    }

    Ok(())
}

/// Open a native folder picker dialog and return the selected path.
#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    // Use a blocking task since the native dialog blocks the thread
    let result = tokio::task::spawn_blocking(|| {
        #[cfg(target_os = "macos")]
        {
            use std::process::Command;
            let output = Command::new("osascript")
                .arg("-e")
                .arg("set theFolder to POSIX path of (choose folder with prompt \"Select folder\")")
                .output();

            match output {
                Ok(out) if out.status.success() => {
                    let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if path.is_empty() {
                        None
                    } else {
                        Some(path)
                    }
                }
                _ => None,
            }
        }

        #[cfg(target_os = "windows")]
        {
            // On Windows, we'd use a COM dialog — for now return None
            // and let the frontend use its own dialog if needed
            None::<String>
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            None::<String>
        }
    })
    .await
    .map_err(|e| format!("Dialog task failed: {e}"))?;

    Ok(result)
}
