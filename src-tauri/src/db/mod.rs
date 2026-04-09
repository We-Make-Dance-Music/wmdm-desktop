use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::str::FromStr;

/// Initialize the SQLite database pool and run migrations.
pub async fn init(app_data_dir: &Path) -> Result<SqlitePool, String> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {e}"))?;

    let db_path = app_data_dir.join("wmdm.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());

    let options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| format!("Invalid DB URL: {e}"))?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(|e| format!("Failed to connect to DB: {e}"))?;

    run_migrations(&pool).await?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY,
            sku TEXT NOT NULL,
            name TEXT NOT NULL,
            format_type TEXT NOT NULL DEFAULT 'other',
            daws TEXT NOT NULL DEFAULT '[]',
            genres TEXT NOT NULL DEFAULT '[]',
            bpm INTEGER,
            key_sig TEXT,
            creator_id INTEGER,
            creator_name TEXT,
            creator_avatar_url TEXT,
            thumbnail_url TEXT,
            stream_url TEXT,
            waveform TEXT,
            download_links TEXT NOT NULL DEFAULT '[]',
            purchased_at TEXT NOT NULL DEFAULT '',
            file_size INTEGER,
            raw_json TEXT NOT NULL DEFAULT '{}'
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Migration failed (products): {e}"))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS download_queue (
            id TEXT PRIMARY KEY,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            link_hash TEXT NOT NULL,
            file_name TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'queued',
            progress REAL NOT NULL DEFAULT 0.0,
            bytes_downloaded INTEGER NOT NULL DEFAULT 0,
            total_bytes INTEGER NOT NULL DEFAULT 0,
            speed INTEGER NOT NULL DEFAULT 0,
            error TEXT,
            output_path TEXT,
            started_at TEXT,
            completed_at TEXT,
            download_url TEXT
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Migration failed (download_queue): {e}"))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS placed_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            download_id TEXT NOT NULL,
            product_id INTEGER NOT NULL,
            source_name TEXT NOT NULL,
            dest_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            placed_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Migration failed (placed_files): {e}"))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS favorites (
            product_id INTEGER PRIMARY KEY,
            added_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Migration failed (favorites): {e}"))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Migration failed (settings): {e}"))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS daw_config (
            daw_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            detected INTEGER NOT NULL DEFAULT 0,
            install_path TEXT,
            content_path TEXT,
            version TEXT
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Migration failed (daw_config): {e}"))?;

    Ok(())
}
