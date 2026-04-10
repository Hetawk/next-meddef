/**
 * EKD Digital Assets client — MedDef project
 * Handles ONNX model uploads to https://assets.andgroupco.com
 *
 * Upload strategy (determined by file size):
 *   < 10 MB  → simple multipart  POST /upload
 *   ≥ 10 MB  → chunked            POST /upload/chunk  (n times) +
 *                                  POST /upload/finalize
 *
 * Chunk route requires a per-chunk SHA-256 checksum (hex) for integrity.
 * No initialize step needed — session is created on first chunk.
 */

const API_BASE =
  process.env.EKD_DIGITAL_ASSETS_API_URL ||
  "https://www.assets.andgroupco.com/api/v1/assets";

// The sk_ SECRET is the Bearer token credential — ak_ key is just an identifier
const API_KEY =
  process.env.EKD_DIGITAL_ASSETS_API_SECRET ||
  process.env.EKD_DIGITAL_ASSETS_API_KEY ||
  "";

/** 5 MB per chunk — safe for Nginx default 8 MB body limit */
const CHUNK_SIZE = 5 * 1024 * 1024;
/** Files at or above this threshold use the chunked upload path */
const CHUNKED_THRESHOLD = 10 * 1024 * 1024;

export interface AssetUploadResponse {
  id: string;
  name: string;
  url: string;
  public_url: string;
  secure_url: string;
  download_url?: string;
  asset_type: string;
  format: string;
  file_size: number;
  mime_type: string;
  project_name: string;
  tags: string[];
  storage_path: string;
  created_at: string;
}

export async function uploadModelAsset(
  file: File,
  meta: { variant: string; stage: string },
): Promise<AssetUploadResponse> {
  if (!API_KEY) {
    throw new Error("EKD_DIGITAL_ASSETS_API_KEY is not configured");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("asset_type", "documents");
  formData.append("project_name", "MedDef");
  formData.append("client_id", "meddef");
  formData.append(
    "tags",
    `meddef,onnx,${meta.variant.toLowerCase()},${meta.stage.toLowerCase()}`,
  );

  const base = API_BASE.replace(/\/+$/, "");
  const res = await fetch(`${base}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Upload failed: ${res.status} ${res.statusText}`;
    try {
      const json = JSON.parse(text);
      msg = json.detail || json.message || msg;
    } catch {
      // keep default
    }
    throw new Error(msg);
  }

  const data = await res.json();

  // Build absolute download URL
  const origin = new URL(base).origin;
  const downloadUrl =
    data.download_url || `${origin}/api/v1/assets/${data.id}/download`;

  return { ...data, download_url: downloadUrl };
}

/**
 * Compute SHA-256 checksum of an ArrayBuffer and return hex string.
 * Used for per-chunk integrity verification required by /upload/chunk.
 */
async function sha256hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Chunked upload for large files (≥ 10 MB).
 *
 * Correct routes (NOT the terminal/* TTYD-based routes):
 *   POST /upload/chunk    — FormData: chunk (Blob), uploadId, chunkId, checksum, totalChunks
 *   POST /upload/finalize — JSON:     uploadId, totalChunks, totalSize, filename, mimeType,
 *                                     clientId, projectName
 *
 * No initialize step — session is lazily created on first /upload/chunk call.
 */
export async function uploadModelAssetChunked(
  file: File,
  meta: { variant: string; stage: string },
): Promise<AssetUploadResponse> {
  if (!API_KEY) {
    throw new Error("EKD_DIGITAL_ASSETS_API_SECRET is not configured");
  }

  const base = API_BASE.replace(/\/+$/, "");
  const origin = new URL(base).origin;
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const mimeType = file.type || "application/octet-stream";
  const authBearer = `Bearer ${API_KEY}`;

  // ── Upload chunks sequentially ────────────────────────────────────────
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const buffer = await file.slice(start, end).arrayBuffer();
    const checksum = await sha256hex(buffer);

    const fd = new FormData();
    fd.append("chunk", new Blob([buffer], { type: mimeType }));
    fd.append("uploadId", uploadId);
    fd.append("chunkId", String(i));
    fd.append("checksum", checksum);
    fd.append("totalChunks", String(totalChunks));

    const chunkRes = await fetch(`${base}/upload/chunk`, {
      method: "POST",
      headers: { Authorization: authBearer },
      body: fd,
    });

    if (!chunkRes.ok) {
      const text = await chunkRes.text();
      throw new Error(
        `Chunk ${i + 1}/${totalChunks} failed (${chunkRes.status}): ${text}`,
      );
    }
  }

  // ── Finalize — assemble chunks and store ──────────────────────────────
  const finalRes = await fetch(`${base}/upload/finalize`, {
    method: "POST",
    headers: {
      Authorization: authBearer,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uploadId,
      totalChunks,
      totalSize: file.size,
      filename: file.name,
      mimeType,
      clientId: "meddef",
      projectName: "MedDef",
    }),
  });

  if (!finalRes.ok) {
    const text = await finalRes.text();
    throw new Error(`Upload finalize failed (${finalRes.status}): ${text}`);
  }

  const data = await finalRes.json();
  if (!data.success) {
    throw new Error(data.error || "Finalize returned failure");
  }

  // Server returns a relative downloadUrl like /assets/<id>
  const downloadUrl = data.downloadUrl?.startsWith("http")
    ? data.downloadUrl
    : `${origin}${data.downloadUrl ?? `/assets/${data.assetId}`}`;

  return {
    id: data.assetId || "",
    name: data.filename || file.name,
    url: downloadUrl,
    public_url: downloadUrl,
    secure_url: downloadUrl,
    download_url: downloadUrl,
    asset_type: "documents",
    format: "ONNX",
    file_size: data.fileSize || file.size,
    mime_type: data.mimeType || mimeType,
    project_name: "MedDef",
    tags: [
      "meddef",
      "onnx",
      meta.variant.toLowerCase(),
      meta.stage.toLowerCase(),
    ],
    storage_path: data.storagePath || data.filePath || "",
    created_at: data.createdAt || new Date().toISOString(),
  } satisfies AssetUploadResponse;
}

/**
 * Unified upload entry point.
 * Automatically chooses simple vs. chunked based on file size.
 */
export async function uploadModel(
  file: File,
  meta: { variant: string; stage: string },
): Promise<AssetUploadResponse> {
  if (file.size >= CHUNKED_THRESHOLD) {
    return uploadModelAssetChunked(file, meta);
  }
  return uploadModelAsset(file, meta);
}
