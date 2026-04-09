use crate::services::plugin_scanner::{self, InstalledPlugin};

/// Scan the system for installed audio plugins.
#[tauri::command]
pub async fn scan_plugins() -> Result<Vec<InstalledPlugin>, String> {
    let plugins = tokio::task::spawn_blocking(plugin_scanner::scan_all)
        .await
        .map_err(|e| format!("Scan failed: {e}"))?;
    Ok(plugins)
}

/// Check compatibility of installed plugins against known WMDM template plugins.
#[tauri::command]
pub async fn check_plugin_compatibility() -> Result<Vec<(String, bool)>, String> {
    let plugins = tokio::task::spawn_blocking(|| {
        let installed = plugin_scanner::scan_all();
        plugin_scanner::check_compatibility(&installed)
    })
    .await
    .map_err(|e| format!("Check failed: {e}"))?;
    Ok(plugins)
}
