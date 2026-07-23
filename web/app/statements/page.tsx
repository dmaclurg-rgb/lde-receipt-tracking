import StatementUploadForm from "./StatementUploadForm";

export default function StatementsPage() {
  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-1 text-2xl font-semibold">Upload Statement / CSV</h1>
      <p className="mb-6 text-sm text-neutral-500">
        BofA/Citi card statements and Home Depot purchase CSVs are parsed and
        matched automatically. Everything else (bank transfer, Zelle, wire)
        gets logged from the Review page.
      </p>
      <StatementUploadForm />
    </main>
  );
}
