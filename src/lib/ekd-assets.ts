/**
 * EKD Digital Assets client — MedDef project
 * Handles ONNX model uploads to https://assets.andgroupco.com
 * - Files < 10 MB  → simple multipart POST /upload
 * - Files ≥ 10 MB  → 3-step terminal chunked API (initialize → chunk → finalize)
 */

const API_BASE =
  process.env.EKD_DIGITAL_ASSETS_API_URL ||
  "https://www.assets.andgroupco.com/api/v1/assets";

// The sk_ SECRET is the Bearer token credential — ak_ key is just an identifier
const API_KEY =
  process.env.EKD_DIGITAL_ASSETS_API_SECRET ||
  process.env.EKD_DIGITAL_ASSETS_API_KEY ||
  "";

/** 2 MB binary → ~2.7 MB base64 JSON per request — safe for Nginx default limits */
const CHUNK_SIZE = 2 * 1024 * 1024;
/** Files at or above this threshold use the terminal chunked upload */
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
 * Chunked terminal upload for large files (≥ 10 MB).
 * Uses the 3-step terminal API:
 *   POST /upload/terminal/initialize  — register session
 *   POST /upload/terminal/chunk       — send base64-encoded chunks sequentially
 *   POST /upload/terminal/finalize    — assemble & store the file
 */
export async function uploadModelAssetChunked(
  file: File,
  meta: { variant: string; stage: string },
): Promise<AssetUploadResponse> {
  if (!API_KEY) {
    throw new Error("EKD_DIGITAL_ASSETS_API_KEY is not configured");
  }

  const base = API_BASE.replace(/\/+$/, "");
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const mimeType = file.type || "application/octet-stream";

  const authHeaders = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  // ── Step 1: Initialize ──────────────────────────────────────────────────
  const initRes = await fetch(`${base}/upload/terminal/initialize`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      uploadId,
      filename: file.name,
      mimeType,
      clientId: "meddef",
      projectName: "MedDef",
      totalChunks,
      totalSize: file.size,
    }),
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`Upload init failed (${initRes.status}): ${text}`);
  }

  // ── Step 2: Upload chunks sequentially ─────────────────────────────────
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const buffer = await file.slice(start, end).arrayBuffer();
    // Server expects base64-encoded string in a JSON body
    const chunkData = Buffer.from(buffer).toString("base64");

    const chunkRes = await fetch(`${base}/upload/terminal/chunk`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        uploadId,
        chunkIndex: i,
        totalChunks,
        chunkData,
        filename: file.name,
        mimeType,
        clientId: "meddef",
        projectName: "MedDef",
      }),
    });

    if (!chunkRes.ok) {
      const text = await chunkRes.text();
      throw new Error(
        `Chunk ${i + 1}/${totalChunks} failed (${chunkRes.status}): ${text}`,
      );
    }
  }

  // ── Step 3: Finalize ────────────────────────────────────────────────────
  const finalRes = await fetch(`${base}/upload/terminal/finalize`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      uploadId,
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

  // Server returns camelCase downloadUrl — normalise to download_url for consistency
  return {
    ...data,
    id: data.assetId || data.id || "",
    name: data.filename || file.name,
    url: data.downloadUrl || "",
    public_url: data.downloadUrl || "",
    secure_url: data.downloadUrl || "",
    download_url: data.downloadUrl || "",
    asset_type: "documents",
    format: "ONNX",
    file_size: data.fileSize || file.size,
    mime_type: data.mimeType || mimeType,
    project_name: "MedDef",
    tags: [
      `meddef`,
      `onnx`,
      meta.variant.toLowerCase(),
      meta.stage.toLowerCase(),
    ],
    storage_path: data.filePath || "",
    created_at: new Date().toISOString(),
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
