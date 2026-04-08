import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EvaluationRequestSchema } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("datasetId");
  const modelId = searchParams.get("modelId");

  try {
    const evaluations = await db.evaluation.findMany({
      where: {
        ...(datasetId ? { datasetId } : {}),
        ...(modelId ? { modelId } : {}),
      },
      orderBy: [{ attack: "asc" }, { epsilon: "asc" }],
      include: { dataset: true, model: true },
    });
    return NextResponse.json({ success: true, data: evaluations });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch evaluations" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = EvaluationRequestSchema.safeParse(body);
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

    const record = await db.evaluation.upsert({
      where: {
        datasetId_modelId_attack_epsilon: {
          datasetId: parsed.data.datasetId,
          modelId: parsed.data.modelId,
          attack: parsed.data.attack,
          epsilon: parsed.data.epsilon,
        },
      },
      update: parsed.data,
      create: parsed.data,
    });
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to save evaluation" },
      { status: 500 },
    );
  }
}
