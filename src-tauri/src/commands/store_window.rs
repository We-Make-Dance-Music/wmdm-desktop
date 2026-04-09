use crate::services::auth_service::AuthService;
use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};
use tauri::{AppHandle, Manager, State, Webview, WebviewUrl, WindowEvent, webview::WebviewBuilder};

const SIDEBAR_WIDTH: f64 = 180.0;
const TITLEBAR_HEIGHT: f64 = 48.0;

static STORE_OPEN: AtomicBool = AtomicBool::new(false);
static STORE_WEBVIEW: Mutex<Option<Webview>> = Mutex::new(None);

#[tauri::command]
pub async fn open_store_window(
    url: String,
    auth: State<'_, AuthService>,
    app: AppHandle,
) -> Result<(), String> {
    // Always close existing first
    do_close();

    // Build auto-login URL if we have a token
    let store_url = if let Some(token) = auth.get_token() {
        let base = url.trim_end_matches('/');
        format!("{}/wmdm/desktop/autologin?token={}&redirect=/", base, urlencoding::encode(&token))
    } else {
        url.clone()
    };

    let ww = app.get_webview_window("main").ok_or("Main window not found")?;
    let window = ww.as_ref().window();

    let size = window.inner_size().map_err(|e| format!("{e}"))?;
    let scale = window.scale_factor().map_err(|e| format!("{e}"))?;
    let w = ((size.width as f64 / scale) - SIDEBAR_WIDTH).max(100.0);
    let h = ((size.height as f64 / scale) - TITLEBAR_HEIGHT).max(100.0);

    let parsed_url: url::Url = store_url.parse().map_err(|e| format!("URL error: {e}"))?;

    let webview = window.add_child(
        WebviewBuilder::new("store-embed", WebviewUrl::External(parsed_url)),
        tauri::Position::Logical(tauri::LogicalPosition::new(SIDEBAR_WIDTH, TITLEBAR_HEIGHT)),
        tauri::Size::Logical(tauri::LogicalSize::new(w, h)),
    ).map_err(|e| format!("Webview error: {e}"))?;

    // Store the webview handle globally so we can close it later
    if let Ok(mut guard) = STORE_WEBVIEW.lock() {
        *guard = Some(webview.clone());
    }

    STORE_OPEN.store(true, Ordering::SeqCst);

    // Resize on window events
    let wv = webview.clone();
    window.on_window_event(move |event| {
        if !STORE_OPEN.load(Ordering::SeqCst) { return; }
        if let WindowEvent::Resized(size) = event {
            if let Ok(scale) = wv.window().scale_factor() {
                let w = ((size.width as f64 / scale) - SIDEBAR_WIDTH).max(100.0);
                let h = ((size.height as f64 / scale) - TITLEBAR_HEIGHT).max(100.0);
                let _ = wv.set_position(tauri::Position::Logical(
                    tauri::LogicalPosition::new(SIDEBAR_WIDTH, TITLEBAR_HEIGHT),
                ));
                let _ = wv.set_size(tauri::Size::Logical(
                    tauri::LogicalSize::new(w, h),
                ));
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn close_store_window(_app: AppHandle) -> Result<(), String> {
    do_close();
    Ok(())
}

fn do_close() {
    STORE_OPEN.store(false, Ordering::SeqCst);
    if let Ok(mut guard) = STORE_WEBVIEW.lock() {
        if let Some(webview) = guard.take() {
            log::info!("Closing store webview");
            // Try multiple approaches to ensure it's gone
            let _ = webview.close();
        }
    }
}

#[tauri::command]
pub async fn resize_store_window(_app: AppHandle) -> Result<(), String> {
    Ok(())
}
