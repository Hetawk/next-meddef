import { readFile } from "node:fs/promises";
import path from "node:path";

export type PlatformStatus = "available" | "external" | "coming_soon" | "unavailable";

export type PlatformArtifact = {
  version: string | null;
  versionCode?: number;
  url: string | null;
  filename?: string;
  format?: string;
  status: PlatformStatus;
  externalUrl?: string | null;
  notes?: string;
  sizeBytes?: number | null;
  sha256?: string | null;
};

export type DownloadsManifest = {
  releaseDate: string;
  releaseNotes?: string;
  platforms: {
    android: PlatformArtifact;
    ios: PlatformArtifact;
    macos: PlatformArtifact;
    windows: PlatformArtifact;
    linux?: PlatformArtifact;
  };
};

const MANIFEST_PATH = path.join(
  process.cwd(),
  "public",
  "downloads",
  "manifest.json",
);

export async function loadDownloadsManifest(): Promise<DownloadsManifest> {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as DownloadsManifest;
}

/** Legacy Android-only shape for mobile in-app update. */
export function androidLegacyFromManifest(manifest: DownloadsManifest) {
  const android = manifest.platforms.android;
  if (!android?.version || !android.url) return null;
  return {
    version: android.version,
    versionCode: android.versionCode ?? 0,
    apkUrl: android.url,
    releaseNotes: manifest.releaseNotes,
  };
}

/** True only when the artifact should expose a download/link CTA. */
export function isPlatformDownloadable(artifact: PlatformArtifact): boolean {
  if (artifact.status === "coming_soon" || artifact.status === "unavailable") {
    return false;
  }
  if (artifact.status === "available") return Boolean(artifact.url);
  if (artifact.status === "external") return Boolean(artifact.externalUrl);
  return false;
}

export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
