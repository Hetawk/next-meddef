import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { InferenceRequestSchema } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("datasetId");
  const modelId = searchParams.get("modelId");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  try {
    const inferences = await db.inference.findMany({
      where: {
        ...(datasetId ? { datasetId } : {}),
        ...(modelId ? { modelId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { dataset: true, model: true },
    });
    return NextResponse.json({ success: true, data: inferences });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch inferences" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = InferenceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      modelId,
      datasetId,
      imageName,
      imageUrl,
      prediction,
      confidence,
      probabilities,
      attack,
      epsilon,
      defenseHeld,
      elapsedMs,
    } = parsed.data as typeof parsed.data & {
      imageUrl?: string;
      prediction: string;
      confidence: number;
      probabilities: Record<string, number>;
      defenseHeld?: boolean;
      elapsedMs?: number;
    };

    const record = await db.inference.create({
      data: {
        modelId,
        datasetId,
        imageName,
        imageUrl,
        prediction,
        confidence,
        probabilities,
        attack,
        epsilon,
        defenseHeld,
        elapsedMs,
      },
    });
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to save inference" },
      { status: 500 },
    );
  }
}
