import { NextResponse } from "next/server";
import { getWhatsappInstanceByName } from "@/src/lib/turso/whatsapp-instances-repository";
import { updateLeadsStatus, listLeads } from "@/src/lib/turso/leads-repository";
import { cancelPendingQueueForLead } from "@/src/lib/turso/whatsapp-queue-repository";
import { normalizePhoneForEvolution } from "@/src/lib/whatsapp/evolution-client";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // The webhook payload from Evolution API includes the instance name
    const instanceName = payload.instance;
    if (!instanceName || payload.event !== "messages.upsert") {
      return NextResponse.json({ success: true, message: "Ignored event" });
    }

    // Only process incoming messages (fromMe = false)
    const msgData = payload.data?.message;
    if (!msgData || msgData.key?.fromMe) {
      return NextResponse.json({ success: true, message: "Ignored message from self" });
    }

    const remoteJid = msgData.key?.remoteJid;
    if (!remoteJid || remoteJid.includes("@g.us")) {
      // Ignore groups
      return NextResponse.json({ success: true, message: "Ignored group message" });
    }

    // Extract the raw phone number from the JID (e.g., 5511999999999@s.whatsapp.net -> 5511999999999)
    const senderPhone = remoteJid.split("@")[0];

    const instance = await getWhatsappInstanceByName(instanceName);
    if (!instance) {
      console.warn(`Webhook received for unknown instance: ${instanceName}`);
      return NextResponse.json({ success: true, message: "Unknown instance" });
    }

    // Load leads for this user to find a match
    const leadsResponse = await listLeads(instance.user_id, {
      limit: 10000,
      search: "",
      statuses: ["contacted", "qualified", "proposal", "new"],
    });

    const lead = leadsResponse.items.find((l) => {
      const match1 = l.whatsapp ? normalizePhoneForEvolution(l.whatsapp) === senderPhone : false;
      const match2 = l.phone ? normalizePhoneForEvolution(l.phone) === senderPhone : false;
      const match3 = l.phone_2 ? normalizePhoneForEvolution(l.phone_2) === senderPhone : false;
      return match1 || match2 || match3;
    });

    if (lead) {
      console.log(`Lead replied! Lead ID: ${lead.id}`);
      
      // Update lead status to "responded"
      await updateLeadsStatus(instance.user_id, [lead.id], "responded");

      // Cancel any pending automated messages for this lead
      await cancelPendingQueueForLead(lead.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no webhook da Evolution:", error);
    return NextResponse.json({ error: "Erro interno no webhook" }, { status: 500 });
  }
}
