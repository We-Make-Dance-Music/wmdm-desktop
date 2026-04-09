use crate::services::api_client::ApiClient;
use crate::{
    CreatorInfo, DeltaSyncResult, DownloadLink, Product, SyncResult,
};
use serde::Deserialize;
use sqlx::SqlitePool;

/// PHP's json_encode turns empty arrays [] into {} when keys are non-sequential.
/// This deserializer handles both [] and {} gracefully for Vec fields.
fn vec_lenient<'de, D, T>(deserializer: D) -> Result<Vec<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::de::DeserializeOwned,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::Array(arr) => {
            serde_json::from_value(serde_json::Value::Array(arr))
                .map_err(serde::de::Error::custom)
        }
        serde_json::Value::Null => Ok(Vec::new()),
        serde_json::Value::Object(_) => Ok(Vec::new()), // PHP empty array = {}
        _ => Ok(Vec::new()),
    }
}

/// Top-level Magento API response wrapper: { "success": true, "data": { ... } }
#[derive(Deserialize, Debug)]
struct ApiResponse {
    #[serde(default)]
    success: bool,
    #[serde(default)]
    data: Option<ApiProductsData>,
    #[serde(default)]
    error: Option<String>,
}

/// The "data" field from the products endpoint
#[derive(Deserialize, Debug)]
struct ApiProductsData {
    #[serde(default, deserialize_with = "vec_lenient")]
    items: Vec<ApiProduct>,
    #[serde(default)]
    total_count: u64,
    #[serde(default)]
    page: u32,
    #[serde(default)]
    page_size: u32,
    #[serde(default)]
    total_pages: u32,
    #[serde(default)]
    count: Option<u64>,
}

/// Product shape from the Magento WMDM_DesktopApi (snake_case JSON)
#[derive(Deserialize, Debug, Clone)]
struct ApiProduct {
    id: u64,
    sku: String,
    name: String,
    #[serde(default)]
    thumbnail_url: Option<String>,
    #[serde(default)]
    format_type: Option<String>,
    #[serde(default, deserialize_with = "vec_lenient")]
    daws: Vec<String>,
    #[serde(default, deserialize_with = "vec_lenient")]
    synths: Vec<String>,
    #[serde(default, deserialize_with = "vec_lenient")]
    format_labels: Vec<String>,
    #[serde(default, deserialize_with = "vec_lenient")]
    genres: Vec<String>,
    #[serde(default)]
    bpm: Option<serde_json::Value>, // Can be int, string, or null from Magento
    #[serde(default)]
    key: Option<String>,
    #[serde(default)]
    stream_url: Option<String>,
    #[serde(default)]
    waveform: Option<String>,
    #[serde(default)]
    creator: Option<ApiCreator>,
    #[serde(default, deserialize_with = "vec_lenient")]
    download_links: Vec<ApiDownloadLink>,
    #[serde(default)]
    purchase_date: Option<String>,
    #[serde(default)]
    price: Option<serde_json::Value>, // Can be float or string from Magento
    #[serde(default)]
    store_name: Option<String>,
    #[serde(default)]
    store_id: Option<serde_json::Value>,
    #[serde(default)]
    order_increment_id: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
struct ApiCreator {
    #[serde(default)]
    id: serde_json::Value, // Can be int or string
    #[serde(default)]
    name: String,
    #[serde(default)]
    shop_url: Option<String>,
    #[serde(default)]
    logo: Option<String>,
}

/// Download link shape from Magento (matches WMDM_DesktopApi output)
#[derive(Deserialize, Debug, Clone)]
struct ApiDownloadLink {
    #[serde(default)]
    item_id: serde_json::Value,
    #[serde(default)]
    link_hash: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    downloads_bought: u32,
    #[serde(default)]
    downloads_used: u32,
    #[serde(default)]
    remaining: Option<i32>,
    #[serde(default)]
    status: Option<String>,
}

fn value_to_u64(v: &serde_json::Value) -> u64 {
    match v {
        serde_json::Value::Number(n) => n.as_u64().unwrap_or(0),
        serde_json::Value::String(s) => s.parse().unwrap_or(0),
        _ => 0,
    }
}

fn value_to_u32(v: &serde_json::Value) -> Option<u32> {
    match v {
        serde_json::Value::Number(n) => n.as_u64().map(|n| n as u32),
        serde_json::Value::String(s) => s.parse().ok(),
        serde_json::Value::Null => None,
        _ => None,
    }
}

fn api_product_to_product(p: ApiProduct) -> Product {
    Product {
        id: p.id,
        name: p.name,
        sku: p.sku,
        thumbnail_url: p.thumbnail_url,
        stream_url: p.stream_url,
        waveform: p.waveform,
        format_type: p.format_type.unwrap_or_else(|| "other".into()),
        daws: p.daws,
        genres: p.genres,
        bpm: p.bpm.as_ref().and_then(value_to_u32),
        key: p.key,
        creator: p.creator.map(|c| CreatorInfo {
            id: value_to_u64(&c.id),
            name: c.name,
            avatar_url: c.shop_url,
        }),
        download_links: p
            .download_links
            .into_iter()
            .map(|l| DownloadLink {
                hash: l.link_hash,
                label: l.title,
                file_name: String::new(),
                file_size: 0,
                download_count: l.downloads_used,
                remaining_downloads: l.remaining,
            })
            .collect(),
        purchased_at: p.purchase_date.unwrap_or_default(),
        file_size: None,
    }
}

/// Parse the Magento API response which double-encodes JSON (returns string type).
/// The HTTP response body is: `"{\"success\":true,...}"` — a JSON string containing JSON.
fn parse_magento_response(raw: &str) -> Result<ApiResponse, String> {
    // Try direct parse first
    if let Ok(resp) = serde_json::from_str::<ApiResponse>(raw) {
        return Ok(resp);
    }
    // Magento returns string type — the response is a JSON-encoded string
    let inner: String = serde_json::from_str(raw)
        .map_err(|e| format!("Failed to parse outer JSON string: {e}"))?;
    serde_json::from_str::<ApiResponse>(&inner)
        .map_err(|e| format!("Failed to parse inner API response: {e}"))
}

/// Fetch a page of products from the API and persist to SQLite.
pub async fn sync_page(
    api: &ApiClient,
    db: &SqlitePool,
    page: u32,
    page_size: u32,
) -> Result<SyncResult, String> {
    let path = format!(
        "/V1/wmdm/desktop/products?page={}&pageSize={}",
        page, page_size
    );
    // Use post_raw-style fetch to get the raw string, then double-parse
    let raw = api.get_raw(&path).await?;
    let resp = parse_magento_response(&raw)?;

    if !resp.success {
        return Err(resp.error.unwrap_or_else(|| "API request failed".into()));
    }

    let data = resp.data.ok_or("No data in API response")?;
    let products: Vec<Product> = data.items.into_iter().map(api_product_to_product).collect();
    let has_more = data.page < data.total_pages;

    // Upsert into SQLite
    for product in &products {
        upsert_product(db, product).await?;
    }

    Ok(SyncResult {
        products,
        total_count: data.total_count,
        has_more,
    })
}

/// Fetch only products changed since `since` timestamp.
pub async fn sync_delta(
    api: &ApiClient,
    db: &SqlitePool,
    since: &str,
) -> Result<DeltaSyncResult, String> {
    let path = format!("/V1/wmdm/desktop/products/sync?since={}", since);
    let raw = api.get_raw(&path).await?;
    let resp = parse_magento_response(&raw)?;

    if !resp.success {
        return Err(resp.error.unwrap_or_else(|| "Delta sync failed".into()));
    }

    let data = resp.data.ok_or("No data in delta response")?;
    let items: Vec<Product> = data.items.into_iter().map(api_product_to_product).collect();

    for product in &items {
        upsert_product(db, product).await?;
    }

    Ok(DeltaSyncResult {
        added: items,
        updated: vec![],
        removed: vec![],
    })
}

/// Search products in the local SQLite DB.
pub async fn search(
    db: &SqlitePool,
    query: &str,
    filters: &crate::ProductFilters,
) -> Result<Vec<Product>, String> {
    // Build a basic search query
    let like_pattern = format!("%{query}%");

    let rows = sqlx::query_as::<_, ProductRow>(
        "SELECT id, sku, name, format_type, daws, genres, bpm, key_sig, \
         creator_id, creator_name, creator_avatar_url, thumbnail_url, stream_url, waveform, \
         download_links, purchased_at, file_size \
         FROM products \
         WHERE (name LIKE ? OR sku LIKE ? OR creator_name LIKE ? OR genres LIKE ?) \
         ORDER BY purchased_at DESC \
         LIMIT 500",
    )
    .bind(&like_pattern)
    .bind(&like_pattern)
    .bind(&like_pattern)
    .bind(&like_pattern)
    .fetch_all(db)
    .await
    .map_err(|e| format!("Search query failed: {e}"))?;

    let mut results: Vec<Product> = rows.into_iter().map(row_to_product).collect();

    // Apply in-memory filters
    if !filters.daw.is_empty() {
        results.retain(|p| {
            p.daws
                .iter()
                .any(|d| filters.daw.iter().any(|fd| d.to_lowercase().contains(&fd.to_lowercase())))
        });
    }
    if !filters.format_type.is_empty() {
        results.retain(|p| filters.format_type.contains(&p.format_type));
    }
    if !filters.genre.is_empty() {
        results.retain(|p| {
            p.genres.iter().any(|g| {
                filters
                    .genre
                    .iter()
                    .any(|fg| g.to_lowercase().contains(&fg.to_lowercase()))
            })
        });
    }
    if let Some(ref range) = filters.bpm_range {
        results.retain(|p| {
            p.bpm
                .map(|b| b >= range.0 && b <= range.1)
                .unwrap_or(false)
        });
    }
    if let Some(ref key) = filters.key {
        results.retain(|p| p.key.as_deref() == Some(key.as_str()));
    }

    Ok(results)
}

/// Load all products from the local SQLite cache.
pub async fn load_all_from_db(db: &SqlitePool) -> Result<Vec<Product>, String> {
    let rows = sqlx::query_as::<_, ProductRow>(
        "SELECT id, sku, name, format_type, daws, genres, bpm, key_sig, \
         creator_id, creator_name, creator_avatar_url, thumbnail_url, stream_url, waveform, \
         download_links, purchased_at, file_size \
         FROM products ORDER BY purchased_at DESC",
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("DB query failed: {e}"))?;

    Ok(rows.into_iter().map(row_to_product).collect())
}

/// Get a single product from SQLite.
pub async fn get_product(db: &SqlitePool, id: u64) -> Result<Product, String> {
    let row = sqlx::query_as::<_, ProductRow>(
        "SELECT id, sku, name, format_type, daws, genres, bpm, key_sig, \
         creator_id, creator_name, creator_avatar_url, thumbnail_url, stream_url, waveform, \
         download_links, purchased_at, file_size \
         FROM products WHERE id = ?",
    )
    .bind(id as i64)
    .fetch_optional(db)
    .await
    .map_err(|e| format!("DB query failed: {e}"))?
    .ok_or_else(|| format!("Product {} not found", id))?;

    Ok(row_to_product(row))
}

async fn upsert_product(db: &SqlitePool, product: &Product) -> Result<(), String> {
    let daws_json = serde_json::to_string(&product.daws).unwrap_or_else(|_| "[]".into());
    let genres_json = serde_json::to_string(&product.genres).unwrap_or_else(|_| "[]".into());
    let links_json =
        serde_json::to_string(&product.download_links).unwrap_or_else(|_| "[]".into());

    sqlx::query(
        "INSERT OR REPLACE INTO products \
         (id, sku, name, format_type, daws, genres, bpm, key_sig, \
          creator_id, creator_name, creator_avatar_url, thumbnail_url, stream_url, waveform, \
          download_links, purchased_at, file_size) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(product.id as i64)
    .bind(&product.sku)
    .bind(&product.name)
    .bind(&product.format_type)
    .bind(&daws_json)
    .bind(&genres_json)
    .bind(product.bpm.map(|b| b as i64))
    .bind(&product.key)
    .bind(product.creator.as_ref().map(|c| c.id as i64))
    .bind(product.creator.as_ref().map(|c| c.name.as_str()))
    .bind(product.creator.as_ref().and_then(|c| c.avatar_url.as_deref()))
    .bind(&product.thumbnail_url)
    .bind(&product.stream_url)
    .bind(&product.waveform)
    .bind(&links_json)
    .bind(&product.purchased_at)
    .bind(product.file_size.map(|s| s as i64))
    .execute(db)
    .await
    .map_err(|e| format!("DB upsert error: {e}"))?;

    Ok(())
}

#[derive(sqlx::FromRow)]
struct ProductRow {
    id: i64,
    sku: String,
    name: String,
    format_type: String,
    daws: String,
    genres: String,
    bpm: Option<i64>,
    key_sig: Option<String>,
    creator_id: Option<i64>,
    creator_name: Option<String>,
    creator_avatar_url: Option<String>,
    thumbnail_url: Option<String>,
    stream_url: Option<String>,
    waveform: Option<String>,
    download_links: String,
    purchased_at: String,
    file_size: Option<i64>,
}

fn row_to_product(row: ProductRow) -> Product {
    let daws: Vec<String> = serde_json::from_str(&row.daws).unwrap_or_default();
    let genres: Vec<String> = serde_json::from_str(&row.genres).unwrap_or_default();
    let download_links: Vec<DownloadLink> =
        serde_json::from_str(&row.download_links).unwrap_or_default();

    let creator = row.creator_id.map(|id| CreatorInfo {
        id: id as u64,
        name: row.creator_name.unwrap_or_default(),
        avatar_url: row.creator_avatar_url,
    });

    Product {
        id: row.id as u64,
        name: row.name,
        sku: row.sku,
        thumbnail_url: row.thumbnail_url,
        stream_url: row.stream_url,
        waveform: row.waveform,
        format_type: row.format_type,
        daws,
        genres,
        bpm: row.bpm.map(|b| b as u32),
        key: row.key_sig,
        creator,
        download_links,
        purchased_at: row.purchased_at,
        file_size: row.file_size.map(|s| s as u64),
    }
}
