// ============================================================
// WMDM Desktop App — TypeScript type definitions
// Mirrors Rust backend types for IPC communication
// ============================================================

// --- Auth / User ---

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  storeId: number;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
  expiresAt: string;
}

// --- Products ---

export interface Product {
  id: number;
  name: string;
  sku: string;
  thumbnailUrl: string | null;
  streamUrl: string | null;
  waveform: string | null;
  formatType: FormatType;
  daws: string[];
  genres: string[];
  bpm: number | null;
  key: string | null;
  creator: CreatorInfo | null;
  downloadLinks: DownloadLink[];
  purchasedAt: string;
  fileSize: number | null;
  isWelcomeGift?: boolean;
}

export type FormatType =
  | "template"
  | "preset"
  | "sample"
  | "midi"
  | "other";

export interface FormatInfo {
  formatType: FormatType;
  label: string;
  dawCompatibility: string[];
}

export interface CreatorInfo {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface DownloadLink {
  hash: string;
  label: string;
  fileName: string;
  fileSize: number;
  downloadCount: number;
  remainingDownloads: number | null;
}

// --- Downloads ---

export enum DownloadStatus {
  Queued = "queued",
  Downloading = "downloading",
  Paused = "paused",
  Extracting = "extracting",
  Placing = "placing",
  Complete = "complete",
  Error = "error",
}

export interface DownloadItem {
  id: string;
  productId: number;
  productName: string;
  linkHash: string;
  fileName: string;
  status: DownloadStatus;
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number;
  eta: number | null;
  error: string | null;
  outputPath: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

// --- Tauri Events ---

export interface DownloadProgressEvent {
  id: string;
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number;
  eta: number | null;
}

export interface DownloadCompleteEvent {
  id: string;
  outputPath: string;
}

export interface DownloadErrorEvent {
  id: string;
  error: string;
}

// --- DAW ---

export interface DawInfo {
  name: string;
  slug: string;
  detected: boolean;
  installPath: string | null;
  contentPath: string | null;
  version: string | null;
}

export interface DawConfig {
  daws: DawInfo[];
}

export interface PlacementFile {
  sourcePath: string;
  destinationPath: string;
  fileType: string;
}

export interface PlacementPreview {
  productId: number;
  files: PlacementFile[];
  dawName: string;
  contentPath: string;
}

// --- Settings ---

export interface AppSettings {
  downloadPath: string;
  maxConcurrentDownloads: number;
  autoUpdate: boolean;
  launchAtStartup: boolean;
  notificationsEnabled: boolean;
  theme: "dark";
  firstRunComplete: boolean;
}

// --- API Response Wrappers ---

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface SyncResult {
  products: Product[];
  totalCount: number;
  hasMore: boolean;
}

export interface DeltaSyncResult {
  added: Product[];
  updated: Product[];
  removed: number[];
}

// --- Filters ---

export interface ProductFilters {
  daw: string[];
  formatType: FormatType[];
  genre: string[];
  bpmRange: [number, number] | null;
  key: string | null;
}

export type SortOption =
  | "recent"
  | "name-asc"
  | "name-desc"
  | "creator"
  | "format";

// --- Store (Browse & Buy) ---

export interface StoreProduct {
  id: number;
  name: string;
  sku: string;
  thumbnailUrl: string | null;
  streamUrl: string | null;
  waveform: string | null;
  shortDescription: string | null;
  description: string | null;
  formatType: FormatType;
  daws: string[];
  genres: string[];
  bpm: number | null;
  key: string | null;
  creator: CreatorInfo | null;
  price: number;
  productUrl: string;
  createdAt: string;
}

export interface StoreResult {
  items: StoreProduct[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type StoreSortOption = "newest" | "price-asc" | "price-desc" | "name-asc";
