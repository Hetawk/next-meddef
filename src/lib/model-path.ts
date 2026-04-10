/**
 * Model directory resolution — server-side only.
 *
 * Resolution order (first that contains at least one .onnx file wins):
 *  1. MODEL_DIR env var  (set in lpad environment manager or .env)
 *  2. /home/hetawk/models/2026  (known VPS absolute path — survives redeploys
 *     without needing an env var set)
 *  3. <cwd>/public/models/onnx  (local development fallback)
 */

import path from "path";
import fs from "fs";

const VPS_MODEL_DIR = "/home/hetawk/models/2026";

function hasOnnxFiles(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some((f) => f.endsWith(".onnx"));
  } catch {
    return false;
  }
}

export function resolveModelDir(): string {
  const candidates = [
    process.env.MODEL_DIR,
    VPS_MODEL_DIR,
    path.join(process.cwd(), "public", "models", "onnx"),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (hasOnnxFiles(dir)) return dir;
  }

  // Return env var or VPS path even if not yet populated — the route will
  // surface a clear "model file not found" error rather than a crash.
  return process.env.MODEL_DIR ?? VPS_MODEL_DIR;
}
