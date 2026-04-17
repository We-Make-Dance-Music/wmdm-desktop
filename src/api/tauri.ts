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

/**
 * Wrap an authenticated invoke call — if it returns a 401 Unauthorized error,
 * clear the session and redirect to login instead of showing a raw error.
 */
async function authedInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    const msg = String(err);
    if (msg.includes("401") && msg.includes("Unauthorized")) {
      // Token expired — clear local state and force re-login
      try { await invoke<void>("logout"); } catch { /* best effort */ }
      // Dynamically import to avoid circular deps
      const { useAuthStore } = await import("../stores/authStore");
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        error: "Your session has expired. Please sign in again.",
      });
      throw new Error("Session expired — please sign in again.");
    }
    throw err;
  }
}

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
  return authedInvoke<SyncResult>("sync_products", { page, pageSize });
}

export async function syncDelta(since: string): Promise<DeltaSyncResult> {
  return authedInvoke<DeltaSyncResult>("sync_delta", { since });
}

export async function searchProducts(
  query: string,
  filters: Record<string, unknown>
): Promise<Product[]> {
  return authedInvoke<Product[]>("search_products", { query, filters });
}

export async function getProduct(id: number): Promise<Product> {
  return authedInvoke<Product>("get_product", { id });
}

export async function loadCachedProducts(): Promise<Product[]> {
  return authedInvoke<Product[]>("load_cached_products");
}

export async function toggleFavorite(productId: number): Promise<boolean> {
  return authedInvoke<boolean>("toggle_favorite", { productId });
}

export async function getFavoriteIds(): Promise<number[]> {
  return authedInvoke<number[]>("get_favorite_ids");
}

export async function getDownloadedProductIds(): Promise<number[]> {
  return authedInvoke<number[]>("get_downloaded_product_ids");
}

// --- Downloads ---

export async function startDownload(
  productId: number,
  linkHash: string
): Promise<DownloadItem> {
  return authedInvoke<DownloadItem>("start_download", { productId, linkHash });
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

export async function clearDownloadHistory(): Promise<void> {
  return invoke<void>("clear_download_history");
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
  return authedInvoke<CartResult>("create_cart", { productId });
}

export async function placeOrder(email: string, paymentMethodId: string, quoteId: number): Promise<Record<string, unknown>> {
  return authedInvoke<Record<string, unknown>>("place_order", { email, paymentMethodId, quoteId });
}

export async function confirm3ds(paymentIntentId: string, quoteId: number): Promise<Record<string, unknown>> {
  return authedInvoke<Record<string, unknown>>("confirm_3ds", { paymentIntentId, quoteId });
}

// --- Filesystem ---

export async function revealInFinder(path: string): Promise<void> {
  return invoke<void>("reveal_in_finder", { path });
}

export async function pickFolder(): Promise<string | null> {
  return invoke<string | null>("pick_folder");
}

// --- Bridge: sample library ---

export interface LibraryRoot {
  id: number;
  path: string;
  kind: string;
  enabled: boolean;
  addedAt: string;
  fileCount: number;
  taggedCount: number;
}

export interface IndexStatus {
  scanning: boolean;
  totalFiles: number;
  taggedFiles: number;
  currentFile: string | null;
}

export async function listLibraryRoots(): Promise<LibraryRoot[]> {
  return invoke<LibraryRoot[]>("list_library_roots");
}

export async function addLibraryRoot(path: string, kind?: string): Promise<number> {
  return invoke<number>("add_library_root", { path, kind });
}

export async function removeLibraryRoot(id: number): Promise<void> {
  return invoke<void>("remove_library_root", { id });
}

export async function setLibraryRootEnabled(id: number, enabled: boolean): Promise<void> {
  return invoke<void>("set_library_root_enabled", { id, enabled });
}

export async function scanLibraryRoots(): Promise<void> {
  return invoke<void>("scan_library_roots");
}

export async function getIndexStatus(): Promise<IndexStatus> {
  return invoke<IndexStatus>("get_index_status");
}
