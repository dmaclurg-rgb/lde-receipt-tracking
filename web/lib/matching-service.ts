const BASE_URL = process.env.MATCHING_SERVICE_URL ?? "http://127.0.0.1:8008";

export interface RemoteCharge {
  issuer: string;
  last_4: string;
  txn_date: string;
  post_date: string;
  description: string;
  amount: string;
  reference: string;
  source_file: string;
}

export interface RemoteHDRow {
  txn_date: string;
  receipt_added_date: string | null;
  order_origin: string;
  purchaser: string;
  transaction_id: string;
  register_number: string;
  job_name: string;
  house: string | null;
  pre_tax_amount: string;
  total_amount: string;
  order_number: string;
  cards: string[];
  invoice_number: string;
  source_file: string;
}

export interface RemoteMatch {
  charge: RemoteCharge;
  receipts: RemoteHDRow[];
  house: string | null;
  is_split: boolean;
  needs_review: boolean;
}

export interface ReconcileResponse {
  matches: RemoteMatch[];
  unmatched: { charge: RemoteCharge; reason: string }[];
  orphans: { row: RemoteHDRow; reason: string }[];
  skipped_files: string[];
}

/**
 * Calls receipt-recon/service.py, which reuses bofa.py/citi.py/home_depot.py/
 * match.py unmodified. See MATCHING_SERVICE_URL in .env.example.
 */
export async function reconcileStatements(files: File[]): Promise<ReconcileResponse> {
  const formData = new FormData();
  for (const f of files) formData.append("files", f, f.name);

  const res = await fetch(`${BASE_URL}/reconcile`, { method: "POST", body: formData });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Matching service error (${res.status}): ${text}`);
  }
  return res.json();
}
