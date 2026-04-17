// ============================================================
// WMDM Desktop App — Rust Backend (lib.rs)
// Tauri 2 application for music producers.
// ============================================================

#![allow(dead_code)]

mod commands;
mod crypto;
mod db;
mod platform;
mod services;

use serde::{Deserialize, Serialize};
use tauri::Manager;

// ─── Shared types (mirroring TypeScript frontend types) ─────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: u64,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub avatar_url: Option<String>,
    pub store_id: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AuthSession {
    pub token: String,
    pub user: UserProfile,
    pub expires_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: u64,
    pub name: String,
    pub sku: String,
    pub thumbnail_url: Option<String>,
    pub stream_url: Option<String>,
    pub waveform: Option<String>,
    pub format_type: String,
    pub daws: Vec<String>,
    pub genres: Vec<String>,
    pub bpm: Option<u32>,
    pub key: Option<String>,
    pub creator: Option<CreatorInfo>,
    pub download_links: Vec<DownloadLink>,
    pub purchased_at: String,
    pub file_size: Option<u64>,
    #[serde(default)]
    pub is_welcome_gift: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreatorInfo {
    pub id: u64,
    pub name: String,
    pub avatar_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadLink {
    pub hash: String,
    pub label: String,
    pub file_name: String,
    pub file_size: u64,
    pub download_count: u32,
    pub remaining_downloads: Option<i32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItem {
    pub id: String,
    pub product_id: u64,
    pub product_name: String,
    pub link_hash: String,
    pub file_name: String,
    pub status: DownloadStatus,
    pub progress: f64,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub speed: u64,
    pub eta: Option<u64>,
    pub error: Option<String>,
    pub output_path: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Paused,
    Extracting,
    Placing,
    Complete,
    Error,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DawInfo {
    pub name: String,
    pub slug: String,
    pub detected: bool,
    pub install_path: Option<String>,
    pub content_path: Option<String>,
    pub version: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DawConfig {
    pub daws: Vec<DawInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PlacementFile {
    pub source_path: String,
    pub destination_path: String,
    pub file_type: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PlacementPreview {
    pub product_id: u64,
    pub files: Vec<PlacementFile>,
    pub daw_name: String,
    pub content_path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub download_path: String,
    pub max_concurrent_downloads: u32,
    pub auto_update: bool,
    pub launch_at_startup: bool,
    pub notifications_enabled: bool,
    pub theme: String,
    pub first_run_complete: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            download_path: platform::default_download_path(),
            max_concurrent_downloads: 3,
            auto_update: true,
            launch_at_startup: false,
            notifications_enabled: true,
            theme: "dark".into(),
            first_run_complete: false,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub products: Vec<Product>,
    pub total_count: u64,
    pub has_more: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeltaSyncResult {
    pub added: Vec<Product>,
    pub updated: Vec<Product>,
    pub removed: Vec<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProductFilters {
    #[serde(default)]
    pub daw: Vec<String>,
    #[serde(default)]
    pub format_type: Vec<String>,
    #[serde(default)]
    pub genre: Vec<String>,
    #[serde(default)]
    pub bpm_range: Option<(u32, u32)>,
    #[serde(default)]
    pub key: Option<String>,
}

/// Store product (for browse & buy — not owned products).
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StoreProduct {
    pub id: u64,
    pub name: String,
    pub sku: String,
    pub thumbnail_url: Option<String>,
    pub stream_url: Option<String>,
    pub waveform: Option<String>,
    pub short_description: Option<String>,
    pub description: Option<String>,
    pub format_type: String,
    pub daws: Vec<String>,
    pub genres: Vec<String>,
    pub bpm: Option<u32>,
    pub key: Option<String>,
    pub creator: Option<CreatorInfo>,
    pub price: f64,
    pub product_url: String,
    pub created_at: String,
}

// ─── Application entry point ────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Get app data directory
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            std::fs::create_dir_all(&app_data_dir).ok();

            // Initialize services using tauri's async runtime
            let db = tauri::async_runtime::block_on(async { db::init(&app_data_dir).await })?;

            // Create services
            let api_client = services::api_client::ApiClient::new();
            let auth_service = services::auth_service::AuthService::new();

            // Restore token and store code from keychain to API client
            if let Some(token) = auth_service.get_token() {
                let store_code = auth_service.get_store_code();
                tauri::async_runtime::block_on(async {
                    api_client.set_token(Some(token)).await;
                    if let Some(code) = store_code {
                        api_client.set_store_code(Some(code)).await;
                    }
                });
            }

            let download_path = tauri::async_runtime::block_on(async {
                let row: Option<(String,)> =
                    sqlx::query_as("SELECT value FROM settings WHERE key = 'download_path'")
                        .fetch_optional(&db)
                        .await
                        .ok()
                        .flatten();
                row.map(|r| r.0)
                    .unwrap_or_else(platform::default_download_path)
            });

            let download_engine =
                services::download_engine::DownloadEngine::new(3, download_path);

            // Load persisted download queue
            let engine_clone = download_engine.clone();
            let db_clone = db.clone();
            tauri::async_runtime::block_on(async {
                engine_clone.load_from_db(&db_clone).await;
            });

            // Seed default library roots for Bridge plugin and initialize indexer state.
            let db_for_seed = db.clone();
            let download_path_for_seed = std::path::PathBuf::from(
                tauri::async_runtime::block_on(async {
                    let row: Option<(String,)> =
                        sqlx::query_as("SELECT value FROM settings WHERE key = 'download_path'")
                            .fetch_optional(&db_for_seed)
                            .await
                            .ok()
                            .flatten();
                    row.map(|r| r.0)
                        .unwrap_or_else(platform::default_download_path)
                }),
            );
            tauri::async_runtime::block_on(async {
                if let Err(e) = services::sample_indexer::seed_default_roots(
                    &db_for_seed,
                    &download_path_for_seed,
                )
                .await
                {
                    log::warn!("seed_default_roots: {e}");
                }
            });
            let indexer_state = services::sample_indexer::IndexerState::new();

            // Manage state
            app.manage(api_client);
            app.manage(auth_service);
            app.manage(download_engine);
            app.manage(db);
            app.manage(indexer_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth::login,
            commands::auth::logout,
            commands::auth::get_session,
            commands::auth::register,
            commands::auth::get_auth_token,
            // Checkout
            commands::checkout::create_cart,
            commands::checkout::place_order,
            commands::checkout::confirm_3ds,
            // Store
            commands::store::get_store_products,
            commands::store_window::open_store_window,
            commands::store_window::close_store_window,
            commands::store_window::resize_store_window,
            // Products
            commands::products::sync_products,
            commands::products::sync_delta,
            commands::products::search_products,
            commands::products::get_product,
            commands::products::load_cached_products,
            commands::products::toggle_favorite,
            commands::products::get_favorite_ids,
            commands::products::get_downloaded_product_ids,
            // Plugins
            commands::plugins::scan_plugins,
            commands::plugins::check_plugin_compatibility,
            // Downloads
            commands::downloads::start_download,
            commands::downloads::pause_download,
            commands::downloads::resume_download,
            commands::downloads::cancel_download,
            commands::downloads::get_download_queue,
            commands::downloads::clear_download_history,
            // DAW
            commands::daw::detect_daws,
            commands::daw::get_daw_config,
            commands::daw::set_daw_path,
            commands::daw::get_placement_preview,
            // Settings
            commands::settings::get_settings,
            commands::settings::set_setting,
            commands::settings::get_download_path,
            commands::settings::set_download_path,
            commands::settings::reveal_in_finder,
            commands::settings::pick_folder,
            // Bridge library roots + indexer
            commands::library_roots::list_library_roots,
            commands::library_roots::add_library_root,
            commands::library_roots::remove_library_root,
            commands::library_roots::set_library_root_enabled,
            commands::library_roots::scan_library_roots,
            commands::library_roots::get_index_status,
        ])
        .run(tauri::generate_context!())
        .expect("Error running WMDM Desktop App");
}

