import { NextResponse } from "next/server";
import {
  androidLegacyFromManifest,
  loadDownloadsManifest,
} from "@/lib/downloads-manifest";

export const runtime = "nodejs";

/** Android-only legacy payload for in-app update checks. */
export async function GET() {
  try {
    const manifest = await loadDownloadsManifest();
    const legacy = androidLegacyFromManifest(manifest);
    if (!legacy) {
      return NextResponse.json(
        { error: "android release not configured" },
        { status: 503 },
      );
    }
    return NextResponse.json(legacy, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json(
      { error: "version manifest unavailable" },
      { status: 503 },
    );
  }
}
