import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DATASETS } from "@/types";

export async function GET() {
  try {
    const datasets = await db.dataset.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ success: true, data: datasets });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch datasets" },
      { status: 500 },
    );
  }
}

export async function POST() {
  // Seed known datasets if they don't exist
  try {
    const created = await Promise.all(
      Object.values(DATASETS).map((d) =>
        db.dataset.upsert({
          where: { name: d.name },
          update: {},
          create: {
            name: d.name,
            displayName: d.displayName,
            description: d.description,
            classes: [...d.classes] as string[],
          },
        }),
      ),
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to seed datasets" },
      { status: 500 },
    );
  }
}
