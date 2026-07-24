import { prisma } from "@/lib/prisma";
import { createReceipt } from "@/lib/receipts";
import { resolvePropertyFromText } from "@/lib/matching-service";
import { resolveReceiptSuggestion } from "@/lib/receipt-resolution";
import { extractAmountCents } from "@/lib/amount-extract";
import { detectPaymentMethodFromText, OVERHEAD_OPTION_VALUE } from "@/lib/constants";
import { listChannelsToSearch, fetchChannelHistory, downloadSlackFile, lookupSlackUserEmail } from "@/lib/slack";

const DEFAULT_LOOKBACK_DAYS = 30;
const SYNC_STATE_ID = "singleton";

export interface SlackSyncResult {
  channel: string;
  created: number;
  error?: string;
}

/**
 * Backfill-searches Slack channel history for receipt/invoice files the
 * live Events API webhook (app/api/slack/events/route.ts) never saw —
 * messages posted before the bot existed, in a channel added to
 * SLACK_MONITORED_CHANNELS later, or during any webhook downtime. Reuses
 * the same slackChannel+slackTs de-dup the webhook uses, so a message
 * already ingested there is silently skipped here.
 */
export async function syncSlackHistory(): Promise<SlackSyncResult[]> {
  const state = await prisma.slackSyncState.upsert({
    where: { id: SYNC_STATE_ID },
    update: {},
    create: { id: SYNC_STATE_ID },
  });
  const since = state.lastSyncedAt ?? new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const oldest = String(Math.floor(since.getTime() / 1000));

  const channels = await listChannelsToSearch();
  const results: SlackSyncResult[] = [];

  for (const channel of channels) {
    try {
      const messages = await fetchChannelHistory(channel, oldest);
      let created = 0;

      for (const message of messages) {
        const alreadyIngested = await prisma.receipt.findFirst({
          where: { slackChannel: channel, slackTs: message.ts },
        });
        if (alreadyIngested) continue;

        const text = (message.text ?? "").trim();
        const description = text || "(no description provided in Slack)";
        const paymentMethod = detectPaymentMethodFromText(text);
        // Only matters when property resolution below comes up empty —
        // createReceipt() ignores this whenever a property was resolved.
        const amountHintCents = extractAmountCents(text) ?? undefined;

        let resolvedHouse: string | null = null;
        try {
          resolvedHouse = await resolvePropertyFromText(text);
        } catch {
          resolvedHouse = null; // matching service unreachable — falls through to needs-review
        }

        let property: string | null = null;
        if (resolvedHouse === "OVERHEAD") property = OVERHEAD_OPTION_VALUE;
        else if (resolvedHouse) {
          const record = await prisma.property.findUnique({ where: { name: resolvedHouse } });
          if (record) property = record.id;
        }

        // Alias resolution missed — try vendor history / a second alias
        // pass as a suggestion only (createReceipt still leaves this
        // needsReview: true); doesn't touch the auto-confirm case above.
        const propertySuggestion = property === null ? await resolveReceiptSuggestion(text).catch(() => null) : null;

        const uploadedBy = message.user ? await lookupSlackUserEmail(message.user) : "slack";

        for (const file of message.files) {
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
            slackChannel: channel,
            slackTs: message.ts,
            propertySuggestion,
            amountHintCents,
          });
        }
        created++;
      }

      results.push({ channel, created });
    } catch (err) {
      results.push({ channel, created: 0, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const anyError = results.find((r) => r.error);
  await prisma.slackSyncState.update({
    where: { id: SYNC_STATE_ID },
    data: { lastSyncedAt: new Date(), lastSyncError: anyError?.error ?? null },
  });

  return results;
}
