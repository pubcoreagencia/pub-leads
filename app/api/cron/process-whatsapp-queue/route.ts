import { NextResponse } from "next/server";
import { getPendingQueueItems, updateQueueItemStatus } from "@/src/lib/turso/whatsapp-queue-repository";
import { getWhatsappInstanceByName } from "@/src/lib/turso/whatsapp-instances-repository";
import { sendEvolutionTextMessage } from "@/src/lib/whatsapp/evolution-client";
import { getTursoClient } from "@/src/lib/turso/client";
import { updateLeadsStatus } from "@/src/lib/turso/leads-repository";

// Vercel Cron sends a Bearer token. CRON_SECRET MUST be configured.
// If absent, the route fails closed (returns 401) to prevent unauthenticated access.
const CRON_SECRET = process.env.CRON_SECRET;

function parseSpintax(text: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  let match;
  let result = text;
  while ((match = spintaxRegex.exec(result)) !== null) {
    const options = match[1].split("|");
    const choice = options[Math.floor(Math.random() * options.length)];
    result = result.replace(match[0], choice);
    spintaxRegex.lastIndex = 0;
  }
  return result;
}

export async function GET(request: Request) {
  // Auth: CRON_SECRET is mandatory. Fail closed if not configured.
  if (!CRON_SECRET) {
    console.error("[cron] CRON_SECRET is not configured — request rejected");
    return NextResponse.json({ error: "Service Unavailable: cron not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch pending items that are ready to send
    const items = await getPendingQueueItems(5); // Process up to 5 items per cron tick to avoid rate limits

    const results = [];

    for (const item of items) {
      try {
        // Mark as processing
        await updateQueueItemStatus(item.id, "processing");

        // Get instance details (to get server_url and api_key)
        // SECURITY: filter by user_id from the queue item to enforce tenant isolation
        const instancesResult = await getTursoClient().execute({
          args: [item.instance_id, item.user_id],
          sql: "select * from whatsapp_instances where id = ? and user_id = ?",
        });

        if (instancesResult.rows.length === 0) {
          throw new Error("Instance not found");
        }

        const instanceData = instancesResult.rows[0];
        const serverUrl = String(instanceData.server_url);
        const apiKey = String(instanceData.api_key);
        const instanceName = String(instanceData.instance_name);

        // Fetch lead details for the phone number
        // SECURITY: filter by user_id from the queue item to enforce tenant isolation
        const leadResult = await getTursoClient().execute({
          args: [item.lead_id, item.user_id],
          sql: "select whatsapp, phone, phone_2 from leads where id = ? and user_id = ?",
        });

        if (leadResult.rows.length === 0) {
          throw new Error("Lead not found");
        }

        const leadRow = leadResult.rows[0];
        const phone = String(leadRow.whatsapp || leadRow.phone || leadRow.phone_2 || "");

        if (!phone) {
          throw new Error("Lead has no valid phone number");
        }

        // Parse spintax in the message content
        let finalMessage = parseSpintax(item.message_content);
        
        // Add fake block / opt-out text
        if (!finalMessage.toLowerCase().includes("sair")) {
          finalMessage += "\n\n*[1] Sair da lista*";
        }

        // Send via Evolution API
        await sendEvolutionTextMessage(serverUrl, apiKey, instanceName, phone, finalMessage);

        // Mark as completed
        await updateQueueItemStatus(item.id, "completed", new Date());

        // Update lead status to contacted if it was new/qualified
        await updateLeadsStatus(item.user_id, [item.lead_id], "contacted");

        // Update funnel state event (this would normally insert into message_events table)
        // For simplicity, we assume the funnel state is updated by other means or we just log it
        // SECURITY: user_id included to match the NOT NULL column constraint and enforce isolation
        await getTursoClient().execute({
          args: [crypto.randomUUID(), item.user_id, item.lead_id, item.funnel_id, item.step_id, "marked_sent", finalMessage],
          sql: `insert into lead_message_events (id, user_id, lead_id, funnel_id, step_id, event_type, message_content) 
                values (?, ?, ?, ?, ?, ?, ?)`
        }).catch(e => console.warn("Failed to insert message event", e));

        results.push({ id: item.id, status: "success" });

      } catch (err: any) {
        console.error(`Failed to process queue item ${item.id}:`, err);
        await updateQueueItemStatus(item.id, "failed");
        results.push({ id: item.id, status: "failed", error: err.message });
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results });

  } catch (error: any) {
    console.error("Cron failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
