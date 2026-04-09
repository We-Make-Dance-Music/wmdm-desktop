use crate::services::daw_detector;
use crate::services::file_placement;
use crate::services::product_sync;
use crate::{DawConfig, DawInfo, PlacementPreview};
use sqlx::SqlitePool;
use tauri::State;

/// Detect installed DAWs on the system.
#[tauri::command]
pub async fn detect_daws(db: State<'_, SqlitePool>) -> Result<Vec<DawInfo>, String> {
    let daws = daw_detector::detect();

    // Save detected DAWs to DB
    for daw in &daws {
        sqlx::query(
            "INSERT OR REPLACE INTO daw_config (daw_id, name, detected, install_path, content_path, version) \
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&daw.slug)
        .bind(&daw.name)
        .bind(daw.detected)
        .bind(&daw.install_path)
        .bind(&daw.content_path)
        .bind(&daw.version)
        .execute(db.inner())
        .await
        .map_err(|e| format!("DB error saving DAW config: {e}"))?;
    }

    Ok(daws)
}

/// Get DAW configuration (detected DAWs with any user overrides applied).
#[tauri::command]
pub async fn get_daw_config(db: State<'_, SqlitePool>) -> Result<DawConfig, String> {
    let rows = sqlx::query_as::<_, DawRow>(
        "SELECT daw_id, name, detected, install_path, content_path, version FROM daw_config",
    )
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("DB query error: {e}"))?;

    if rows.is_empty() {
        // No config yet — run detection first
        let daws = daw_detector::detect();
        return Ok(DawConfig { daws });
    }

    let daws = rows
        .into_iter()
        .map(|r| DawInfo {
            name: r.name,
            slug: r.daw_id,
            detected: r.detected,
            install_path: r.install_path,
            content_path: r.content_path,
            version: r.version,
        })
        .collect();

    Ok(DawConfig { daws })
}

/// Set a custom path for a DAW's content directory.
#[tauri::command]
pub async fn set_daw_path(
    daw: String,
    path: String,
    db: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE daw_config SET content_path = ? WHERE daw_id = ?")
        .bind(&path)
        .bind(&daw)
        .execute(db.inner())
        .await
        .map_err(|e| format!("DB error: {e}"))?;
    Ok(())
}

/// Preview where files would be placed for a given product.
#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_placement_preview(
    productId: u64,
    db: State<'_, SqlitePool>,
) -> Result<PlacementPreview, String> {
    let product = product_sync::get_product(db.inner(), productId).await?;

    let daw_config = get_daw_list_from_db(db.inner()).await?;
    let base_dir = get_download_base(db.inner()).await;

    Ok(file_placement::preview_placement(
        &product,
        &daw_config,
        &base_dir,
    ))
}

async fn get_daw_list_from_db(db: &SqlitePool) -> Result<Vec<DawInfo>, String> {
    let rows = sqlx::query_as::<_, DawRow>(
        "SELECT daw_id, name, detected, install_path, content_path, version FROM daw_config",
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB query error: {e}"))?;

    Ok(rows
        .into_iter()
        .map(|r| DawInfo {
            name: r.name,
            slug: r.daw_id,
            detected: r.detected,
            install_path: r.install_path,
            content_path: r.content_path,
            version: r.version,
        })
        .collect())
}

async fn get_download_base(db: &SqlitePool) -> String {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = 'download_path'")
            .fetch_optional(db)
            .await
            .ok()
            .flatten();

    row.map(|r| r.0)
        .unwrap_or_else(crate::platform::default_download_path)
}

#[derive(sqlx::FromRow)]
struct DawRow {
    daw_id: String,
    name: String,
    detected: bool,
    install_path: Option<String>,
    content_path: Option<String>,
    version: Option<String>,
}
