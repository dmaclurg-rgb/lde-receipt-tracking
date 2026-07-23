import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";

const ROOT = path.join(process.cwd(), "local-storage");

// Serves files written by lib/storage/local.ts (the dev/no-Drive-configured
// fallback). Requires an authenticated session — these are receipt images
// and statements, not public assets.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/files/[...path]">
) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { path: segments } = await ctx.params;
  const resolved = path.join(ROOT, ...segments);

  // Guard against path traversal (e.g. "..%2F..").
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const info = await stat(resolved);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const data = await readFile(resolved);
    return new Response(new Uint8Array(data));
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
