use crate::UserProfile;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Manages authentication state: file-based token storage + cached profile.
/// Uses a simple file in the app data directory instead of the OS keychain
/// to avoid constant macOS Keychain permission popups during development.
/// TODO: Switch to keyring for production builds (code-signed app won't prompt).
#[derive(Clone)]
pub struct AuthService {
    profile: Arc<RwLock<Option<UserProfile>>>,
    token_file: PathBuf,
    store_code_file: PathBuf,
}

impl AuthService {
    pub fn new() -> Self {
        let data_dir = dirs::data_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join(".wmdm"))
            .join("com.wemakedancemusic.app");
        std::fs::create_dir_all(&data_dir).ok();

        Self {
            profile: Arc::new(RwLock::new(None)),
            token_file: data_dir.join("auth_token"),
            store_code_file: data_dir.join("store_code"),
        }
    }

    /// Store the bearer token to a local file.
    pub fn store_token(&self, token: &str) -> Result<(), String> {
        std::fs::write(&self.token_file, token)
            .map_err(|e| format!("Failed to store token: {e}"))
    }

    /// Retrieve the bearer token from the local file.
    pub fn get_token(&self) -> Option<String> {
        std::fs::read_to_string(&self.token_file).ok().filter(|t| !t.is_empty())
    }

    /// Delete the token file.
    pub fn delete_token(&self) -> Result<(), String> {
        let _ = std::fs::remove_file(&self.token_file);
        let _ = std::fs::remove_file(&self.store_code_file);
        Ok(())
    }

    /// Persist the store code to a local file.
    pub fn store_store_code(&self, code: &str) -> Result<(), String> {
        std::fs::write(&self.store_code_file, code)
            .map_err(|e| format!("Failed to store store code: {e}"))
    }

    /// Retrieve the persisted store code.
    pub fn get_store_code(&self) -> Option<String> {
        std::fs::read_to_string(&self.store_code_file).ok().filter(|s| !s.is_empty())
    }

    /// Cache the user profile in memory.
    pub async fn set_profile(&self, profile: Option<UserProfile>) {
        let mut p = self.profile.write().await;
        *p = profile;
    }

    /// Get the cached user profile.
    pub async fn get_profile(&self) -> Option<UserProfile> {
        self.profile.read().await.clone()
    }
}
