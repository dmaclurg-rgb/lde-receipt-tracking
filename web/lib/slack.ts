import crypto from "node:crypto";

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

/**
 * Verifies Slack's request signature (https://api.slack.com/authentication/verifying-requests-from-slack).
 * Must run against the *raw* request body — do not JSON.parse before calling this.
 */
export function verifySlackSignature(params: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
}): boolean {
  if (!SIGNING_SECRET) return false;
  const { rawBody, timestamp, signature } = params;
  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes (replay-attack protection).
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const expected =
    "v0=" + crypto.createHmac("sha256", SIGNING_SECRET).update(base).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const slackConfigured = Boolean(SIGNING_SECRET && BOT_TOKEN);

/** Channel IDs to ingest from — the receipt/supply/other/CEO channels. */
export const monitoredChannels = new Set(
  (process.env.SLACK_MONITORED_CHANNELS ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
);

interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  url_private: string;
  filetype: string;
}

export async function downloadSlackFile(file: SlackFile): Promise<Buffer> {
  const res = await fetch(file.url_private, {
    headers: { Authorization: `Bearer ${BOT_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to download Slack file ${file.id}: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Best-effort Slack user id -> email lookup; falls back to the id itself
 * (e.g. if the bot lacks the users:read.email scope). */
export async function lookupSlackUserEmail(userId: string): Promise<string> {
  if (!BOT_TOKEN) return userId;
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${BOT_TOKEN}` },
    });
    const body = await res.json();
    return body?.user?.profile?.email ?? userId;
  } catch {
    return userId;
  }
}

/** Posts a threaded confirmation/error reply so the team gets feedback
 * without leaving Slack (e.g. "logged to Wanderlust" or "couldn't tell
 * which property — logged to Company Overhead for review"). */
export async function postSlackReply(params: {
  channel: string;
  threadTs: string;
  text: string;
}): Promise<void> {
  if (!BOT_TOKEN) return;
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: params.channel,
      thread_ts: params.threadTs,
      text: params.text,
    }),
  });
}
