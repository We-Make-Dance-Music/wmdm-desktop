use crate::services::file_placement;
use crate::DownloadItem;
use crate::DownloadStatus;
use futures::StreamExt;
use serde::Serialize;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;
use tokio::sync::{RwLock, Semaphore};
use tokio_util::sync::CancellationToken;

/// Events emitted to the frontend.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    pub id: String,
    pub progress: f64,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub speed: u64,
    pub eta: Option<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadCompleteEvent {
    pub id: String,
    pub output_path: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadErrorEvent {
    pub id: String,
    pub error: String,
}

/// Tracks an active download task.
struct ActiveTask {
    cancel_token: CancellationToken,
    download_url: String,
}

/// Manages concurrent downloads with pause/resume/cancel support.
#[derive(Clone)]
pub struct DownloadEngine {
    semaphore: Arc<Semaphore>,
    queue: Arc<RwLock<HashMap<String, DownloadItem>>>,
    active_tasks: Arc<RwLock<HashMap<String, ActiveTask>>>,
    download_dir: Arc<RwLock<String>>,
}

impl DownloadEngine {
    pub fn new(max_concurrent: u32, download_dir: String) -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(max_concurrent as usize)),
            queue: Arc::new(RwLock::new(HashMap::new())),
            active_tasks: Arc::new(RwLock::new(HashMap::new())),
            download_dir: Arc::new(RwLock::new(download_dir)),
        }
    }

    /// Add a download to the queue and start it.
    pub async fn enqueue(
        &self,
        id: String,
        product_id: u64,
        product_name: String,
        link_hash: String,
        file_name: String,
        download_url: String,
        total_bytes: u64,
        app_handle: AppHandle,
        db: SqlitePool,
    ) -> Result<DownloadItem, String> {
        let item = DownloadItem {
            id: id.clone(),
            product_id,
            product_name,
            link_hash: link_hash.clone(),
            file_name: file_name.clone(),
            status: DownloadStatus::Queued,
            progress: 0.0,
            bytes_downloaded: 0,
            total_bytes,
            speed: 0,
            eta: None,
            error: None,
            output_path: None,
            started_at: Some(chrono::Utc::now().to_rfc3339()),
            completed_at: None,
        };

        // Save to queue
        {
            let mut q = self.queue.write().await;
            q.insert(id.clone(), item.clone());
        }

        // Save to DB
        save_download_to_db(&db, &item).await.ok();

        // Spawn the download task
        let cancel_token = CancellationToken::new();
        {
            let mut tasks = self.active_tasks.write().await;
            tasks.insert(
                id.clone(),
                ActiveTask {
                    cancel_token: cancel_token.clone(),
                    download_url: download_url.clone(),
                },
            );
        }

        let engine = self.clone();
        let task_id = id.clone();
        let dest_dir = self.download_dir.read().await.clone();
        let task_product_id = product_id;

        tokio::spawn(async move {
            let _permit = engine.semaphore.acquire().await;
            engine
                .run_download(
                    task_id,
                    download_url,
                    file_name,
                    dest_dir,
                    cancel_token,
                    app_handle,
                    db,
                    0, // start from beginning
                    task_product_id,
                )
                .await;
        });

        Ok(item)
    }

    async fn run_download(
        &self,
        id: String,
        url: String,
        file_name: String,
        dest_dir: String,
        cancel_token: CancellationToken,
        app_handle: AppHandle,
        db: SqlitePool,
        resume_from: u64,
        product_id: u64,
    ) {
        let max_retries = 3u32;
        let mut attempt = 0u32;

        loop {
            attempt += 1;
            match self
                .do_download(
                    &id,
                    &url,
                    &file_name,
                    &dest_dir,
                    &cancel_token,
                    &app_handle,
                    &db,
                    resume_from,
                )
                .await
            {
                Ok(zip_path) => {
                    // --- Extract ZIP and place files in DAW folders ---
                    {
                        let mut q = self.queue.write().await;
                        if let Some(item) = q.get_mut(&id) {
                            item.status = DownloadStatus::Extracting;
                        }
                    }
                    let _ = update_download_status(&db, &id, "extracting", None).await;

                    // Look up product from DB for placement decisions
                    let product = crate::services::product_sync::get_product(&db, product_id).await.ok();
                    let daw_config = crate::services::daw_detector::detect();

                    let output_path = if zip_path.ends_with(".zip") {
                        if let Some(ref prod) = product {
                            match file_placement::place_files(&zip_path, prod, &daw_config, &dest_dir).await {
                                Ok(placed) => {
                                    // Find the most relevant folder to show user:
                                    // Prefer Samples > Templates > first file's parent
                                    let samples_path = placed.iter()
                                        .find(|f| f.file_type == "Audio Sample")
                                        .and_then(|f| std::path::Path::new(&f.destination_path).parent())
                                        .map(|p| p.to_string_lossy().to_string());

                                    let template_path = placed.iter()
                                        .find(|f| f.file_type.contains("Project"))
                                        .and_then(|f| std::path::Path::new(&f.destination_path).parent())
                                        .map(|p| p.to_string_lossy().to_string());

                                    let first_parent = placed.first()
                                        .and_then(|f| std::path::Path::new(&f.destination_path).parent())
                                        .map(|p| p.to_string_lossy().to_string());

                                    samples_path
                                        .or(template_path)
                                        .or(first_parent)
                                        .unwrap_or_else(|| dest_dir.clone())
                                }
                                Err(e) => {
                                    log::warn!("File placement failed, keeping ZIP: {e}");
                                    zip_path.clone()
                                }
                            }
                        } else {
                            zip_path.clone()
                        }
                    } else {
                        zip_path.clone()
                    };

                    // Update queue entry as complete
                    {
                        let mut q = self.queue.write().await;
                        if let Some(item) = q.get_mut(&id) {
                            item.status = DownloadStatus::Complete;
                            item.progress = 100.0;
                            item.output_path = Some(output_path.clone());
                            item.completed_at = Some(chrono::Utc::now().to_rfc3339());
                        }
                    }

                    let _ = update_download_status(&db, &id, "complete", None).await;

                    let _ = app_handle.emit(
                        "download-complete",
                        DownloadCompleteEvent {
                            id: id.clone(),
                            output_path,
                        },
                    );
                    break;
                }
                Err(e) => {
                    if cancel_token.is_cancelled() {
                        // Paused or cancelled — don't retry
                        break;
                    }

                    if attempt >= max_retries {
                        // Final failure
                        {
                            let mut q = self.queue.write().await;
                            if let Some(item) = q.get_mut(&id) {
                                item.status = DownloadStatus::Error;
                                item.error = Some(e.clone());
                            }
                        }

                        let _ = update_download_status(&db, &id, "error", Some(&e)).await;

                        let _ = app_handle.emit(
                            "download-error",
                            DownloadErrorEvent {
                                id: id.clone(),
                                error: e,
                            },
                        );
                        break;
                    }

                    // Exponential backoff
                    let delay = std::time::Duration::from_secs(2u64.pow(attempt));
                    tokio::time::sleep(delay).await;
                }
            }
        }

        // Clean up active task
        {
            let mut tasks = self.active_tasks.write().await;
            tasks.remove(&id);
        }
    }

    async fn do_download(
        &self,
        id: &str,
        url: &str,
        file_name: &str,
        dest_dir: &str,
        cancel_token: &CancellationToken,
        app_handle: &AppHandle,
        db: &SqlitePool,
        resume_from: u64,
    ) -> Result<String, String> {
        // Update status to downloading
        {
            let mut q = self.queue.write().await;
            if let Some(item) = q.get_mut(id) {
                item.status = DownloadStatus::Downloading;
            }
        }
        let _ = update_download_status(db, id, "downloading", None).await;

        // Create dest directory
        let dest_path = PathBuf::from(dest_dir);
        tokio::fs::create_dir_all(&dest_path)
            .await
            .map_err(|e| format!("Failed to create download dir: {e}"))?;

        let part_path = dest_path.join(format!("{file_name}.part"));
        let final_path = dest_path.join(file_name);

        // Build the HTTP client for streaming
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .map_err(|e| format!("Client build error: {e}"))?;

        let mut request = client.get(url);
        if resume_from > 0 {
            request = request.header("Range", format!("bytes={resume_from}-"));
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("Download request failed: {e}"))?;

        if !response.status().is_success()
            && response.status() != reqwest::StatusCode::PARTIAL_CONTENT
        {
            return Err(format!("Download failed: HTTP {}", response.status()));
        }

        let total_bytes = if resume_from > 0 {
            response
                .content_length()
                .map(|cl| cl + resume_from)
                .unwrap_or(0)
        } else {
            response.content_length().unwrap_or(0)
        };

        // Open file for writing (append if resuming)
        let file = if resume_from > 0 {
            tokio::fs::OpenOptions::new()
                .append(true)
                .open(&part_path)
                .await
                .map_err(|e| format!("Failed to open part file: {e}"))?
        } else {
            tokio::fs::File::create(&part_path)
                .await
                .map_err(|e| format!("Failed to create part file: {e}"))?
        };

        let mut writer = tokio::io::BufWriter::new(file);
        let mut stream = response.bytes_stream();
        let mut bytes_downloaded = resume_from;
        let mut last_emit = Instant::now();
        let start_time = Instant::now();

        while let Some(chunk_result) = stream.next().await {
            // Check for cancellation
            if cancel_token.is_cancelled() {
                writer.flush().await.ok();
                return Err("Cancelled".into());
            }

            let chunk = chunk_result.map_err(|e| format!("Stream error: {e}"))?;
            writer
                .write_all(&chunk)
                .await
                .map_err(|e| format!("Write error: {e}"))?;

            bytes_downloaded += chunk.len() as u64;

            // Throttle progress events to every 200ms
            if last_emit.elapsed().as_millis() >= 200 {
                last_emit = Instant::now();

                let progress = if total_bytes > 0 {
                    (bytes_downloaded as f64 / total_bytes as f64) * 100.0
                } else {
                    0.0
                };

                let elapsed_secs = start_time.elapsed().as_secs_f64();
                let speed = if elapsed_secs > 0.0 {
                    ((bytes_downloaded - resume_from) as f64 / elapsed_secs) as u64
                } else {
                    0
                };

                let eta = if speed > 0 && total_bytes > bytes_downloaded {
                    Some((total_bytes - bytes_downloaded) / speed)
                } else {
                    None
                };

                // Update queue
                {
                    let mut q = self.queue.write().await;
                    if let Some(item) = q.get_mut(id) {
                        item.progress = progress;
                        item.bytes_downloaded = bytes_downloaded;
                        item.total_bytes = total_bytes;
                        item.speed = speed;
                        item.eta = eta;
                    }
                }

                let _ = app_handle.emit(
                    "download-progress",
                    DownloadProgressEvent {
                        id: id.to_string(),
                        progress,
                        bytes_downloaded,
                        total_bytes,
                        speed,
                        eta,
                    },
                );
            }
        }

        writer.flush().await.map_err(|e| format!("Flush error: {e}"))?;
        drop(writer);

        // Rename .part file to final
        tokio::fs::rename(&part_path, &final_path)
            .await
            .map_err(|e| format!("Failed to rename file: {e}"))?;

        Ok(final_path.to_string_lossy().to_string())
    }

    /// Pause an active download.
    pub async fn pause(&self, id: &str) -> Result<(), String> {
        let cancel_token = {
            let tasks = self.active_tasks.read().await;
            tasks
                .get(id)
                .map(|t| t.cancel_token.clone())
                .ok_or_else(|| "Download not active".to_string())?
        };
        cancel_token.cancel();

        {
            let mut q = self.queue.write().await;
            if let Some(item) = q.get_mut(id) {
                item.status = DownloadStatus::Paused;
                item.speed = 0;
            }
        }
        Ok(())
    }

    /// Resume a paused download.
    pub async fn resume(
        &self,
        id: &str,
        app_handle: AppHandle,
        db: SqlitePool,
    ) -> Result<(), String> {
        let (item, download_url) = {
            let q = self.queue.read().await;
            let item = q.get(id).ok_or("Download not found")?.clone();

            let tasks = self.active_tasks.read().await;
            let url = tasks
                .get(id)
                .map(|t| t.download_url.clone())
                .unwrap_or_default();
            (item, url)
        };

        // If we don't have the URL from active tasks, try the DB
        let download_url = if download_url.is_empty() {
            get_download_url_from_db(&db, id).await.unwrap_or_default()
        } else {
            download_url
        };

        if download_url.is_empty() {
            return Err("No download URL available for resume".to_string());
        }

        let cancel_token = CancellationToken::new();
        {
            let mut tasks = self.active_tasks.write().await;
            tasks.insert(
                id.to_string(),
                ActiveTask {
                    cancel_token: cancel_token.clone(),
                    download_url: download_url.clone(),
                },
            );
        }

        let engine = self.clone();
        let task_id = id.to_string();
        let file_name = item.file_name.clone();
        let dest_dir = self.download_dir.read().await.clone();
        let resume_from = item.bytes_downloaded;
        let resume_product_id = item.product_id;

        tokio::spawn(async move {
            let _permit = engine.semaphore.acquire().await;
            engine
                .run_download(
                    task_id,
                    download_url,
                    file_name,
                    dest_dir,
                    cancel_token,
                    app_handle,
                    db,
                    resume_from,
                    resume_product_id,
                )
                .await;
        });

        Ok(())
    }

    /// Cancel a download and remove it from the queue.
    pub async fn cancel(&self, id: &str) -> Result<(), String> {
        // Cancel active task if running
        {
            let tasks = self.active_tasks.read().await;
            if let Some(task) = tasks.get(id) {
                task.cancel_token.cancel();
            }
        }

        // Remove from queue
        {
            let mut q = self.queue.write().await;
            q.remove(id);
        }

        Ok(())
    }

    /// Get all items in the download queue.
    pub async fn get_queue(&self) -> Vec<DownloadItem> {
        let q = self.queue.read().await;
        q.values().cloned().collect()
    }

    /// Load persisted queue from DB on startup.
    pub async fn load_from_db(&self, db: &SqlitePool) {
        let rows = sqlx::query_as::<_, DownloadRow>(
            "SELECT id, product_id, product_name, link_hash, file_name, status, progress, \
             bytes_downloaded, total_bytes, speed, error, output_path, started_at, completed_at \
             FROM download_queue WHERE status NOT IN ('complete', 'error')",
        )
        .fetch_all(db)
        .await;

        if let Ok(rows) = rows {
            let mut q = self.queue.write().await;
            for row in rows {
                let item = DownloadItem {
                    id: row.id.clone(),
                    product_id: row.product_id as u64,
                    product_name: row.product_name,
                    link_hash: row.link_hash,
                    file_name: row.file_name,
                    status: parse_status(&row.status),
                    progress: row.progress,
                    bytes_downloaded: row.bytes_downloaded as u64,
                    total_bytes: row.total_bytes as u64,
                    speed: 0,
                    eta: None,
                    error: row.error,
                    output_path: row.output_path,
                    started_at: row.started_at,
                    completed_at: row.completed_at,
                };
                q.insert(row.id, item);
            }
        }
    }
}

#[derive(sqlx::FromRow)]
struct DownloadRow {
    id: String,
    product_id: i64,
    product_name: String,
    link_hash: String,
    file_name: String,
    status: String,
    progress: f64,
    bytes_downloaded: i64,
    total_bytes: i64,
    #[allow(dead_code)]
    speed: i64,
    error: Option<String>,
    output_path: Option<String>,
    started_at: Option<String>,
    completed_at: Option<String>,
}

fn parse_status(s: &str) -> DownloadStatus {
    match s {
        "queued" => DownloadStatus::Queued,
        "downloading" => DownloadStatus::Downloading,
        "paused" => DownloadStatus::Paused,
        "extracting" => DownloadStatus::Extracting,
        "placing" => DownloadStatus::Placing,
        "complete" => DownloadStatus::Complete,
        "error" => DownloadStatus::Error,
        _ => DownloadStatus::Queued,
    }
}

async fn save_download_to_db(db: &SqlitePool, item: &DownloadItem) -> Result<(), String> {
    let status_str = status_to_str(&item.status);
    sqlx::query(
        "INSERT OR REPLACE INTO download_queue \
         (id, product_id, product_name, link_hash, file_name, status, progress, \
          bytes_downloaded, total_bytes, speed, error, output_path, started_at, completed_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&item.id)
    .bind(item.product_id as i64)
    .bind(&item.product_name)
    .bind(&item.link_hash)
    .bind(&item.file_name)
    .bind(status_str)
    .bind(item.progress)
    .bind(item.bytes_downloaded as i64)
    .bind(item.total_bytes as i64)
    .bind(item.speed as i64)
    .bind(&item.error)
    .bind(&item.output_path)
    .bind(&item.started_at)
    .bind(&item.completed_at)
    .execute(db)
    .await
    .map_err(|e| format!("DB error: {e}"))?;
    Ok(())
}

async fn update_download_status(
    db: &SqlitePool,
    id: &str,
    status: &str,
    error: Option<&str>,
) -> Result<(), String> {
    sqlx::query("UPDATE download_queue SET status = ?, error = ? WHERE id = ?")
        .bind(status)
        .bind(error)
        .bind(id)
        .execute(db)
        .await
        .map_err(|e| format!("DB error: {e}"))?;
    Ok(())
}

async fn get_download_url_from_db(db: &SqlitePool, id: &str) -> Result<String, String> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT download_url FROM download_queue WHERE id = ?")
            .bind(id)
            .fetch_optional(db)
            .await
            .map_err(|e| format!("DB error: {e}"))?;
    Ok(row.map(|r| r.0).unwrap_or_default())
}

fn status_to_str(s: &DownloadStatus) -> &'static str {
    match s {
        DownloadStatus::Queued => "queued",
        DownloadStatus::Downloading => "downloading",
        DownloadStatus::Paused => "paused",
        DownloadStatus::Extracting => "extracting",
        DownloadStatus::Placing => "placing",
        DownloadStatus::Complete => "complete",
        DownloadStatus::Error => "error",
    }
}
