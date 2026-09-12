import { createClient } from "@supabase/supabase-js";
import { daysOverdue } from "./format";
import { sendReminderEmail, type ReminderStage } from "./email-service.server";
import type { Database } from "@/integrations/supabase/types";

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    "https://c--b6cb859b-e2fa-4610-9ae8-d4f367c75dd4-prod.lovable.cloud";
  // Prefer service role key if present, fallback to publishable key
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_Qf_4_y0Wcb8OpREEqVfngw_bHkMm2El";
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface ReminderJobResult {
  checkedCount: number;
  sentCount: number;
  results: Array<{
    invoiceId: string;
    clientName: string;
    clientEmail: string;
    stage: ReminderStage;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Scans all unpaid invoices and sends pending reminder emails for 3, 7, and 14 days overdue.
 */
export async function processAllOverdueReminders(
  customClient?: ReturnType<typeof getSupabaseAdmin>,
): Promise<ReminderJobResult> {
  const supabase = customClient || getSupabaseAdmin();

  // 1. Fetch all unpaid invoices
  const { data: invoices, error: invError } = await supabase
    .from("invoices")
    .select(
      "id, user_id, client_name, client_email, amount, invoice_date, due_date, description, status",
    )
    .eq("status", "unpaid");

  if (invError) {
    console.error("[ReminderRunner] Error fetching invoices:", invError);
    throw new Error(`Failed to fetch invoices: ${invError.message}`);
  }

  if (!invoices || invoices.length === 0) {
    return { checkedCount: 0, sentCount: 0, results: [] };
  }

  // 2. Fetch existing reminders to prevent duplicates
  const invoiceIds = invoices.map((i) => i.id);
  const { data: existingReminders, error: remError } = await supabase
    .from("reminders")
    .select("invoice_id, stage, status")
    .in("invoice_id", invoiceIds);

  if (remError) {
    console.warn("[ReminderRunner] Could not query reminders:", remError);
  }

  // Map of invoiceId -> Set of stages sent
  const sentMap = new Map<string, Set<number>>();
  for (const r of existingReminders || []) {
    if (!sentMap.has(r.invoice_id)) sentMap.set(r.invoice_id, new Set());
    sentMap.get(r.invoice_id)!.add(r.stage);
  }

  const results: ReminderJobResult["results"] = [];
  let sentCount = 0;

  for (const inv of invoices) {
    const overdue = daysOverdue(inv.due_date);
    const sentStages = sentMap.get(inv.id) || new Set();

    // Determine candidate stages
    const candidateStages: ReminderStage[] = [];
    if (overdue >= 14 && !sentStages.has(14)) {
      candidateStages.push(14);
    } else if (overdue >= 7 && !sentStages.has(7)) {
      candidateStages.push(7);
    } else if (overdue >= 3 && !sentStages.has(3)) {
      candidateStages.push(3);
    }

    // Process the most relevant overdue stage
    for (const stage of candidateStages) {
      console.log(
        `[ReminderRunner] Dispatching stage ${stage} reminder for invoice ${inv.id} (${inv.client_email})`,
      );

      const emailRes = await sendReminderEmail({
        clientName: inv.client_name,
        clientEmail: inv.client_email,
        amount: Number(inv.amount),
        dueDate: inv.due_date,
        description: inv.description,
        stage,
        daysOverdue: overdue,
      });

      if (emailRes.success) {
        sentCount++;
        // Record in reminders table
        await supabase.from("reminders").insert({
          invoice_id: inv.id,
          user_id: inv.user_id,
          stage,
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        results.push({
          invoiceId: inv.id,
          clientName: inv.client_name,
          clientEmail: inv.client_email,
          stage,
          success: true,
        });
      } else {
        results.push({
          invoiceId: inv.id,
          clientName: inv.client_name,
          clientEmail: inv.client_email,
          stage,
          success: false,
          error: emailRes.error,
        });
      }

      // One reminder per invoice per run to avoid spamming
      break;
    }
  }

  return {
    checkedCount: invoices.length,
    sentCount,
    results,
  };
}

export interface ManualInvoicePayload {
  clientName?: string;
  clientEmail?: string;
  amount?: number;
  dueDate?: string;
  description?: string | null;
  userId?: string;
}

/**
 * Manually dispatches a reminder for a specific invoice.
 */
export async function sendManualInvoiceReminder(
  invoiceId: string,
  stage: ReminderStage,
  payload?: ManualInvoicePayload,
  customClient?: ReturnType<typeof getSupabaseAdmin>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = customClient || getSupabaseAdmin();

  let clientName = payload?.clientName;
  let clientEmail = payload?.clientEmail;
  let amount = payload?.amount;
  let dueDate = payload?.dueDate;
  let description = payload?.description;
  let userId = payload?.userId;

  // If details were not provided in payload, query database
  if (!clientEmail || !clientName || !dueDate || amount === undefined) {
    const { data: inv, error: invError } = await supabase
      .from("invoices")
      .select(
        "id, user_id, client_name, client_email, amount, invoice_date, due_date, description, status",
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (inv) {
      clientName = inv.client_name;
      clientEmail = inv.client_email;
      amount = Number(inv.amount);
      dueDate = inv.due_date;
      description = inv.description;
      userId = inv.user_id;
    } else if (invError) {
      return { success: false, error: invError.message };
    }
  }

  if (!clientEmail || !clientName || !dueDate || amount === undefined) {
    return { success: false, error: "Invoice not found or missing client email." };
  }

  const overdue = daysOverdue(dueDate);

  const emailRes = await sendReminderEmail({
    clientName,
    clientEmail,
    amount,
    dueDate,
    description,
    stage,
    daysOverdue: Math.max(overdue, stage),
  });

  if (!emailRes.success) {
    return { success: false, error: emailRes.error };
  }

  // Record or update reminder status in database if user_id is available
  if (userId) {
    try {
      await supabase.from("reminders").upsert(
        {
          invoice_id: invoiceId,
          user_id: userId,
          stage,
          status: "sent",
          sent_at: new Date().toISOString(),
        },
        { onConflict: "invoice_id,stage" },
      );
    } catch (e) {
      console.warn("[ReminderRunner] Could not upsert reminder record:", e);
    }
  }

  return { success: true };
}
