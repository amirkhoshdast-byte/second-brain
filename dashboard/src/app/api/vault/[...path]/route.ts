import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const VAULT = "/Users/amirhossein/Documents/My Second Brain/Cultural Intelligence Hub";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filePath = join(VAULT, ...path);

  // security: must be inside vault
  if (!filePath.startsWith(VAULT)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return NextResponse.json({ content, path: path.join("/") });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
