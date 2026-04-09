// ============================================================
// WMDM Desktop App — Store Commands
// Public store catalog for browse & buy
// ============================================================

use crate::services::api_client::ApiClient;
use crate::StoreProduct;
use serde::{Deserialize, Serialize};
use tauri::State;

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
            serde_json::from_value(serde_json::Value::Array(arr)).map_err(serde::de::Error::custom)
        }
        serde_json::Value::Null => Ok(Vec::new()),
        serde_json::Value::Object(_) => Ok(Vec::new()), // PHP empty array = {}
        _ => Ok(Vec::new()),
    }
}

/// Response from the Magento store catalog endpoint.
#[derive(Deserialize, Debug)]
struct MagentoStoreResponse {
    #[serde(default)]
    success: bool,
    #[serde(default)]
    data: Option<MagentoStoreData>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Deserialize, Debug)]
struct MagentoStoreData {
    #[serde(default, deserialize_with = "vec_lenient")]
    items: Vec<MagentoStoreItem>,
    #[serde(default)]
    total_count: u64,
    #[serde(default)]
    page: u32,
    #[serde(default)]
    page_size: u32,
    #[serde(default)]
    total_pages: u32,
}

#[derive(Deserialize, Debug)]
struct MagentoStoreItem {
    id: u64,
    #[serde(default)]
    sku: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    price: serde_json::Value, // Can be float, int, or string from Magento
    #[serde(default)]
    product_url: String,
    #[serde(default)]
    format_type: String,
    #[serde(default, deserialize_with = "vec_lenient")]
    daws: Vec<String>,
    #[serde(default, deserialize_with = "vec_lenient")]
    format_labels: Vec<String>,
    #[serde(default)]
    bpm: Option<serde_json::Value>, // Can be int, string, or null
    #[serde(default)]
    key: Option<String>,
    #[serde(default, deserialize_with = "vec_lenient")]
    genres: Vec<String>,
    #[serde(default)]
    thumbnail_url: Option<String>,
    #[serde(default)]
    stream_url: Option<String>,
    #[serde(default)]
    waveform: Option<String>,
    #[serde(default)]
    short_description: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    creator: Option<MagentoStoreCreator>,
    #[serde(default)]
    created_at: Option<String>,
}

#[derive(Deserialize, Debug)]
struct MagentoStoreCreator {
    #[serde(default)]
    id: serde_json::Value, // Can be int or string
    #[serde(default)]
    name: String,
    #[serde(default)]
    avatar_url: Option<String>,
}

fn value_to_f64(v: &serde_json::Value) -> f64 {
    match v {
        serde_json::Value::Number(n) => n.as_f64().unwrap_or(0.0),
        serde_json::Value::String(s) => s.parse().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn value_to_u64(v: &serde_json::Value) -> u64 {
    match v {
        serde_json::Value::Number(n) => n.as_u64().unwrap_or(0),
        serde_json::Value::String(s) => s.parse().unwrap_or(0),
        _ => 0,
    }
}

fn value_to_u32_opt(v: &Option<serde_json::Value>) -> Option<u32> {
    match v {
        Some(serde_json::Value::Number(n)) => n.as_u64().map(|n| n as u32),
        Some(serde_json::Value::String(s)) => s.parse().ok(),
        _ => None,
    }
}

/// Parse the Magento API response which double-encodes JSON (returns string type).
/// The HTTP response body is: `"{\"success\":true,...}"` — a JSON string containing JSON.
fn parse_store_response(raw: &str) -> Result<MagentoStoreResponse, String> {
    // Try direct parse first
    if let Ok(resp) = serde_json::from_str::<MagentoStoreResponse>(raw) {
        return Ok(resp);
    }
    // Magento returns string type — the response is a JSON-encoded string
    let inner: String = serde_json::from_str(raw)
        .map_err(|e| format!("Failed to parse outer JSON string: {e}"))?;
    serde_json::from_str::<MagentoStoreResponse>(&inner)
        .map_err(|e| format!("Failed to parse inner store response: {e}"))
}

/// Result returned to the frontend.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StoreResult {
    pub items: Vec<StoreProduct>,
    pub total_count: u64,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
}

/// Get latest products from the public store catalog.
#[tauri::command]
#[allow(non_snake_case)]
pub async fn get_store_products(
    page: u32,
    pageSize: u32,
    search: Option<String>,
    formatType: Option<String>,
    daw: Option<String>,
    genre: Option<String>,
    api: State<'_, ApiClient>,
) -> Result<StoreResult, String> {
    let mut query_parts = vec![
        format!("page={}", page.max(1)),
        format!("pageSize={}", pageSize.min(50).max(1)),
    ];

    if let Some(ref s) = search {
        if !s.is_empty() {
            query_parts.push(format!("search={}", urlencoding::encode(s)));
        }
    }
    if let Some(ref ft) = formatType {
        if !ft.is_empty() {
            query_parts.push(format!("formatType={}", urlencoding::encode(ft)));
        }
    }
    if let Some(ref d) = daw {
        if !d.is_empty() {
            query_parts.push(format!("daw={}", urlencoding::encode(d)));
        }
    }
    if let Some(ref g) = genre {
        if !g.is_empty() {
            query_parts.push(format!("genre={}", urlencoding::encode(g)));
        }
    }

    let path = format!("/V1/wmdm/desktop/store/latest?{}", query_parts.join("&"));

    // Use get_raw_public since Magento double-encodes the JSON response
    let raw = api.get_raw_public(&path).await?;
    let response = parse_store_response(&raw)?;

    if !response.success {
        return Err(response
            .error
            .unwrap_or_else(|| "Unknown store API error".to_string()));
    }

    let data = response.data.ok_or("Empty store response")?;

    let items: Vec<StoreProduct> = data
        .items
        .into_iter()
        .map(|item| {
            let key = item.key.filter(|k| !k.is_empty());
            StoreProduct {
                id: item.id,
                name: item.name,
                sku: item.sku,
                thumbnail_url: item.thumbnail_url.filter(|s| !s.is_empty()),
                stream_url: item.stream_url.filter(|s| !s.is_empty()),
                waveform: item.waveform.filter(|s| !s.is_empty()),
                short_description: item.short_description.filter(|s| !s.is_empty()),
                description: item.description.filter(|s| !s.is_empty()),
                format_type: item.format_type,
                daws: item.daws,
                genres: item.genres,
                bpm: value_to_u32_opt(&item.bpm),
                key,
                creator: item.creator.map(|c| crate::CreatorInfo {
                    id: value_to_u64(&c.id),
                    name: c.name,
                    avatar_url: c.avatar_url,
                }),
                price: value_to_f64(&item.price),
                product_url: item.product_url,
                created_at: item.created_at.unwrap_or_default(),
            }
        })
        .collect();

    Ok(StoreResult {
        items,
        total_count: data.total_count,
        page: data.page,
        page_size: data.page_size,
        total_pages: data.total_pages,
    })
}
