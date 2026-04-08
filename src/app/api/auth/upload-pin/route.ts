import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const uploadPassword = process.env.UPLOAD_PASSWORD;

  if (!uploadPassword) {
    // If not configured, deny access rather than allow anything through
    return NextResponse.json(
      {
        success: false,
        error: "Upload password is not configured on the server.",
      },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (!body.password || body.password !== uploadPassword) {
    return NextResponse.json(
      { success: false, error: "Incorrect password." },
      { status: 401 },
    );
  }

  return NextResponse.json({ success: true });
}
