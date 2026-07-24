export interface StoredFile {
  /** Present when stored in Google Drive; absent for the local fallback. */
  fileId?: string;
  /** A URL the team can open the file at (Drive view link, or a local /api/files/... route). */
  fileUrl?: string;
  /** Present only for the local-disk fallback adapter. */
  storagePath?: string;
}

export interface StorageAdapter {
  /**
   * Persist a receipt/statement file under a folder path derived from
   * (year, month, property-or-overhead), and return where it landed.
   */
  save(params: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    year: number;
    month: number; // 1-12
    folderLabel: string; // property name or "Company Overhead"
  }): Promise<StoredFile>;

  /**
   * Reads a previously-saved file back out, e.g. to embed a receipt photo
   * in the audit-packet PDF. Pass whichever of (fileId) or (storagePath)
   * the record has — exactly one will be set, matching the active adapter.
   */
  read(ref: { fileId?: string | null; storagePath?: string | null }): Promise<Buffer>;
}
