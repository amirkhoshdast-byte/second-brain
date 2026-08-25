import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import { join, extname, relative } from "path";

const VAULT = "/Users/amirhossein/Documents/My Second Brain/Cultural Intelligence Hub";

async function scanDir(dir: string, results: { path: string; name: string; folder: string }[] = []) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(full, results);
      } else if (extname(entry.name) === ".md") {
        const rel = relative(VAULT, full);
        const folder = rel.split("/")[0];
        results.push({ path: rel, name: entry.name.replace(".md", ""), folder });
      }
    }
  } catch {}
  return results;
}

export async function GET() {
  try {
    const files = await scanDir(VAULT);
    return NextResponse.json({ files, total: files.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
