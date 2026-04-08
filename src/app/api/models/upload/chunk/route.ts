/**
 * Proxy: POST /api/models/upload/chunk
 *
 * Receives a single chunk from the browser and forwards it to the EKD Assets
 * server with the server-side API key attached. This keeps the secret out of
 * the browser while still allowing the browser to do the chunking (so Next.js
 * never buffers the whole large file in memory).
 *
 * Browser sends FormData: chunk (Blob), uploadId, chunkId, checksum, totalChunks
 */
import { NextRequest, NextResponse } from "next/server";

const ASSETS_BASE = (
  process.env.EKD_DIGITAL_ASSETS_API_URL ||
  "https://www.assets.andgroupco.com/api/v1/assets"
).replace(/\/+$/, "");

const API_KEY =
  process.env.EKD_DIGITAL_ASSETS_API_SECRET ||
  process.env.EKD_DIGITAL_ASSETS_API_KEY ||
  "";

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { success: false, error: "Assets API key not configured" },
      { status: 500 },
    );
  }

  // Stream the incoming FormData straight through to the assets server
  const form = await req.formData();

  const upstream = await fetch(`${ASSETS_BASE}/upload/chunk`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });

  const data = await upstream.json();

  return NextResponse.json(data, { status: upstream.status });
}
