import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const models = await db.model.findMany({
      orderBy: [{ variant: "asc" }, { stage: "asc" }],
    });
    return NextResponse.json({ success: true, data: models });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch models" },
      { status: 500 },
    );
  }
}
