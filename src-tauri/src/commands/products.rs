use crate::services::api_client::ApiClient;
use crate::services::product_sync;
use crate::{DeltaSyncResult, Product, ProductFilters, SyncResult};
use sqlx::SqlitePool;
use tauri::State;

/// Sync a page of products from the API.
#[tauri::command]
#[allow(non_snake_case)]
pub async fn sync_products(
    page: u32,
    pageSize: u32,
    api: State<'_, ApiClient>,
    db: State<'_, SqlitePool>,
) -> Result<SyncResult, String> {
    product_sync::sync_page(&api, &db, page, pageSize).await
}

/// Sync only products changed since a given timestamp.
#[tauri::command]
pub async fn sync_delta(
    since: String,
    api: State<'_, ApiClient>,
    db: State<'_, SqlitePool>,
) -> Result<DeltaSyncResult, String> {
    product_sync::sync_delta(&api, &db, &since).await
}

/// Search products in the local SQLite database.
#[tauri::command]
pub async fn search_products(
    query: String,
    filters: ProductFilters,
    db: State<'_, SqlitePool>,
) -> Result<Vec<Product>, String> {
    product_sync::search(&db, &query, &filters).await
}

/// Get a single product by ID from the local database.
#[tauri::command]
pub async fn get_product(id: u64, db: State<'_, SqlitePool>) -> Result<Product, String> {
    product_sync::get_product(&db, id).await
}

/// Load all products from the local SQLite cache (instant, no API call).
#[tauri::command]
pub async fn load_cached_products(db: State<'_, SqlitePool>) -> Result<Vec<Product>, String> {
    product_sync::load_all_from_db(&db).await
}

/// Toggle favorite status for a product.
#[tauri::command]
#[allow(non_snake_case)]
pub async fn toggle_favorite(productId: u64, db: State<'_, SqlitePool>) -> Result<bool, String> {
    let exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM favorites WHERE product_id = ?")
        .bind(productId as i64)
        .fetch_one(db.inner())
        .await
        .map_err(|e| format!("DB error: {e}"))?;

    if exists.0 > 0 {
        sqlx::query("DELETE FROM favorites WHERE product_id = ?")
            .bind(productId as i64)
            .execute(db.inner())
            .await
            .map_err(|e| format!("DB error: {e}"))?;
        Ok(false) // unfavorited
    } else {
        sqlx::query("INSERT INTO favorites (product_id) VALUES (?)")
            .bind(productId as i64)
            .execute(db.inner())
            .await
            .map_err(|e| format!("DB error: {e}"))?;
        Ok(true) // favorited
    }
}

/// Get all favorite product IDs.
#[tauri::command]
pub async fn get_favorite_ids(db: State<'_, SqlitePool>) -> Result<Vec<u64>, String> {
    let rows: Vec<(i64,)> = sqlx::query_as("SELECT product_id FROM favorites")
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("DB error: {e}"))?;
    Ok(rows.into_iter().map(|r| r.0 as u64).collect())
}

/// Get IDs of all products that have been downloaded (completed in download_queue).
#[tauri::command]
pub async fn get_downloaded_product_ids(db: State<'_, SqlitePool>) -> Result<Vec<u64>, String> {
    let rows: Vec<(i64,)> = sqlx::query_as(
        "SELECT DISTINCT product_id FROM download_queue WHERE status = 'complete'"
    )
    .fetch_all(db.inner())
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    Ok(rows.into_iter().map(|r| r.0 as u64).collect())
}
