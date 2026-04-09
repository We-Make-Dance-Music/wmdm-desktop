use crate::services::api_client::ApiClient;
use crate::services::auth_service::AuthService;
use crate::services::download_engine::DownloadEngine;
use crate::DownloadItem;
use sqlx::SqlitePool;
use tauri::State;

/// Start downloading a product file.
#[tauri::command]
#[allow(non_snake_case)]
pub async fn start_download(
    productId: u64,
    linkHash: String,
    api: State<'_, ApiClient>,
    auth: State<'_, AuthService>,
    engine: State<'_, DownloadEngine>,
    db: State<'_, SqlitePool>,
    app_handle: tauri::AppHandle,
) -> Result<DownloadItem, String> {
    let product_id = productId;
    let link_hash = linkHash;

    // Verify we have a token
    if auth.get_token().is_none() {
        return Err("Not authenticated".to_string());
    }

    // Get the download URL from the API — response is double-encoded (Magento string return type)
    let body = serde_json::json!({ "linkHash": &link_hash });
    let raw = api.post_raw_with_store("/V1/wmdm/desktop/download-url", &body).await?;

    // Double-parse: outer JSON string, then inner JSON object
    let inner: String = serde_json::from_str(&raw)
        .unwrap_or_else(|_| raw.clone());
    let resp_value: serde_json::Value = serde_json::from_str(&inner)
        .map_err(|e| format!("Failed to parse download URL response: {e}"))?;

    let success = resp_value.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
    if !success {
        let error = resp_value.get("error").and_then(|v| v.as_str()).unwrap_or("Download URL request failed");
        return Err(error.to_string());
    }

    let data = resp_value.get("data").ok_or("No data in download URL response")?;
    let download_url = data.get("url").and_then(|v| v.as_str()).ok_or("No URL in response")?.to_string();
    let file_name_from_api = data.get("filename").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let download_id = uuid::Uuid::new_v4().to_string();
    let file_name = if file_name_from_api.is_empty() {
        format!("download-{}.zip", &download_id[..8])
    } else {
        file_name_from_api
    };

    // Get product name from DB for display
    let product_name = {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT name FROM products WHERE id = ?")
                .bind(product_id as i64)
                .fetch_optional(db.inner())
                .await
                .map_err(|e| format!("DB error: {e}"))?;
        row.map(|r| r.0)
            .unwrap_or_else(|| format!("Product {product_id}"))
    };

    // Save the download URL in the DB for resume capability
    let _ = sqlx::query("UPDATE download_queue SET download_url = ? WHERE id = ?")
        .bind(&download_url)
        .bind(&download_id)
        .execute(db.inner())
        .await;

    let item = engine
        .enqueue(
            download_id,
            product_id,
            product_name,
            link_hash,
            file_name,
            download_url,
            0, // file size unknown until download starts
            app_handle,
            db.inner().clone(),
        )
        .await?;

    Ok(item)
}

/// Pause an active download.
#[tauri::command]
pub async fn pause_download(
    id: String,
    engine: State<'_, DownloadEngine>,
) -> Result<(), String> {
    engine.pause(&id).await
}

/// Resume a paused download.
#[tauri::command]
pub async fn resume_download(
    id: String,
    engine: State<'_, DownloadEngine>,
    db: State<'_, SqlitePool>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    engine
        .resume(&id, app_handle, db.inner().clone())
        .await
}

/// Cancel a download and remove it from the queue.
#[tauri::command]
pub async fn cancel_download(
    id: String,
    engine: State<'_, DownloadEngine>,
    db: State<'_, SqlitePool>,
) -> Result<(), String> {
    engine.cancel(&id).await?;

    // Remove from DB
    sqlx::query("DELETE FROM download_queue WHERE id = ?")
        .bind(&id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("DB error: {e}"))?;

    Ok(())
}

/// Get all downloads — active from engine + completed/errored from DB.
#[tauri::command]
pub async fn get_download_queue(
    engine: State<'_, DownloadEngine>,
    db: State<'_, SqlitePool>,
) -> Result<Vec<DownloadItem>, String> {
    let mut items = engine.get_queue().await;

    // Also load completed/errored from DB that aren't in the in-memory queue
    let in_memory_ids: std::collections::HashSet<String> = items.iter().map(|i| i.id.clone()).collect();

    let db_rows: Vec<(String, i64, String, String, String, String, f64, i64, i64, Option<String>, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, product_id, product_name, link_hash, file_name, status, progress, \
         bytes_downloaded, total_bytes, error, output_path, started_at, completed_at \
         FROM download_queue ORDER BY completed_at DESC LIMIT 50"
    )
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    for row in db_rows {
        if in_memory_ids.contains(&row.0) {
            continue;
        }
        items.push(DownloadItem {
            id: row.0,
            product_id: row.1 as u64,
            product_name: row.2,
            link_hash: row.3,
            file_name: row.4,
            status: match row.5.as_str() {
                "complete" => crate::DownloadStatus::Complete,
                "error" => crate::DownloadStatus::Error,
                "paused" => crate::DownloadStatus::Paused,
                "downloading" => crate::DownloadStatus::Downloading,
                _ => crate::DownloadStatus::Queued,
            },
            progress: row.6,
            bytes_downloaded: row.7 as u64,
            total_bytes: row.8 as u64,
            speed: 0,
            eta: None,
            error: row.9,
            output_path: row.10,
            started_at: row.11,
            completed_at: row.12,
        });
    }

    Ok(items)
}

/// Clear completed and errored downloads from the database.
#[tauri::command]
pub async fn clear_download_history(
    db: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM download_queue WHERE status IN ('complete', 'error')")
        .execute(db.inner())
        .await
        .map_err(|e| format!("DB error: {e}"))?;
    Ok(())
}
