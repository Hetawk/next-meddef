import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { uploadModel } from "@/lib/ekd-assets";
import { ModelVariant, ModelStage } from "@/generated/prisma/enums";

// Allow up to 5 minutes — large ONNX files are chunked but still take time
export const maxDuration = 300;

// ── Zod schema ─────────────────────────────────────────────────────────────
const UploadSchema = z.object({
  variant: z.nativeEnum(ModelVariant, {
    error: `variant must be one of: ${Object.values(ModelVariant).join(", ")}`,
  }),
  stage: z.nativeEnum(ModelStage, {
    error: `stage must be one of: ${Object.values(ModelStage).join(", ")}`,
  }),
  accuracy: z
    .string()
    .optional()
    .transform((v) => (v && v !== "" ? parseFloat(v) : undefined))
    .pipe(
      z.number().min(0).max(1).optional(),
    ),
});

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const file = form.get("file") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, error: "An ONNX file is required" },
        { status: 400 },
      );
    }

    // Zod-validate the metadata fields
    const parsed = UploadSchema.safeParse({
      variant: form.get("variant"),
      stage: form.get("stage"),
      accuracy: form.get("accuracy") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join("; "),
        },
        { status: 400 },
      );
    }

    const { variant, stage, accuracy } = parsed.data;

    // Upload to EKD Digital Assets (chunked automatically for files ≥ 10 MB)
    const asset = await uploadModel(file, { variant, stage });

    const modelName = `${variant}_${stage}`;

    // Upsert the model record in DB
    const model = await db.model.upsert({
      where: { name: modelName },
      update: {
        onnxPath: asset.download_url,
        ...(accuracy != null ? { accuracy } : {}),
      },
      create: {
        name: modelName,
        displayName: `${variant} — ${stage.replace(/_/g, " ")}`,
        variant,
        stage,
        format: "ONNX",
        onnxPath: asset.download_url,
        ...(accuracy != null ? { accuracy } : {}),
      },
    });

    return NextResponse.json({ success: true, data: { asset, model } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
