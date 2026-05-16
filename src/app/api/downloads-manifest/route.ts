import { NextResponse } from "next/server";
import { loadDownloadsManifest } from "@/lib/downloads-manifest";

export const runtime = "nodejs";

export async function GET() {
  try {
    const manifest = await loadDownloadsManifest();
    return NextResponse.json(manifest, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json(
      { error: "downloads manifest unavailable" },
      { status: 503 },
    );
  }
}
