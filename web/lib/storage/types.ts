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
}
