// ============================================================
// WMDM Desktop App — Tauri IPC wrapper
// Typed async functions calling Rust backend via invoke()
// ============================================================

import { invoke } from "@tauri-apps/api/core";
import type {
  AuthSession,
  Product,
  DownloadItem,
  DawInfo,
  DawConfig,
  PlacementPreview,
  AppSettings,
  SyncResult,
  DeltaSyncResult,
  StoreResult,
} from "../types";

// --- Auth ---

export async function login(
  email: string,
  password: string
): Promise<AuthSession> {
  return invoke<AuthSession>("login", { email, password });
}

export async function logout(): Promise<void> {
  return invoke<void>("logout");
}

export async function getSession(): Promise<AuthSession | null> {
  return invoke<AuthSession | null>("get_session");
}

export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<AuthSession> {
  return invoke<AuthSession>("register", { email, password, firstName, lastName });
}

export interface AuthTokenInfo {
  token: string;
  baseUrl: string;
  storeCode: string | null;
}

export async function getAuthToken(): Promise<AuthTokenInfo | null> {
  return invoke<AuthTokenInfo | null>("get_auth_token");
}

// --- Products ---

export async function syncProducts(
  page: number,
  pageSize: number
): Promise<SyncResult> {
  return invoke<SyncResult>("sync_products", { page, pageSize });
}

export async function syncDelta(since: string): Promise<DeltaSyncResult> {
  return invoke<DeltaSyncResult>("sync_delta", { since });
}

export async function searchProducts(
  query: string,
  filters: Record<string, unknown>
): Promise<Product[]> {
  return invoke<Product[]>("search_products", { query, filters });
}

export async function getProduct(id: number): Promise<Product> {
  return invoke<Product>("get_product", { id });
}

export async function loadCachedProducts(): Promise<Product[]> {
  return invoke<Product[]>("load_cached_products");
}

export async function toggleFavorite(productId: number): Promise<boolean> {
  return invoke<boolean>("toggle_favorite", { productId });
}

export async function getFavoriteIds(): Promise<number[]> {
  return invoke<number[]>("get_favorite_ids");
}

export async function getDownloadedProductIds(): Promise<number[]> {
  return invoke<number[]>("get_downloaded_product_ids");
}

// --- Downloads ---

export async function startDownload(
  productId: number,
  linkHash: string
): Promise<DownloadItem> {
  return invoke<DownloadItem>("start_download", { productId, linkHash });
}

export async function pauseDownload(id: string): Promise<void> {
  return invoke<void>("pause_download", { id });
}

export async function resumeDownload(id: string): Promise<void> {
  return invoke<void>("resume_download", { id });
}

export async function cancelDownload(id: string): Promise<void> {
  return invoke<void>("cancel_download", { id });
}

export async function getDownloadQueue(): Promise<DownloadItem[]> {
  return invoke<DownloadItem[]>("get_download_queue");
}

// --- DAW ---

export async function detectDaws(): Promise<DawInfo[]> {
  return invoke<DawInfo[]>("detect_daws");
}

export async function getDawConfig(): Promise<DawConfig> {
  return invoke<DawConfig>("get_daw_config");
}

export async function setDawPath(
  daw: string,
  path: string
): Promise<void> {
  return invoke<void>("set_daw_path", { daw, path });
}

export async function getPlacementPreview(
  productId: number
): Promise<PlacementPreview> {
  return invoke<PlacementPreview>("get_placement_preview", { productId });
}

// --- Settings ---

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function setSetting(
  key: string,
  value: string | number | boolean
): Promise<void> {
  return invoke<void>("set_setting", { key, value: JSON.stringify(value) });
}

export async function getDownloadPath(): Promise<string> {
  return invoke<string>("get_download_path");
}

export async function setDownloadPath(path: string): Promise<void> {
  return invoke<void>("set_download_path", { path });
}

// --- Store (Browse & Buy) ---

export async function getStoreProducts(
  page: number,
  pageSize: number,
  search?: string,
  formatType?: string,
  daw?: string,
  genre?: string
): Promise<StoreResult> {
  return invoke<StoreResult>("get_store_products", {
    page,
    pageSize,
    search: search || null,
    formatType: formatType || null,
    daw: daw || null,
    genre: genre || null,
  });
}

// --- Plugins ---

export interface InstalledPlugin {
  name: string;
  vendor: string;
  format: string;
  path: string;
  version: string | null;
}

export async function scanPlugins(): Promise<InstalledPlugin[]> {
  return invoke<InstalledPlugin[]>("scan_plugins");
}

export async function checkPluginCompatibility(): Promise<[string, boolean][]> {
  return invoke<[string, boolean][]>("check_plugin_compatibility");
}

// --- Checkout ---

export interface CartResult {
  success: boolean;
  quoteId: number | null;
  productName: string | null;
  price: number | null;
  currency: string | null;
  error: string | null;
}

export async function createCart(productId: number): Promise<CartResult> {
  return invoke<CartResult>("create_cart", { productId });
}

export async function placeOrder(email: string, paymentMethodId: string, quoteId: number): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("place_order", { email, paymentMethodId, quoteId });
}

export async function confirm3ds(paymentIntentId: string, quoteId: number): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("confirm_3ds", { paymentIntentId, quoteId });
}

// --- Filesystem ---

export async function revealInFinder(path: string): Promise<void> {
  return invoke<void>("reveal_in_finder", { path });
}

export async function pickFolder(): Promise<string | null> {
  return invoke<string | null>("pick_folder");
}
