/**
 * Proxy: POST /api/models/upload/finalize
 *
 * After all chunks are uploaded, the browser calls this to:
 *   1. Tell the assets server to assemble the chunks
 *   2. Upsert the model record in the local DB with the resulting download URL
 *
 * Body (JSON): { uploadId, totalChunks, totalSize, filename, mimeType,
 *               variant, stage, accuracy? }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ModelVariant, ModelStage } from "@/generated/prisma/enums";

const ASSETS_BASE = (
  process.env.EKD_DIGITAL_ASSETS_API_URL ||
  "https://www.assets.andgroupco.com/api/v1/assets"
).replace(/\/+$/, "");

const API_KEY =
  process.env.EKD_DIGITAL_ASSETS_API_SECRET ||
  process.env.EKD_DIGITAL_ASSETS_API_KEY ||
  "";

const ASSETS_ORIGIN = (() => {
  try {
    return new URL(ASSETS_BASE).origin;
  } catch {
    return "https://www.assets.andgroupco.com";
  }
})();

const FinalizeSchema = z.object({
  uploadId: z.string().uuid(),
  totalChunks: z.number().int().min(1),
  totalSize: z.number().int().min(1),
  filename: z.string().min(1),
  mimeType: z.string().default("application/octet-stream"),
  variant: z.nativeEnum(ModelVariant, {
    error: `variant must be one of: ${Object.values(ModelVariant).join(", ")}`,
  }),
  stage: z.nativeEnum(ModelStage, {
    error: `stage must be one of: ${Object.values(ModelStage).join(", ")}`,
  }),
  accuracy: z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { success: false, error: "Assets API key not configured" },
      { status: 500 },
    );
  }

  const body = await req.json();
  const parsed = FinalizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 },
    );
  }

  const { uploadId, totalChunks, totalSize, filename, mimeType, variant, stage, accuracy } =
    parsed.data;

  // Tell the assets server to assemble the chunks
  const upstream = await fetch(`${ASSETS_BASE}/upload/finalize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uploadId,
      totalChunks,
      totalSize,
      filename,
      mimeType,
      clientId: "meddef",
      projectName: "MedDef",
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json(
      { success: false, error: `Assets finalize failed (${upstream.status}): ${text}` },
      { status: 502 },
    );
  }

  const asset = await upstream.json();
  if (!asset.success) {
    return NextResponse.json(
      { success: false, error: asset.error || "Assets server returned failure" },
      { status: 502 },
    );
  }

  // Resolve download URL
  const downloadUrl = asset.downloadUrl?.startsWith("http")
    ? asset.downloadUrl
    : `${ASSETS_ORIGIN}${asset.downloadUrl ?? `/assets/${asset.assetId}`}`;

  const modelName = `${variant}_${stage}`;

  // Upsert model in local DB
  const model = await db.model.upsert({
    where: { name: modelName },
    update: {
      onnxPath: downloadUrl,
      ...(accuracy != null ? { accuracy } : {}),
    },
    create: {
      name: modelName,
      displayName: `${variant} — ${stage.replace(/_/g, " ")}`,
      variant,
      stage,
      format: "ONNX",
      onnxPath: downloadUrl,
      ...(accuracy != null ? { accuracy } : {}),
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      asset: { ...asset, download_url: downloadUrl },
      model,
    },
  });
}
