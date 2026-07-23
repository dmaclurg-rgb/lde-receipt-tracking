import { Readable } from "node:stream";
import { google } from "googleapis";
import type { StorageAdapter, StoredFile } from "./types";

function loadCredentials(): Record<string, unknown> {
  const inline = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  if (inline) return JSON.parse(inline);

  const filePath = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE;
  if (filePath) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return JSON.parse(require("node:fs").readFileSync(filePath, "utf-8"));
  }
  throw new Error(
    "Google Drive storage is enabled but neither GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON " +
      "nor GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE is set. See SETUP.md."
  );
}

function driveClient() {
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string
): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  const existing = res.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  if (!created.data.id) throw new Error(`Failed to create Drive folder "${name}"`);
  return created.data.id;
}

/**
 * Production adapter: files under Year/Month/Property (or "Company
 * Overhead") inside GOOGLE_DRIVE_ROOT_FOLDER_ID — by default the existing
 * "Vendor Invoices & Receipts - Tax 2026" folder, so this system extends
 * what's already there instead of forking a parallel tree.
 */
export const googleDriveAdapter: StorageAdapter = {
  async save({ buffer, filename, mimeType, year, month, folderLabel }): Promise<StoredFile> {
    const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!rootId) {
      throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not set. See SETUP.md.");
    }
    const drive = driveClient();
    const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", {
      month: "long",
    });

    const yearFolder = await findOrCreateFolder(drive, String(year), rootId);
    const monthFolder = await findOrCreateFolder(
      drive,
      `${String(month).padStart(2, "0")} - ${monthName}`,
      yearFolder
    );
    const propertyFolder = await findOrCreateFolder(drive, folderLabel, monthFolder);

    const created = await drive.files.create({
      requestBody: { name: filename, parents: [propertyFolder] },
      media: { mimeType, body: Readable.from(buffer) },
      fields: "id, webViewLink",
    });

    if (!created.data.id) throw new Error("Google Drive upload did not return a file id");
    return { fileId: created.data.id, fileUrl: created.data.webViewLink ?? undefined };
  },
};
