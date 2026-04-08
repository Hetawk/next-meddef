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

  // Parse incoming FormData and rebuild it to send upstream
  // (passing the parsed FormData object directly can corrupt the multipart boundary)
  const form = await req.formData();

  const chunk = form.get("chunk") as Blob | null;
  const uploadId = form.get("uploadId") as string | null;
  const chunkId = form.get("chunkId") as string | null;
  const checksum = form.get("checksum") as string | null;
  const totalChunks = form.get("totalChunks") as string | null;

  if (!chunk || !uploadId || chunkId === null || !checksum || !totalChunks) {
    return NextResponse.json(
      { success: false, error: "Missing required chunk fields" },
      { status: 400 },
    );
  }

  const outForm = new FormData();
  outForm.append("chunk", chunk);
  outForm.append("uploadId", uploadId);
  outForm.append("chunkId", chunkId);
  outForm.append("checksum", checksum);
  outForm.append("totalChunks", totalChunks);

  let upstream: Response;
  try {
    upstream = await fetch(`${ASSETS_BASE}/upload/chunk`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: outForm,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chunk proxy] network error:", msg);
    return NextResponse.json(
      { success: false, error: `Network error reaching assets server: ${msg}` },
      { status: 502 },
    );
  }

  const raw = await upstream.text();
  console.log(
    `[chunk proxy] assets server → ${upstream.status} | body: ${raw.slice(0, 300)}`,
  );

  // Parse JSON safely — assets server may return HTML on Nginx errors (413, 502…)
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: `Assets server error (${upstream.status}): ${raw.slice(0, 200)}`,
      },
      { status: upstream.ok ? 502 : upstream.status },
    );
  }

  return NextResponse.json(data, { status: upstream.status });
}
