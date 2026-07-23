import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { reconcileStatements } from "@/lib/matching-service";
import { persistReconcileResult } from "@/lib/persist-reconcile";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Attach at least one statement or CSV." }, { status: 400 });
  }

  let result;
  try {
    result = await reconcileStatements(files);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Matching service unavailable." },
      { status: 502 }
    );
  }

  const summary = await persistReconcileResult(result);
  return NextResponse.json(summary);
}
