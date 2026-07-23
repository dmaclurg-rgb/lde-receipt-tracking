import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createReceipt } from "@/lib/receipts";
import { resolvePropertyFromText } from "@/lib/matching-service";
import { OVERHEAD_OPTION_VALUE, detectPaymentMethodFromText } from "@/lib/constants";
import {
  verifySlackSignature,
  monitoredChannels,
  downloadSlackFile,
  lookupSlackUserEmail,
  postSlackReply,
} from "@/lib/slack";

interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  url_private: string;
  filetype: string;
}

interface SlackMessageEvent {
  type: string;
  subtype?: string;
  channel: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
  files?: SlackFile[];
}

// Feeds the receipt/supply/other/CEO Slack channels into the same pipeline
// as the app's Add Receipt form. Team members post a photo + a caption
// mentioning the property (or say nothing/"overhead" for shared expenses);
// the CEO's channel works the same way, just usually landing on Overhead.
//
// Setup: create a Slack app (api.slack.com/apps) with bot scopes
// `channels:history`, `files:read`, `chat:write`, and optionally
// `users:read.email`; subscribe to the `message.channels` bot event with
// this route's URL. See web/SETUP.md.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");

  if (!verifySlackSignature({ rawBody, timestamp, signature })) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // Slack's one-time endpoint verification handshake.
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event as SlackMessageEvent;

  // Only plain messages and file-share messages carry receipt photos;
  // ignore edits/deletes/joins/bot-echoes, and channels we're not watching.
  const isRelevantSubtype = !event.subtype || event.subtype === "file_share";
  if (
    event.type !== "message" ||
    !isRelevantSubtype ||
    event.bot_id ||
    (monitoredChannels.size > 0 && !monitoredChannels.has(event.channel))
  ) {
    return NextResponse.json({ ok: true });
  }

  const files = (event.files ?? []).filter(
    (f) => f.mimetype?.startsWith("image/") || f.mimetype === "application/pdf"
  );
  if (files.length === 0) {
    // Text-only message — nothing to file as a receipt.
    return NextResponse.json({ ok: true });
  }

  // Slack retries the webhook if our ack is slow or errors; skip messages
  // we've already ingested rather than double-filing them.
  const alreadyIngested = await prisma.receipt.findFirst({
    where: { slackChannel: event.channel, slackTs: event.ts },
  });
  if (alreadyIngested) {
    return NextResponse.json({ ok: true });
  }

  const text = (event.text ?? "").trim();
  const description = text || "(no description provided in Slack)";
  const paymentMethod = detectPaymentMethodFromText(text);

  let resolvedHouse: string | null = null;
  try {
    resolvedHouse = await resolvePropertyFromText(text);
  } catch {
    resolvedHouse = null; // matching service unreachable — fall through to Overhead + review
  }

  let property = OVERHEAD_OPTION_VALUE;
  let propertyName: string | null = null;
  if (resolvedHouse && resolvedHouse !== "OVERHEAD") {
    const record = await prisma.property.findUnique({ where: { name: resolvedHouse } });
    if (record) {
      property = record.id;
      propertyName = record.name;
    }
  }

  const uploadedBy = event.user ? await lookupSlackUserEmail(event.user) : "slack";

  for (const file of files) {
    const buffer = await downloadSlackFile(file);
    await createReceipt({
      buffer,
      filename: file.name || `slack-${file.id}`,
      mimeType: file.mimetype || "application/octet-stream",
      property,
      description,
      paymentMethod,
      source: "slack",
      uploadedBy,
      slackChannel: event.channel,
      slackTs: event.ts,
    });
  }

  const confirmation = propertyName
    ? `✅ Logged to *${propertyName}*.`
    : `✅ Logged under *Company Overhead* — I couldn't tell which property this was for from your message, so double-check it in the app if it should be billed to an owner.`;
  await postSlackReply({ channel: event.channel, threadTs: event.ts, text: confirmation });

  return NextResponse.json({ ok: true });
}
