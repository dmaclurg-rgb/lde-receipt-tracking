import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageAdapter, StoredFile } from "./types";

const ROOT = path.join(process.cwd(), "local-storage");

function sanitize(segment: string): string {
  return segment.replace(/[^a-z0-9-_. ]/gi, "_").trim();
}

/**
 * Dev/fallback adapter: writes to web/local-storage/ (gitignored) and serves
 * files back via app/api/files/[...path]/route.ts. Used automatically when
 * Google Drive credentials aren't configured — see lib/storage/index.ts.
 */
export const localStorageAdapter: StorageAdapter = {
  async save({ buffer, filename, year, month, folderLabel }): Promise<StoredFile> {
    const monthStr = String(month).padStart(2, "0");
    const relDir = path.join(String(year), monthStr, sanitize(folderLabel));
    const dir = path.join(ROOT, relDir);
    await mkdir(dir, { recursive: true });

    const safeName = `${Date.now()}-${sanitize(filename)}`;
    await writeFile(path.join(dir, safeName), buffer);

    const relPath = path.join(relDir, safeName);
    return {
      storagePath: relPath,
      fileUrl: `/api/files/${relPath.split(path.sep).join("/")}`,
    };
  },

  async read({ storagePath }): Promise<Buffer> {
    if (!storagePath) throw new Error("localStorageAdapter.read requires storagePath");
    const resolved = path.join(ROOT, storagePath);
    // Guard against path traversal, same check as app/api/files/[...path].
    if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
      throw new Error("Invalid storage path");
    }
    return readFile(resolved);
  },
};
