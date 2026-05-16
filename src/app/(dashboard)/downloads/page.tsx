import type { Metadata } from "next";
import { headers } from "next/headers";
import { DownloadsHub } from "@/components/downloads/downloads-hub";
import { detectPlatform } from "@/lib/detect-platform";
import { loadDownloadsManifest } from "@/lib/downloads-manifest";

export const metadata: Metadata = {
  title: "Downloads",
  description:
    "Download MedDef clients for Android, iOS, macOS, Windows, and Linux.",
};

export default async function DownloadsPage() {
  const manifest = await loadDownloadsManifest();
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const serverDetected = detectPlatform(ua);

  return <DownloadsHub manifest={manifest} serverDetected={serverDetected} />;
}
