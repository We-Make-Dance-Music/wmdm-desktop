// Bridge plugin: sample library indexer.
// Scans library_roots for audio files, computes lightweight tags (duration, BPM,
// filename-based category, duration-based shape), writes to sample_files + sample_tags.
// See ~/.claude/plans/calm-squishing-frog.md.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};
use tokio::sync::{Mutex, Semaphore};
use walkdir::WalkDir;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

const AUDIO_EXTS: &[&str] = &["wav", "aiff", "aif", "flac", "mp3", "ogg", "m4a"];
const TAGGER_VERSION: &str = "heuristic-key-1";
const TAG_CONCURRENCY: usize = 3;
const MAX_DECODE_SECONDS: f32 = 30.0; // cap long files — enough for BPM
const PROGRESS_EVENT: &str = "sample_index_progress";

// ─── Public types ─────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    pub scanning: bool,
    pub total_files: i64,
    pub tagged_files: i64,
    pub current_file: Option<String>,
}

impl Default for IndexStatus {
    fn default() -> Self {
        Self {
            scanning: false,
            total_files: 0,
            tagged_files: 0,
            current_file: None,
        }
    }
}

#[derive(Default)]
pub struct IndexerState {
    pub status: Mutex<IndexStatus>,
}

impl IndexerState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }
}

// ─── Seeding ──────────────────────────────────────────────────

/// Insert default library roots (if they don't exist) on first run.
/// Kinds: wmdm_samples, wmdm_stems, daw_logic, daw_ableton, daw_flstudio, user.
pub async fn seed_default_roots(pool: &SqlitePool, download_path: &Path) -> Result<(), String> {
    let home = dirs::home_dir().unwrap_or_default();
    let docs = dirs::document_dir().unwrap_or_else(|| home.join("Documents"));

    let mut seeds: Vec<(PathBuf, &'static str)> = vec![
        (download_path.join("Samples"), "wmdm_samples"),
        (download_path.join("Stems"), "wmdm_stems"),
    ];

    #[cfg(target_os = "macos")]
    {
        seeds.push((home.join("Music/Audio Music Apps/Samples"), "daw_logic"));
        seeds.push((home.join("Music/Ableton/User Library/Samples"), "daw_ableton"));
        seeds.push((docs.join("Image-Line/FL Studio/Data/Packs"), "daw_flstudio"));
    }
    #[cfg(target_os = "windows")]
    {
        seeds.push((docs.join("Ableton/User Library/Samples"), "daw_ableton"));
        seeds.push((docs.join("Image-Line/FL Studio/Data/Packs"), "daw_flstudio"));
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (home, docs);
    }

    for (path, kind) in seeds {
        let path_str = path.to_string_lossy().to_string();
        sqlx::query("INSERT OR IGNORE INTO library_roots (path, kind) VALUES (?, ?)")
            .bind(&path_str)
            .bind(kind)
            .execute(pool)
            .await
            .map_err(|e| format!("seed_default_roots: {e}"))?;
    }
    Ok(())
}

// ─── Scanning ─────────────────────────────────────────────────

struct FileRow {
    root_id: i64,
    root_path: PathBuf,
    rel_path: String,
    file_name: String,
    ext: String,
    size_bytes: i64,
    mtime: i64,
}

/// Walk every enabled library root, insert/update sample_files rows.
/// Returns the number of new or changed files that need tagging.
pub async fn scan_all_roots(
    pool: &SqlitePool,
    state: Arc<IndexerState>,
    app: &AppHandle,
) -> Result<i64, String> {
    {
        let mut s = state.status.lock().await;
        s.scanning = true;
        s.current_file = Some("Discovering files…".into());
        let _ = app.emit(PROGRESS_EVENT, s.clone());
    }

    let roots: Vec<(i64, String)> =
        sqlx::query_as("SELECT id, path FROM library_roots WHERE enabled = 1")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("scan_all_roots (list roots): {e}"))?;

    let mut discovered: Vec<FileRow> = Vec::new();
    for (root_id, root_path_str) in roots {
        let root_path = PathBuf::from(&root_path_str);
        if !root_path.exists() {
            continue;
        }
        for entry in WalkDir::new(&root_path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            let path = entry.path();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_ascii_lowercase())
                .unwrap_or_default();
            if !AUDIO_EXTS.contains(&ext.as_str()) {
                continue;
            }
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let size_bytes = meta.len() as i64;
            let mtime = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            let rel_path = path
                .strip_prefix(&root_path)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();
            let file_name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            discovered.push(FileRow {
                root_id,
                root_path: root_path.clone(),
                rel_path,
                file_name,
                ext: ext.clone(),
                size_bytes,
                mtime,
            });
        }
    }

    let mut new_or_changed: i64 = 0;
    for row in &discovered {
        let existing: Option<(i64, i64, i64)> = sqlx::query_as(
            "SELECT id, size_bytes, mtime FROM sample_files WHERE root_id = ? AND rel_path = ?",
        )
        .bind(row.root_id)
        .bind(&row.rel_path)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("scan_all_roots (lookup): {e}"))?;

        match existing {
            Some((_id, size, mt)) if size == row.size_bytes && mt == row.mtime => {
                // Unchanged; skip.
            }
            Some((id, _, _)) => {
                // Changed — update row and clear tags to force re-tag.
                sqlx::query(
                    "UPDATE sample_files SET size_bytes = ?, mtime = ? WHERE id = ?",
                )
                .bind(row.size_bytes)
                .bind(row.mtime)
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| format!("scan_all_roots (update): {e}"))?;
                sqlx::query("DELETE FROM sample_tags WHERE sample_id = ?")
                    .bind(id)
                    .execute(pool)
                    .await
                    .ok();
                new_or_changed += 1;
            }
            None => {
                sqlx::query(
                    "INSERT INTO sample_files (root_id, rel_path, file_name, ext, size_bytes, mtime)
                     VALUES (?, ?, ?, ?, ?, ?)",
                )
                .bind(row.root_id)
                .bind(&row.rel_path)
                .bind(&row.file_name)
                .bind(&row.ext)
                .bind(row.size_bytes)
                .bind(row.mtime)
                .execute(pool)
                .await
                .map_err(|e| format!("scan_all_roots (insert): {e}"))?;
                new_or_changed += 1;
            }
        }
    }

    {
        let mut s = state.status.lock().await;
        s.total_files = discovered.len() as i64;
        s.current_file = Some(format!(
            "Scan complete — {} files discovered, {} need tagging",
            discovered.len(),
            new_or_changed
        ));
        let _ = app.emit(PROGRESS_EVENT, s.clone());
    }

    Ok(new_or_changed)
}

// ─── Tagging ──────────────────────────────────────────────────

/// Tag every sample_file that doesn't yet have a row in sample_tags.
pub async fn tag_pending(
    pool: &SqlitePool,
    state: Arc<IndexerState>,
    app: &AppHandle,
) -> Result<(), String> {
    let pending: Vec<(i64, String, String)> = sqlx::query_as(
        "SELECT sf.id, lr.path, sf.rel_path
         FROM sample_files sf
         JOIN library_roots lr ON lr.id = sf.root_id
         LEFT JOIN sample_tags st ON st.sample_id = sf.id
         WHERE st.sample_id IS NULL
         ORDER BY sf.id",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("tag_pending (select): {e}"))?;

    let total = pending.len() as i64;
    let done_counter = Arc::new(Mutex::new(0i64));
    let sem = Arc::new(Semaphore::new(TAG_CONCURRENCY));
    let mut handles = Vec::new();

    for (id, root_path, rel_path) in pending {
        let permit = sem.clone().acquire_owned().await.unwrap();
        let pool = pool.clone();
        let state = state.clone();
        let app = app.clone();
        let counter = done_counter.clone();
        let handle = tokio::spawn(async move {
            let full_path = PathBuf::from(&root_path).join(&rel_path);
            let file_name = full_path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let analysis = tokio::task::spawn_blocking(move || analyze_file(&full_path))
                .await
                .unwrap_or_else(|_| Err("join error".into()));

            let (duration, bpm, bpm_conf, key_name, category, shape) = match analysis {
                Ok(a) => (
                    Some(a.duration_sec),
                    a.bpm,
                    a.bpm_confidence,
                    a.key_name,
                    a.category,
                    a.shape,
                ),
                Err(_) => {
                    // Fallback: filename-based category, unknown audio properties.
                    (
                        None,
                        None,
                        0.0,
                        None,
                        classify_by_filename(&file_name).map(String::from),
                        "phrase".to_string(),
                    )
                }
            };

            let _ = sqlx::query(
                "INSERT OR REPLACE INTO sample_tags
                 (sample_id, duration_sec, bpm, bpm_confidence, key_name, category, shape, tagged_at, tagger_version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)",
            )
            .bind(id)
            .bind(duration)
            .bind(bpm)
            .bind(bpm_conf)
            .bind(key_name)
            .bind(category)
            .bind(shape)
            .bind(TAGGER_VERSION)
            .execute(&pool)
            .await;

            let mut c = counter.lock().await;
            *c += 1;
            let done = *c;
            drop(c);

            let mut s = state.status.lock().await;
            s.tagged_files = done;
            s.current_file = Some(file_name);
            let _ = app.emit(PROGRESS_EVENT, s.clone());

            drop(permit);
        });
        handles.push(handle);
    }

    for h in handles {
        let _ = h.await;
    }

    {
        let mut s = state.status.lock().await;
        s.scanning = false;
        s.tagged_files = total;
        s.current_file = Some(format!("Tagging complete — {total} files"));
        let _ = app.emit(PROGRESS_EVENT, s.clone());
    }

    Ok(())
}

// ─── Analysis ────────────────────────────────────────────────

struct Analysis {
    duration_sec: f32,
    bpm: Option<f32>,
    bpm_confidence: f32,
    key_name: Option<String>,
    category: Option<String>,
    shape: String,
}

fn analyze_file(path: &Path) -> Result<Analysis, String> {
    let (samples, sample_rate, duration_sec) = decode_mono(path)?;
    let (bpm, bpm_confidence) = detect_bpm(&samples, sample_rate);
    let key_name = detect_key(&samples, sample_rate);
    let category = classify_by_filename(
        path.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(""),
    )
    .map(String::from);
    let shape = classify_shape(duration_sec, bpm).to_string();
    Ok(Analysis {
        duration_sec,
        bpm,
        bpm_confidence,
        key_name,
        category,
        shape,
    })
}

/// Decode an audio file to mono f32. Caps the return buffer at MAX_DECODE_SECONDS
/// (the BPM estimator only needs a few seconds; avoids OOM on 20-minute stems).
fn decode_mono(path: &Path) -> Result<(Vec<f32>, u32, f32), String> {
    let file = std::fs::File::open(path).map_err(|e| format!("open {}: {e}", path.display()))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("probe: {e}"))?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| "no default track".to_string())?;
    let track_id = track.id;
    let codec_params = track.codec_params.clone();
    let channels = codec_params
        .channels
        .ok_or_else(|| "no channels".to_string())?
        .count();
    let sample_rate = codec_params
        .sample_rate
        .ok_or_else(|| "no sample rate".to_string())?;

    // Duration from timestamp.
    let duration_sec = codec_params
        .n_frames
        .map(|n| n as f32 / sample_rate as f32)
        .unwrap_or(0.0);

    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|e| format!("make decoder: {e}"))?;

    let max_samples = (MAX_DECODE_SECONDS * sample_rate as f32) as usize;
    let mut mono: Vec<f32> = Vec::with_capacity(max_samples.min(sample_rate as usize * 4));
    let mut sample_buf: Option<SampleBuffer<f32>> = None;

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(e) => return Err(format!("next_packet: {e}")),
        };
        if packet.track_id() != track_id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(e) => return Err(format!("decode: {e}")),
        };
        if sample_buf.is_none() {
            sample_buf = Some(SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec()));
        }
        let sb = sample_buf.as_mut().unwrap();
        sb.copy_interleaved_ref(decoded);
        let ch = channels.max(1);
        for frame in sb.samples().chunks(ch) {
            let sum: f32 = frame.iter().sum();
            mono.push(sum / ch as f32);
            if mono.len() >= max_samples {
                return Ok((mono, sample_rate, duration_sec));
            }
        }
    }

    let actual_dur = if duration_sec > 0.0 {
        duration_sec
    } else {
        mono.len() as f32 / sample_rate as f32
    };
    Ok((mono, sample_rate, actual_dur))
}

/// Simple BPM estimator: RMS envelope → autocorrelation → peak in 70–180 BPM range.
/// Returns (bpm, confidence) where confidence ∈ [0, 1].
fn detect_bpm(samples: &[f32], sample_rate: u32) -> (Option<f32>, f32) {
    if samples.len() < sample_rate as usize {
        return (None, 0.0);
    }
    // Envelope with 10ms frames (hop=441 at 44100).
    let hop = (sample_rate as usize) / 100; // 10ms
    if hop == 0 {
        return (None, 0.0);
    }
    let mut env: Vec<f32> = Vec::with_capacity(samples.len() / hop);
    for chunk in samples.chunks(hop) {
        let mut sum_sq = 0.0f32;
        for &x in chunk {
            sum_sq += x * x;
        }
        env.push((sum_sq / chunk.len() as f32).sqrt());
    }
    if env.len() < 100 {
        return (None, 0.0);
    }

    // Onset: half-wave-rectified diff.
    let mut onset: Vec<f32> = Vec::with_capacity(env.len());
    let mut prev = env[0];
    for &e in env.iter().skip(1) {
        let d = e - prev;
        onset.push(if d > 0.0 { d } else { 0.0 });
        prev = e;
    }
    let onset_max = onset.iter().cloned().fold(0.0f32, f32::max);
    if onset_max < 1e-6 {
        return (None, 0.0);
    }
    // Require repeated onsets before we try BPM — a single attack on a
    // sustained tone gives misleading autocorrelation peaks.
    // Count onsets that exceed 30% of max.
    let strong_onsets = onset.iter().filter(|&&v| v > 0.3 * onset_max).count();
    if strong_onsets < 4 {
        return (None, 0.0);
    }
    for v in onset.iter_mut() {
        *v /= onset_max;
    }

    // Autocorrelation over candidate lags.
    // Envelope rate = sample_rate / hop = 100 Hz.
    // BPM -> lag: lag = 60 * env_rate / bpm.
    let env_rate = sample_rate as f32 / hop as f32;
    let mut best_bpm = 0.0f32;
    let mut best_score = 0.0f32;
    let mut total_score = 0.0f32;
    let mut samples_n = 0;
    for bpm in 70..=180 {
        let lag = (60.0 * env_rate / bpm as f32).round() as usize;
        if lag == 0 || lag >= onset.len() / 2 {
            continue;
        }
        let mut s = 0.0f32;
        for i in 0..(onset.len() - lag) {
            s += onset[i] * onset[i + lag];
        }
        s /= (onset.len() - lag) as f32;
        total_score += s;
        samples_n += 1;
        if s > best_score {
            best_score = s;
            best_bpm = bpm as f32;
        }
    }
    if best_bpm == 0.0 || samples_n == 0 {
        return (None, 0.0);
    }
    let mean_score = total_score / samples_n as f32;
    // Confidence: peak-to-mean ratio, tightened with a stricter floor.
    let ratio = if mean_score > 0.0 {
        best_score / mean_score
    } else {
        0.0
    };
    // Require the best lag to beat the average by at least 30% — otherwise
    // it's likely a sustained tonal signal with no real tempo.
    if ratio < 1.3 {
        return (None, 0.0);
    }
    let confidence = ((ratio - 1.3) / 0.7).clamp(0.0, 1.0);
    (Some(best_bpm), confidence)
}

/// First-pass category classifier based on filename tokens.
fn classify_by_filename(name: &str) -> Option<&'static str> {
    let n = name.to_ascii_lowercase();
    let drum_tokens = [
        "kick", "snare", "hat", "clap", "cymbal", "perc", "tom", "drum", "rim", "ride",
        "crash", "808", "909", "707", "break",
    ];
    let vocal_tokens = ["vox", "vocal", "acapella", "acap", "adlib", "phrase_voc", "chant"];
    let bass_tokens = ["bass", "sub", "bassline", "808_bass", "reese"];
    let synth_tokens = ["synth", "lead", "pad", "pluck", "chord", "arp", "keys", "piano"];
    let fx_tokens = ["fx", "riser", "impact", "downlifter", "uplifter", "sweep", "whoosh", "sfx", "noise", "atmos"];

    for t in drum_tokens.iter() {
        if n.contains(t) {
            return Some("drum");
        }
    }
    for t in vocal_tokens.iter() {
        if n.contains(t) {
            return Some("vocal");
        }
    }
    for t in bass_tokens.iter() {
        if n.contains(t) {
            return Some("bass");
        }
    }
    for t in synth_tokens.iter() {
        if n.contains(t) {
            return Some("synth");
        }
    }
    for t in fx_tokens.iter() {
        if n.contains(t) {
            return Some("fx");
        }
    }
    None
}

/// Key detection via Krumhansl-Schmuckler profile correlation on a chromagram.
/// Returns "Cm", "F#", etc. (None if signal too weak/atonal).
fn detect_key(samples: &[f32], sample_rate: u32) -> Option<String> {
    use rustfft::{num_complex::Complex, FftPlanner};

    if samples.len() < (sample_rate as usize) {
        return None;
    }
    const FFT_SIZE: usize = 4096;
    const HOP: usize = 2048;
    if samples.len() < FFT_SIZE {
        return None;
    }

    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(FFT_SIZE);

    // Hann window.
    let hann: Vec<f32> = (0..FFT_SIZE)
        .map(|i| {
            0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / FFT_SIZE as f32).cos()
        })
        .collect();

    let mut chroma = [0.0f32; 12];
    let mut buf: Vec<Complex<f32>> = vec![Complex::new(0.0, 0.0); FFT_SIZE];
    let bin_freq = sample_rate as f32 / FFT_SIZE as f32;

    let mut frames = 0usize;
    let mut pos = 0usize;
    while pos + FFT_SIZE <= samples.len() {
        for i in 0..FFT_SIZE {
            buf[i] = Complex::new(samples[pos + i] * hann[i], 0.0);
        }
        fft.process(&mut buf);
        for k in 1..(FFT_SIZE / 2) {
            let freq = k as f32 * bin_freq;
            if freq < 65.0 || freq > 5000.0 {
                continue;
            }
            let mag = buf[k].norm();
            // MIDI note number from frequency, 69 = A4.
            let n = 12.0 * (freq / 440.0).log2() + 69.0;
            let pc = (n.round() as i32).rem_euclid(12) as usize;
            chroma[pc] += mag;
        }
        pos += HOP;
        frames += 1;
    }
    if frames == 0 {
        return None;
    }

    // Krumhansl-Schmuckler key profiles (relative to tonic).
    const MAJOR: [f32; 12] = [
        6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
    ];
    const MINOR: [f32; 12] = [
        6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
    ];
    const NAMES: [&str; 12] = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];

    fn pearson(a: &[f32; 12], b: &[f32; 12]) -> f32 {
        let mean_a: f32 = a.iter().sum::<f32>() / 12.0;
        let mean_b: f32 = b.iter().sum::<f32>() / 12.0;
        let (mut num, mut da, mut db) = (0.0f32, 0.0f32, 0.0f32);
        for i in 0..12 {
            let xa = a[i] - mean_a;
            let xb = b[i] - mean_b;
            num += xa * xb;
            da += xa * xa;
            db += xb * xb;
        }
        if da < 1e-9 || db < 1e-9 {
            0.0
        } else {
            num / (da.sqrt() * db.sqrt())
        }
    }

    let mut best_corr = -2.0f32;
    let mut best_key = String::new();
    for tonic in 0..12 {
        let mut shifted = [0.0f32; 12];
        // Rotate profile so the tonic sits at chromagram index `tonic`.
        for i in 0..12 {
            shifted[i] = MAJOR[(i + 12 - tonic) % 12];
        }
        let c = pearson(&chroma, &shifted);
        if c > best_corr {
            best_corr = c;
            best_key = NAMES[tonic].to_string();
        }
        for i in 0..12 {
            shifted[i] = MINOR[(i + 12 - tonic) % 12];
        }
        let c = pearson(&chroma, &shifted);
        if c > best_corr {
            best_corr = c;
            best_key = format!("{}m", NAMES[tonic]);
        }
    }

    // Reject very weak correlations (atonal / drum-only material).
    if best_corr < 0.45 {
        return None;
    }
    Some(best_key)
}

/// Duration + BPM → oneshot | loop | phrase.
fn classify_shape(duration_sec: f32, bpm: Option<f32>) -> &'static str {
    if duration_sec > 0.0 && duration_sec < 1.5 {
        return "oneshot";
    }
    if let Some(bpm) = bpm {
        if duration_sec >= 1.5 && duration_sec < 20.0 {
            let beats = duration_sec * bpm / 60.0;
            // Loops typically align to powers of two beats (1, 2, 4, 8, 16, 32).
            let bar_sizes = [1.0, 2.0, 4.0, 8.0, 16.0, 32.0];
            for &bs in bar_sizes.iter() {
                if (beats - bs).abs() <= 0.25 {
                    return "loop";
                }
            }
        }
    }
    "phrase"
}

// ─── Tests ────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::path::PathBuf;
    use std::str::FromStr;
    use std::time::UNIX_EPOCH;
    use walkdir::WalkDir;

    /// Smoke-test the analyzer against real user samples on disk.
    /// Skipped when fixture folder is absent. Run with:
    ///   cargo test --lib sample_indexer::tests -- --nocapture
    #[test]
    fn analyze_real_samples() {
        let root = PathBuf::from(std::env::var("HOME").unwrap_or_default())
            .join("Music/WMDM/Samples");
        if !root.exists() {
            eprintln!("Skipping — {} not found", root.display());
            return;
        }

        let exts: &[&str] = &["wav", "aiff", "aif", "flac"];
        let mut files: Vec<PathBuf> = WalkDir::new(&root)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .map(|e| e.into_path())
            .filter(|p| {
                p.extension()
                    .and_then(|e| e.to_str())
                    .map(|e| exts.contains(&e.to_ascii_lowercase().as_str()))
                    .unwrap_or(false)
            })
            .collect();
        files.sort();
        // Cap so the test is fast.
        files.truncate(30);

        assert!(!files.is_empty(), "expected at least one audio file");

        println!(
            "\n{:>7}  {:>5}  {:>4}  {:>7}  {:<6}  {}",
            "DUR", "BPM", "CONF", "SHAPE", "CAT", "FILE"
        );
        let mut bpm_hits = 0usize;
        let mut cat_hits = 0usize;
        for path in &files {
            match analyze_file(path) {
                Ok(a) => {
                    if a.bpm.is_some() {
                        bpm_hits += 1;
                    }
                    if a.category.is_some() {
                        cat_hits += 1;
                    }
                    println!(
                        "{:>7.2}  {:>5}  {:>4.2}  {:>7}  {:<6}  {}",
                        a.duration_sec,
                        a.bpm
                            .map(|b| format!("{:.0}", b))
                            .unwrap_or_else(|| "-".into()),
                        a.bpm_confidence,
                        a.shape,
                        a.category.as_deref().unwrap_or("-"),
                        path.file_name().and_then(|s| s.to_str()).unwrap_or("")
                    );
                }
                Err(e) => {
                    println!(
                        "ERR    {}  {}",
                        path.file_name().and_then(|s| s.to_str()).unwrap_or(""),
                        e
                    );
                }
            }
        }
        println!(
            "\nAnalyzed {} files · BPM detected: {} · Category guessed: {}",
            files.len(),
            bpm_hits,
            cat_hits
        );
    }

    /// Opt-in: scan + tag every file under every enabled library_root in the
    /// real desktop-app database. Only runs when WMDM_RUN_FULL_INDEX=1.
    ///   WMDM_RUN_FULL_INDEX=1 cargo test --lib sample_indexer::tests::full_index_real_db --release -- --nocapture --ignored
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    #[ignore]
    async fn full_index_real_db() {
        if std::env::var("WMDM_RUN_FULL_INDEX").ok().as_deref() != Some("1") {
            eprintln!("Skipping — set WMDM_RUN_FULL_INDEX=1 to run against real DB");
            return;
        }
        let db_path = PathBuf::from(std::env::var("HOME").unwrap_or_default())
            .join("Library/Application Support/com.wemakedancemusic.app/wmdm.db");
        assert!(db_path.exists(), "real DB not found at {}", db_path.display());

        let db_url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());
        let options = SqliteConnectOptions::from_str(&db_url)
            .unwrap()
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);
        let pool = SqlitePoolOptions::new()
            .max_connections(4)
            .connect_with(options)
            .await
            .expect("connect real DB");

        // List enabled roots
        let roots: Vec<(i64, String)> = sqlx::query_as(
            "SELECT id, path FROM library_roots WHERE enabled = 1",
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        println!("Roots: {}", roots.len());
        assert!(!roots.is_empty(), "no roots to scan — seed one first");

        // Walk + upsert sample_files
        let mut discovered = 0usize;
        for (root_id, root_str) in &roots {
            let root_path = PathBuf::from(root_str);
            if !root_path.exists() {
                eprintln!("missing root dir: {}", root_path.display());
                continue;
            }
            for entry in WalkDir::new(&root_path)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if !entry.file_type().is_file() {
                    continue;
                }
                let path = entry.path();
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_ascii_lowercase())
                    .unwrap_or_default();
                if !AUDIO_EXTS.contains(&ext.as_str()) {
                    continue;
                }
                let Ok(meta) = entry.metadata() else { continue };
                let size_bytes = meta.len() as i64;
                let mtime = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);
                let rel_path = path
                    .strip_prefix(&root_path)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .to_string();
                let file_name = path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();
                let _ = sqlx::query(
                    "INSERT INTO sample_files (root_id, rel_path, file_name, ext, size_bytes, mtime)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON CONFLICT(root_id, rel_path) DO UPDATE SET
                        size_bytes = excluded.size_bytes,
                        mtime = excluded.mtime",
                )
                .bind(root_id)
                .bind(&rel_path)
                .bind(&file_name)
                .bind(&ext)
                .bind(size_bytes)
                .bind(mtime)
                .execute(&pool)
                .await;
                discovered += 1;
            }
        }
        println!("Discovered {discovered} files");

        // Tag any sample whose tag row is missing OR was written by an older tagger.
        let pending: Vec<(i64, String, String)> = sqlx::query_as(
            "SELECT sf.id, lr.path, sf.rel_path
             FROM sample_files sf
             JOIN library_roots lr ON lr.id = sf.root_id
             LEFT JOIN sample_tags st ON st.sample_id = sf.id
             WHERE st.sample_id IS NULL
                OR st.tagger_version IS NULL
                OR st.tagger_version != ?",
        )
        .bind(TAGGER_VERSION)
        .fetch_all(&pool)
        .await
        .unwrap();
        println!("Tagging {} files (tagger {})…", pending.len(), TAGGER_VERSION);

        let mut tagged = 0usize;
        let mut errors = 0usize;
        for (i, (id, root_path, rel_path)) in pending.iter().enumerate() {
            let full = PathBuf::from(root_path).join(rel_path);
            let file_name = full
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let (dur, bpm, conf, key_name, cat, shape) = match analyze_file(&full) {
                Ok(a) => (
                    Some(a.duration_sec),
                    a.bpm,
                    a.bpm_confidence,
                    a.key_name,
                    a.category,
                    a.shape,
                ),
                Err(_) => {
                    errors += 1;
                    (
                        None,
                        None,
                        0.0,
                        None,
                        classify_by_filename(&file_name).map(String::from),
                        "phrase".to_string(),
                    )
                }
            };
            let _ = sqlx::query(
                "INSERT OR REPLACE INTO sample_tags
                 (sample_id, duration_sec, bpm, bpm_confidence, key_name, category, shape, tagged_at, tagger_version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)",
            )
            .bind(id)
            .bind(dur)
            .bind(bpm)
            .bind(conf)
            .bind(key_name)
            .bind(cat)
            .bind(shape)
            .bind(TAGGER_VERSION)
            .execute(&pool)
            .await;
            tagged += 1;
            if i % 200 == 0 {
                println!("  {tagged}/{} tagged", pending.len());
            }
        }
        println!("Done: {tagged} tagged, {errors} decode errors");
    }
}
