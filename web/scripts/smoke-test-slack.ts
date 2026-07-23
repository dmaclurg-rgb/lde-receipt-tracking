/**
 * Simulates Slack sending signed webhook requests to /api/slack/events —
 * verifies signature checking, channel/subtype filtering, dedup, property
 * resolution, and receipt creation without needing a real Slack app.
 *
 * Starts a throwaway local HTTP server to stand in for Slack's file host
 * (downloadSlackFile just needs a reachable url_private).
 *
 * Requires: the Next dev server running with SLACK_SIGNING_SECRET set to
 * the TEST_SECRET below (temporarily — don't leave a real secret this
 * predictable), and receipt-recon/service.py running.
 *
 * Run with: npx tsx scripts/smoke-test-slack.ts
 */
import crypto from "node:crypto";
import http from "node:http";
import { prisma } from "../lib/prisma";

const TEST_SECRET = "test-signing-secret-for-local-dev-only";
const WEBHOOK_URL = "http://localhost:3000/api/slack/events";
const FILE_SERVER_PORT = 8009;

function sign(body: string, timestamp: string): string {
  const base = `v0:${timestamp}:${body}`;
  return "v0=" + crypto.createHmac("sha256", TEST_SECRET).update(base).digest("hex");
}

async function post(
  payload: object,
  opts: { badSignature?: boolean; staleTimestamp?: boolean } = {}
): Promise<{ status: number; body: string }> {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000) - (opts.staleTimestamp ? 600 : 0));
  const sig = opts.badSignature ? "v0=deadbeef" : sign(body, ts);
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Slack-Request-Timestamp": ts,
      "X-Slack-Signature": sig,
    },
    body,
  });
  return { status: res.status, body: await res.text() };
}

function expect(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "✓" : "✗ FAIL"} ${label}: got ${JSON.stringify(actual)}`);
  if (!pass) throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function main() {
  // 1x1 JPEG-ish placeholder bytes are fine — downloadSlackFile just needs
  // *a* body; the receipt pipeline doesn't inspect image content.
  const fileServer = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "image/jpeg" });
    res.end(Buffer.from("fake-jpeg-bytes"));
  });
  await new Promise<void>((resolve) => fileServer.listen(FILE_SERVER_PORT, resolve));

  try {
    expect("bad signature -> 401", (await post({ type: "url_verification", challenge: "x" }, { badSignature: true })).status, 401);
    expect("stale timestamp -> 401", (await post({ type: "url_verification", challenge: "x" }, { staleTimestamp: true })).status, 401);
    expect(
      "url_verification echoes challenge",
      (await post({ type: "url_verification", challenge: "abc123" })).body,
      '{"challenge":"abc123"}'
    );

    const textOnly = await post({
      type: "event_callback",
      event: { type: "message", channel: "C_TEST", user: "U1", text: "just chatting", ts: "9000.001" },
    });
    expect("text-only message -> ok, no file to ingest", textOnly.status, 200);

    const file = {
      id: "F1",
      name: "test-receipt.jpg",
      mimetype: "image/jpeg",
      url_private: `http://127.0.0.1:${FILE_SERVER_PORT}/test.jpg`,
      filetype: "jpg",
    };

    await post({
      type: "event_callback",
      event: { type: "message", channel: "C_TEST", user: "U1", text: "pool floats for wanderlust", ts: "9000.002", files: [file] },
    });
    // Same ts again — Slack-retry dedup should skip creating a second row.
    await post({
      type: "event_callback",
      event: { type: "message", channel: "C_TEST", user: "U1", text: "pool floats for wanderlust", ts: "9000.002", files: [file] },
    });
    await post({
      type: "event_callback",
      event: { type: "message", channel: "C_TEST", user: "U1", text: "office supplies", ts: "9000.003", files: [{ ...file, id: "F2" }] },
    });

    const created = await prisma.receipt.findMany({
      where: { slackChannel: "C_TEST" },
      include: { property: true },
      orderBy: { slackTs: "asc" },
    });
    expect("exactly 2 receipts created (dedup worked)", created.length, 2);
    expect("property mention resolved", created[0]?.property?.name, "Wanderlust");
    expect("unresolved mention falls back to overhead", created[1]?.category, "overhead");

    await prisma.receipt.deleteMany({ where: { slackChannel: "C_TEST" } });
    console.log("All checks passed; test data cleaned up.");
  } finally {
    fileServer.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Smoke test FAILED:", err);
  process.exit(1);
});
