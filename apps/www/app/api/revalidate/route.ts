import { updateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!process.env.REVALIDATION_TOKEN || token !== process.env.REVALIDATION_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    updateTag("changelogs");
    return NextResponse.json({ revalidated: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Revalidation failed", details: String(err) },
      { status: 500 },
    );
  }
}
