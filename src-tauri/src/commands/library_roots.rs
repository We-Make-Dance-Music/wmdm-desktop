// Bridge plugin: library_roots CRUD + scan/tag orchestration commands.
// See ~/.claude/plans/calm-squishing-frog.md.

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, State};

use crate::services::sample_indexer::{self, IndexStatus, IndexerState};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRoot {
    pub id: i64,
    pub path: String,
    pub kind: String,
    pub enabled: bool,
    pub added_at: String,
    pub file_count: i64,
    pub tagged_count: i64,
}

#[tauri::command]
pub async fn list_library_roots(db: State<'_, SqlitePool>) -> Result<Vec<LibraryRoot>, String> {
    let rows: Vec<(i64, String, String, i64, String)> = sqlx::query_as(
        "SELECT id, path, kind, enabled, added_at FROM library_roots ORDER BY id",
    )
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("list_library_roots: {e}"))?;

    let mut out = Vec::with_capacity(rows.len());
    for (id, path, kind, enabled, added_at) in rows {
        let (file_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM sample_files WHERE root_id = ?")
                .bind(id)
                .fetch_one(db.inner())
                .await
                .unwrap_or((0,));
        let (tagged_count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sample_files sf
             JOIN sample_tags st ON st.sample_id = sf.id
             WHERE sf.root_id = ?",
        )
        .bind(id)
        .fetch_one(db.inner())
        .await
        .unwrap_or((0,));

        out.push(LibraryRoot {
            id,
            path,
            kind,
            enabled: enabled != 0,
            added_at,
            file_count,
            tagged_count,
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn add_library_root(
    path: String,
    kind: Option<String>,
    db: State<'_, SqlitePool>,
) -> Result<i64, String> {
    let kind = kind.unwrap_or_else(|| "user".to_string());
    let result = sqlx::query(
        "INSERT OR IGNORE INTO library_roots (path, kind) VALUES (?, ?)",
    )
    .bind(&path)
    .bind(&kind)
    .execute(db.inner())
    .await
    .map_err(|e| format!("add_library_root: {e}"))?;

    if result.rows_affected() > 0 {
        Ok(result.last_insert_rowid())
    } else {
        let (id,): (i64,) = sqlx::query_as("SELECT id FROM library_roots WHERE path = ?")
            .bind(&path)
            .fetch_one(db.inner())
            .await
            .map_err(|e| format!("add_library_root (lookup): {e}"))?;
        Ok(id)
    }
}

#[tauri::command]
pub async fn remove_library_root(
    id: i64,
    db: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM library_roots WHERE id = ?")
        .bind(id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("remove_library_root: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn set_library_root_enabled(
    id: i64,
    enabled: bool,
    db: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE library_roots SET enabled = ? WHERE id = ?")
        .bind(if enabled { 1 } else { 0 })
        .bind(id)
        .execute(db.inner())
        .await
        .map_err(|e| format!("set_library_root_enabled: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn scan_library_roots(
    app: AppHandle,
    db: State<'_, SqlitePool>,
    state: State<'_, Arc<IndexerState>>,
) -> Result<(), String> {
    // Guard against concurrent scans.
    {
        let s = state.status.lock().await;
        if s.scanning {
            return Err("scan already in progress".into());
        }
    }
    let pool = db.inner().clone();
    let state_arc = state.inner().clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = sample_indexer::scan_all_roots(&pool, state_arc.clone(), &app_clone).await {
            log::error!("scan_all_roots failed: {e}");
        }
        if let Err(e) = sample_indexer::tag_pending(&pool, state_arc.clone(), &app_clone).await {
            log::error!("tag_pending failed: {e}");
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn get_index_status(
    state: State<'_, Arc<IndexerState>>,
) -> Result<IndexStatus, String> {
    let s = state.status.lock().await;
    Ok(s.clone())
}
