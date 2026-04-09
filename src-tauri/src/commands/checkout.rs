use crate::services::api_client::ApiClient;
use serde::Serialize;
use tauri::State;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CartResult {
    pub success: bool,
    pub quote_id: Option<i64>,
    pub product_name: Option<String>,
    pub price: Option<f64>,
    pub currency: Option<String>,
    pub error: Option<String>,
}

/// Create a cart with a product for in-app checkout.
/// Uses customer's store-scoped auth (self endpoint).
#[tauri::command]
#[allow(non_snake_case)]
pub async fn create_cart(
    productId: u64,
    api: State<'_, ApiClient>,
) -> Result<CartResult, String> {
    let body = serde_json::json!({ "productId": productId });
    let raw = api.post_raw_with_store("/V1/wmdm/desktop/cart/create", &body).await?;

    // Double-parse Magento's string return type
    let inner: String = serde_json::from_str(&raw).unwrap_or_else(|_| raw.clone());
    let parsed: serde_json::Value = serde_json::from_str(&inner)
        .map_err(|e| format!("Failed to parse cart response: {e}"))?;

    if parsed.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
        Ok(CartResult {
            success: true,
            quote_id: parsed.get("quoteId").and_then(|v| v.as_i64()),
            product_name: parsed.get("productName").and_then(|v| v.as_str()).map(String::from),
            price: parsed.get("price").and_then(|v| v.as_f64()),
            currency: parsed.get("currency").and_then(|v| v.as_str()).map(String::from),
            error: None,
        })
    } else {
        let err = parsed.get("error").and_then(|v| v.as_str()).unwrap_or("Cart creation failed");
        Ok(CartResult {
            success: false,
            quote_id: None,
            product_name: None,
            price: None,
            currency: None,
            error: Some(err.to_string()),
        })
    }
}

/// Place an order using the existing CartCheckout endpoint (anonymous, default store).
#[tauri::command]
#[allow(non_snake_case)]
pub async fn place_order(
    email: String,
    paymentMethodId: String,
    quoteId: i64,
    api: State<'_, ApiClient>,
) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({
        "email": email,
        "paymentMethodId": paymentMethodId,
        "quoteId": quoteId
    });

    let raw = api.post_raw_public("/V1/wmdm/checkout/order", &body).await?;
    let inner: String = serde_json::from_str(&raw).unwrap_or_else(|_| raw.clone());
    serde_json::from_str(&inner).map_err(|e| format!("Failed to parse order response: {e}"))
}

/// Confirm 3DS authentication (anonymous, default store).
#[tauri::command]
#[allow(non_snake_case)]
pub async fn confirm_3ds(
    paymentIntentId: String,
    quoteId: i64,
    api: State<'_, ApiClient>,
) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({
        "paymentIntentId": paymentIntentId,
        "quoteId": quoteId
    });

    let raw = api.post_raw_public("/V1/wmdm/checkout/confirm-3ds", &body).await?;
    let inner: String = serde_json::from_str(&raw).unwrap_or_else(|_| raw.clone());
    serde_json::from_str(&inner).map_err(|e| format!("Failed to parse 3DS response: {e}"))
}
