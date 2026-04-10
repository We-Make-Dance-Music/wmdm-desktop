use crate::services::api_client::ApiClient;
use crate::services::auth_service::AuthService;
use crate::{AuthSession, UserProfile};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

/// Token info returned to the frontend for direct Magento API calls.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AuthTokenInfo {
    pub token: String,
    pub base_url: String,
    pub store_code: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct TokenRequest {
    username: String,
    password: String,
}

/// Magento customer/me response shape.
#[derive(Deserialize)]
struct MagentoCustomer {
    id: u64,
    email: String,
    firstname: String,
    lastname: String,
    #[serde(default)]
    store_id: Option<u64>,
}

/// All WMDM store codes — try each one for multi-website login.
const STORE_CODES: &[&str] = &["default", "en", "lgten", "cbten", "abten", "flsen", "io", "PG"];

/// Disposable/temp email domains to block on registration.
const BLOCKED_EMAIL_DOMAINS: &[&str] = &[
    "tempmail.com", "throwaway.email", "guerrillamail.com", "mailinator.com",
    "yopmail.com", "10minutemail.com", "trashmail.com", "temp-mail.org",
    "fakeinbox.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
    "dispostable.com", "maildrop.cc", "mailnesia.com", "tempail.com",
    "tempr.email", "discard.email", "discardmail.com", "nada.email",
    "getnada.com", "tmpmail.net", "mohmal.com", "burnermail.io",
    "inboxkitten.com", "emailondeck.com", "crazymailing.com",
];

/// Max registrations allowed per device (stored in SQLite).
const MAX_REGISTRATIONS_PER_DEVICE: i64 = 3;

/// Login with email + password, returns AuthSession with token and profile.
/// Tries all store codes since customers may be on different websites.
#[tauri::command]
pub async fn login(
    email: String,
    password: String,
    api: State<'_, ApiClient>,
    auth: State<'_, AuthService>,
) -> Result<AuthSession, String> {
    let body = TokenRequest {
        username: email,
        password,
    };

    // Try each store code until login succeeds
    let mut last_error = String::from("Invalid credentials");

    for &store_code in STORE_CODES {
        let path = if store_code == "default" {
            "/V1/integration/customer/token".to_string()
        } else {
            format!("/{store_code}/V1/integration/customer/token")
        };

        match api.post_raw(&path, &body).await {
            Ok(raw_token) => {
                let token = raw_token.trim().trim_matches('"').to_string();
                if token.is_empty() {
                    continue;
                }

                // Set the token and store code on the API client
                api.set_token(Some(token.clone())).await;
                api.set_store_code(Some(store_code.to_string())).await;

                // Store in keychain
                auth.store_token(&token)?;
                auth.store_store_code(store_code)?;

                // Fetch user profile — api.get() already prepends the store code
                let customer: MagentoCustomer = api.get("/V1/customers/me").await?;

                let profile = UserProfile {
                    id: customer.id,
                    email: customer.email,
                    first_name: customer.firstname,
                    last_name: customer.lastname,
                    avatar_url: None,
                    store_id: customer.store_id.unwrap_or(1),
                };

                auth.set_profile(Some(profile.clone())).await;

                let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);

                return Ok(AuthSession {
                    token,
                    user: profile,
                    expires_at: expires_at.to_rfc3339(),
                });
            }
            Err(e) => {
                last_error = e;
                continue;
            }
        }
    }

    Err(last_error)
}

/// Magento customer creation request body.
#[derive(Serialize)]
struct CreateCustomerRequest {
    customer: CreateCustomerData,
    password: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateCustomerData {
    email: String,
    firstname: String,
    lastname: String,
    website_id: u64,
    store_id: u64,
}

/// Magento customer creation response.
#[derive(Deserialize)]
struct MagentoCreateCustomerResponse {
    id: u64,
    email: String,
    firstname: String,
    lastname: String,
}

/// Website ID to store ID mapping for registration.
const WEBSITE_STORE_MAP: &[(u64, u64)] = &[
    (1, 1), // Main website => en store
];

/// Register a new customer account, then auto-login.
#[tauri::command]
#[allow(non_snake_case)]
#[allow(non_snake_case)]
pub async fn register(
    email: String,
    password: String,
    firstName: String,
    lastName: String,
    api: State<'_, ApiClient>,
    auth: State<'_, AuthService>,
    db: State<'_, SqlitePool>,
) -> Result<AuthSession, String> {
    // --- Anti-bot protections ---

    // 1. Block disposable email domains
    let email_domain = email.split('@').last().unwrap_or("").to_lowercase();
    if BLOCKED_EMAIL_DOMAINS.contains(&email_domain.as_str()) {
        return Err("Please use a permanent email address, not a disposable one.".to_string());
    }

    // 2. Device-based rate limit — max 3 registrations per machine
    let reg_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM settings WHERE key = 'registration_count'"
    )
    .fetch_one(db.inner())
    .await
    .unwrap_or((0,));

    let current_count: i64 = if reg_count.0 > 0 {
        sqlx::query_as::<_, (String,)>("SELECT value FROM settings WHERE key = 'registration_count'")
            .fetch_one(db.inner())
            .await
            .map(|r| r.0.parse::<i64>().unwrap_or(0))
            .unwrap_or(0)
    } else {
        0
    };

    if current_count >= MAX_REGISTRATIONS_PER_DEVICE {
        return Err("Maximum number of accounts reached on this device.".to_string());
    }

    // 3. Basic email format validation
    if !email.contains('@') || !email.contains('.') || email.len() < 5 {
        return Err("Please enter a valid email address.".to_string());
    }

    // --- Create the account ---
    let body = CreateCustomerRequest {
        customer: CreateCustomerData {
            email: email.clone(),
            firstname: firstName.clone(),
            lastname: lastName.clone(),
            website_id: 1,
            store_id: 1,
        },
        password: password.clone(),
    };

    // POST to the public customer creation endpoint
    let _created: MagentoCreateCustomerResponse = api
        .post_public("/V1/customers", &body)
        .await
        .map_err(|e| {
            // Parse Magento error for user-friendly message
            if e.contains("already exists") || e.contains("same email") {
                "An account with this email already exists. Try signing in instead.".to_string()
            } else if e.contains("password") {
                "Password must be at least 8 characters with uppercase, lowercase, and a number.".to_string()
            } else {
                format!("Registration failed: {e}")
            }
        })?;

    // Account created — now login to get a token
    let login_body = TokenRequest {
        username: email,
        password,
    };

    let mut last_error = String::from("Login after registration failed");

    for &store_code in STORE_CODES {
        let path = if store_code == "default" {
            "/V1/integration/customer/token".to_string()
        } else {
            format!("/{store_code}/V1/integration/customer/token")
        };

        match api.post_raw(&path, &login_body).await {
            Ok(raw_token) => {
                let token = raw_token.trim().trim_matches('"').to_string();
                if token.is_empty() {
                    continue;
                }

                api.set_token(Some(token.clone())).await;
                api.set_store_code(Some(store_code.to_string())).await;

                auth.store_token(&token)?;
                auth.store_store_code(store_code)?;

                let customer: MagentoCustomer = api.get("/V1/customers/me").await?;

                let profile = UserProfile {
                    id: customer.id,
                    email: customer.email,
                    first_name: customer.firstname,
                    last_name: customer.lastname,
                    avatar_url: None,
                    store_id: customer.store_id.unwrap_or(1),
                };

                auth.set_profile(Some(profile.clone())).await;

                let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);

                // Increment device registration counter
                let new_count = current_count + 1;
                let _ = sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('registration_count', ?)")
                    .bind(new_count.to_string())
                    .execute(db.inner())
                    .await;

                return Ok(AuthSession {
                    token,
                    user: profile,
                    expires_at: expires_at.to_rfc3339(),
                });
            }
            Err(e) => {
                last_error = e;
                continue;
            }
        }
    }

    Err(last_error)
}

/// Logout: clear token from keychain and memory.
#[tauri::command]
pub async fn logout(
    api: State<'_, ApiClient>,
    auth: State<'_, AuthService>,
    db: State<'_, SqlitePool>,
) -> Result<(), String> {
    auth.delete_token()?;
    auth.set_profile(None).await;
    api.set_token(None).await;
    api.set_store_code(None).await;

    // Clear user-specific cached data (per-account — favorites, library, downloads)
    let _ = sqlx::query("DELETE FROM products").execute(db.inner()).await;
    let _ = sqlx::query("DELETE FROM download_queue").execute(db.inner()).await;
    let _ = sqlx::query("DELETE FROM placed_files").execute(db.inner()).await;
    let _ = sqlx::query("DELETE FROM favorites").execute(db.inner()).await;

    // Reset last_sync so the next login triggers a full fresh sync
    let _ = sqlx::query("DELETE FROM settings WHERE key = 'last_sync'").execute(db.inner()).await;

    Ok(())
}

/// Return the current auth token and API base URL for direct Magento API calls from React.
/// Used by the checkout flow which needs to call Magento REST endpoints directly.
#[tauri::command]
pub async fn get_auth_token(
    _api: State<'_, ApiClient>,
    auth: State<'_, AuthService>,
) -> Result<Option<AuthTokenInfo>, String> {
    let token = match auth.get_token() {
        Some(t) => t,
        None => return Ok(None),
    };

    let store_code = auth.get_store_code();

    let base_url = match &store_code {
        Some(code) if code != "default" => {
            format!("https://www.wemakedancemusic.com/rest/{}", code)
        }
        _ => "https://www.wemakedancemusic.com/rest".to_string(),
    };

    Ok(Some(AuthTokenInfo {
        token,
        base_url,
        store_code,
    }))
}

/// Check for an existing session by reading the keychain token.
#[tauri::command]
pub async fn get_session(
    api: State<'_, ApiClient>,
    auth: State<'_, AuthService>,
) -> Result<Option<AuthSession>, String> {
    let token = match auth.get_token() {
        Some(t) => t,
        None => return Ok(None),
    };

    // Set token on API client and try to validate it
    api.set_token(Some(token.clone())).await;

    // Restore the persisted store code so API calls are scoped correctly
    if let Some(store_code) = auth.get_store_code() {
        api.set_store_code(Some(store_code)).await;
    }

    // Try to fetch the profile to verify the token is still valid
    match api.get::<MagentoCustomer>("/V1/customers/me").await {
        Ok(customer) => {
            let profile = UserProfile {
                id: customer.id,
                email: customer.email,
                first_name: customer.firstname,
                last_name: customer.lastname,
                avatar_url: None,
                store_id: customer.store_id.unwrap_or(1),
            };

            auth.set_profile(Some(profile.clone())).await;

            let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);

            Ok(Some(AuthSession {
                token,
                user: profile,
                expires_at: expires_at.to_rfc3339(),
            }))
        }
        Err(_) => {
            // Token expired or invalid — clean up
            auth.delete_token()?;
            auth.set_profile(None).await;
            api.set_token(None).await;
            Ok(None)
        }
    }
}
