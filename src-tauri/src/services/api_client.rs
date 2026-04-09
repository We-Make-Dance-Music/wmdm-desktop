use reqwest::Client;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

/// HTTP client for the WMDM Magento REST API.
#[derive(Clone)]
pub struct ApiClient {
    client: Client,
    base_url: String,
    token: Arc<RwLock<Option<String>>>,
    /// The store code used for authentication (e.g. "abten", "en", "PG").
    /// All API calls must use this store code scope.
    store_code: Arc<RwLock<Option<String>>>,
}

impl ApiClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) WMDM-Desktop/1.0")
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            // TODO: Switch to production URL when DesktopApi module is deployed
            base_url: "https://www.wemakedancemusic.com/rest".to_string(),
            token: Arc::new(RwLock::new(None)),
            store_code: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn set_token(&self, token: Option<String>) {
        let mut t = self.token.write().await;
        *t = token;
    }

    pub async fn get_token(&self) -> Option<String> {
        self.token.read().await.clone()
    }

    pub async fn set_store_code(&self, code: Option<String>) {
        let mut sc = self.store_code.write().await;
        *sc = code;
    }

    /// Build the full URL with store code prefix if set.
    /// e.g. base_url + "/abten" + path => ".../rest/abten/V1/wmdm/desktop/products"
    fn build_url_with_store<'a>(&'a self, path: &str, store_code: &Option<String>) -> String {
        match store_code {
            Some(code) if code != "default" => format!("{}/{}{}", self.base_url, code, path),
            _ => format!("{}{}", self.base_url, path),
        }
    }

    /// GET request to the Magento API (uses stored store code).
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, String> {
        let store_code = self.store_code.read().await.clone();
        let url = self.build_url_with_store(path, &store_code);
        let mut req = self.client.get(&url);

        if let Some(ref token) = *self.token.read().await {
            req = req.bearer_auth(token);
        }

        let resp = req.send().await.map_err(|e| format!("Request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("API error {status}: {body}"));
        }

        resp.json::<T>()
            .await
            .map_err(|e| format!("Failed to parse response: {e}"))
    }

    /// POST request to the Magento API (uses stored store code).
    pub async fn post<T: DeserializeOwned, B: Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, String> {
        let store_code = self.store_code.read().await.clone();
        let url = self.build_url_with_store(path, &store_code);
        let mut req = self.client.post(&url).json(body);

        if let Some(ref token) = *self.token.read().await {
            req = req.bearer_auth(token);
        }

        let resp = req.send().await.map_err(|e| format!("Request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("API error {status}: {body}"));
        }

        resp.json::<T>()
            .await
            .map_err(|e| format!("Failed to parse response: {e}"))
    }

    /// POST request that returns raw text, using the stored store code.
    pub async fn post_raw_with_store<B: Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<String, String> {
        let store_code = self.store_code.read().await.clone();
        let url = self.build_url_with_store(path, &store_code);
        let mut req = self.client.post(&url).json(body);

        if let Some(ref token) = *self.token.read().await {
            req = req.bearer_auth(token);
        }

        let resp = req.send().await.map_err(|e| format!("Request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();
            return Err(format!("API error {status}: {body_text}"));
        }

        resp.text()
            .await
            .map_err(|e| format!("Failed to read response: {e}"))
    }

    /// GET request that returns raw response text (for double-encoded Magento responses).
    pub async fn get_raw(&self, path: &str) -> Result<String, String> {
        let store_code = self.store_code.read().await.clone();
        let url = self.build_url_with_store(path, &store_code);
        let mut req = self.client.get(&url);

        if let Some(ref token) = *self.token.read().await {
            req = req.bearer_auth(token);
        }

        let resp = req.send().await.map_err(|e| format!("Request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("API error {status}: {body}"));
        }

        resp.text()
            .await
            .map_err(|e| format!("Failed to read response: {e}"))
    }

    /// POST request that returns the raw response text.
    /// Uses an explicit path (no store code prefix — login handles its own store rotation).
    pub async fn post_raw<B: Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<String, String> {
        let url = format!("{}{}", self.base_url, path);
        let req = self.client.post(&url).json(body);

        let resp = req.send().await.map_err(|e| format!("Request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();
            return Err(format!("API error {status}: {body_text}"));
        }

        resp.text()
            .await
            .map_err(|e| format!("Failed to read response: {e}"))
    }

    /// GET request to a public endpoint (no auth token, no store code).
    /// Used for anonymous API calls like the store catalog.
    pub async fn get_raw_public(&self, path: &str) -> Result<String, String> {
        let url = format!("{}{}", self.base_url, path);
        let req = self.client.get(&url);

        let resp = req.send().await.map_err(|e| format!("Request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("API error {status}: {body}"));
        }

        resp.text()
            .await
            .map_err(|e| format!("Failed to read response: {e}"))
    }

    /// POST request to a public endpoint (no auth token, no store code).
    /// Used for anonymous API calls like customer registration.
    pub async fn post_public<T: DeserializeOwned, B: Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, String> {
        let url = format!("{}{}", self.base_url, path);
        let req = self.client.post(&url).json(body);

        let resp = req.send().await.map_err(|e| format!("Request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();
            return Err(format!("API error {status}: {body_text}"));
        }

        resp.json::<T>()
            .await
            .map_err(|e| format!("Failed to parse response: {e}"))
    }

    /// POST to a public endpoint returning raw text (for double-encoded Magento responses).
    pub async fn post_raw_public<B: Serialize>(&self, path: &str, body: &B) -> Result<String, String> {
        let url = format!("{}{}", self.base_url, path);
        let req = self.client.post(&url).json(body);
        let resp = req.send().await.map_err(|e| format!("Request failed: {e}"))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();
            return Err(format!("API error {status}: {body_text}"));
        }
        resp.text().await.map_err(|e| format!("Failed to read response: {e}"))
    }

    /// GET a download URL — returns the reqwest Response for streaming.
    pub async fn get_stream(&self, url: &str) -> Result<reqwest::Response, String> {
        let resp = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Download request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            return Err(format!("Download failed with status {status}"));
        }

        Ok(resp)
    }

    /// GET with Range header for resuming downloads.
    pub async fn get_stream_range(
        &self,
        url: &str,
        from_byte: u64,
    ) -> Result<reqwest::Response, String> {
        let resp = self
            .client
            .get(url)
            .header("Range", format!("bytes={from_byte}-"))
            .send()
            .await
            .map_err(|e| format!("Download request failed: {e}"))?;

        let status = resp.status();
        if !status.is_success() && status != reqwest::StatusCode::PARTIAL_CONTENT {
            return Err(format!("Download failed with status {status}"));
        }

        Ok(resp)
    }
}
