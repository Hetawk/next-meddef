import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadModel } from "@/lib/ekd-assets";
import { ModelVariant, ModelStage } from "@/generated/prisma/enums";

// Allow up to 5 minutes — large ONNX files are chunked but still take time
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const variant = form.get("variant") as string | null;
    const stage = form.get("stage") as string | null;
    const accuracyRaw = form.get("accuracy") as string | null;

    if (!file || !variant || !stage) {
      return NextResponse.json(
        { success: false, error: "file, variant, and stage are required" },
        { status: 400 },
      );
    }

    // Validate enums
    if (!Object.values(ModelVariant).includes(variant as ModelVariant)) {
      return NextResponse.json(
        { success: false, error: `Invalid variant: ${variant}` },
        { status: 400 },
      );
    }
    if (!Object.values(ModelStage).includes(stage as ModelStage)) {
      return NextResponse.json(
        { success: false, error: `Invalid stage: ${stage}` },
        { status: 400 },
      );
    }

    const accuracy =
      accuracyRaw != null && accuracyRaw !== ""
        ? parseFloat(accuracyRaw)
        : undefined;

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
        displayName: `${variant} — ${stage.replace("_", " ")}`,
        variant: variant as ModelVariant,
        stage: stage as ModelStage,
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
