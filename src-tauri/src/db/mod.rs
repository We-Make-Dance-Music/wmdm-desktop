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
            raw_json TEXT NOT NULL DEFAULT '{}',
            is_welcome_gift INTEGER NOT NULL DEFAULT 0
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

    // Bridge plugin: sample library tables (see ~/.claude/plans/calm-squishing-frog.md).
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS library_roots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            kind TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            added_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Migration failed (library_roots): {e}"))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS sample_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            root_id INTEGER NOT NULL REFERENCES library_roots(id) ON DELETE CASCADE,
            rel_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            ext TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            mtime INTEGER NOT NULL,
            sha1 TEXT,
            product_id INTEGER,
            indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(root_id, rel_path)
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Migration failed (sample_files): {e}"))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS sample_tags (
            sample_id INTEGER PRIMARY KEY REFERENCES sample_files(id) ON DELETE CASCADE,
            duration_sec REAL,
            bpm REAL,
            bpm_confidence REAL,
            key_name TEXT,
            category TEXT,
            shape TEXT,
            ml_confidence REAL,
            tagged_at TEXT NOT NULL DEFAULT (datetime('now')),
            tagger_version TEXT
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Migration failed (sample_tags): {e}"))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sample_files_product ON sample_files(product_id);")
        .execute(pool)
        .await
        .map_err(|e| format!("Migration failed (idx product): {e}"))?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sample_files_ext ON sample_files(ext);")
        .execute(pool)
        .await
        .map_err(|e| format!("Migration failed (idx ext): {e}"))?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sample_tags_category ON sample_tags(category);")
        .execute(pool)
        .await
        .map_err(|e| format!("Migration failed (idx category): {e}"))?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sample_tags_bpm ON sample_tags(bpm);")
        .execute(pool)
        .await
        .map_err(|e| format!("Migration failed (idx bpm): {e}"))?;

    // Schema upgrades — add columns that may be missing from older installs.
    // ALTER TABLE ADD COLUMN is safe to call even if the column exists (SQLite ignores duplicates in some versions),
    // but we wrap in a helper that silently ignores "duplicate column" errors.
    add_column_if_missing(pool, "products", "waveform", "TEXT").await;
    add_column_if_missing(pool, "products", "file_size", "INTEGER").await;
    add_column_if_missing(pool, "products", "raw_json", "TEXT NOT NULL DEFAULT '{}'").await;
    add_column_if_missing(pool, "products", "is_welcome_gift", "INTEGER NOT NULL DEFAULT 0").await;
    add_column_if_missing(pool, "download_queue", "download_url", "TEXT").await;

    Ok(())
}

async fn add_column_if_missing(pool: &SqlitePool, table: &str, column: &str, col_type: &str) {
    let sql = format!("ALTER TABLE {table} ADD COLUMN {column} {col_type}");
    // Ignore error — it means the column already exists
    let _ = sqlx::query(&sql).execute(pool).await;
}
