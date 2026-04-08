/**
 * POST /api/models/register
 *
 * Registers a model in the local DB by URL — for models already hosted
 * on the VPS (or any public URL) that don't need to be re-uploaded.
 *
 * Body (JSON): { url, variant, stage, accuracy? }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ModelVariant, ModelStage } from "@/generated/prisma/enums";

const RegisterSchema = z.object({
  url: z.string().url("A valid public URL is required"),
  variant: z.nativeEnum(ModelVariant, {
    error: `variant must be one of: ${Object.values(ModelVariant).join(", ")}`,
  }),
  stage: z.nativeEnum(ModelStage, {
    error: `stage must be one of: ${Object.values(ModelStage).join(", ")}`,
  }),
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  accuracy: z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 },
    );
  }

  const { url, variant, stage, accuracy, name: nameOverride, displayName: displayNameOverride } = parsed.data;
  const modelName = nameOverride ?? `${variant}_${stage}`;
  const modelDisplayName = displayNameOverride ?? `${variant} — ${stage.replace(/_/g, " ")}`;

  const model = await db.model.upsert({
    where: { name: modelName },
    update: {
      onnxPath: url,
      ...(displayNameOverride ? { displayName: displayNameOverride } : {}),
      ...(accuracy != null ? { accuracy } : {}),
    },
    create: {
      name: modelName,
      displayName: modelDisplayName,
      variant,
      stage,
      format: "ONNX",
      onnxPath: url,
      ...(accuracy != null ? { accuracy } : {}),
    },
  });

  return NextResponse.json({ success: true, data: { model } });
}
