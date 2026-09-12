import { createClient } from "@supabase/supabase-js";
import { daysOverdue } from "./format";
import { sendReminderEmail, type ReminderStage } from "./email-service.server";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function getSupabaseAdmin() {
  const url =
    process.env["SUPABASE_URL"] ||
    "https://c--b6cb859b-e2fa-4610-9ae8-d4f367c75dd4-prod.lovable.cloud";
  const key =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    "sb_publishable_Qf_4_y0Wcb8OpREEqVfngw_bHkMm2El";
  return createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
    },
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

export interface InvoiceCandidate {
  id: string;
  user_id?: string;
  client_name: string;
  client_email: string;
  amount: number | string;
  due_date: string;
  description?: string | null;
  status?: string;
  payment_details?: string | null;
  freelancer_name?: string | null;
}

/**
 * Scans all unpaid invoices and sends pending reminder emails for 3, 7, and 14 days overdue.
 */
export async function processAllOverdueReminders(
  customInvoices?: InvoiceCandidate[],
  customClient?: ReturnType<typeof getSupabaseAdmin>,
): Promise<ReminderJobResult> {
  const supabase = customClient || getSupabaseAdmin();

  let invoices: InvoiceCandidate[] = (customInvoices || []).filter(
    (i) => i.status === "unpaid" || !i.status,
  );

  // If invoices were not supplied directly by client caller, query database
  if (!invoices || invoices.length === 0) {
    try {
      const { data, error: invError } = await supabase
        .from("invoices")
        .select(
          "id, user_id, client_name, client_email, amount, invoice_date, due_date, description, status, payment_details",
        )
        .eq("status", "unpaid");

      if (invError) {
        console.error("[ReminderRunner] Error fetching invoices:", invError);
      } else {
        invoices = (data ?? []) as InvoiceCandidate[];
      }
    } catch (e) {
      console.warn("[ReminderRunner] Failed to fetch invoices from Supabase:", e);
    }
  }

  if (!invoices || invoices.length === 0) {
    return { checkedCount: 0, sentCount: 0, results: [] };
  }

  // Fetch existing reminders to prevent duplicate notices
  const invoiceIds = invoices.map((i) => i.id);
  const sentMap = new Map<string, Set<number>>();

  try {
    const { data: existingReminders, error: remError } = await supabase
      .from("reminders")
      .select("invoice_id, stage, status")
      .in("invoice_id", invoiceIds);

    if (remError) {
      console.warn("[ReminderRunner] Could not query reminders:", remError);
    } else {
      for (const r of existingReminders || []) {
        if (!sentMap.has(r.invoice_id)) sentMap.set(r.invoice_id, new Set());
        sentMap.get(r.invoice_id)!.add(r.stage);
      }
    }
  } catch (e) {
    console.warn("[ReminderRunner] Error reading reminders history:", e);
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
        description: inv.description ?? null,
        stage,
        daysOverdue: overdue,
        freelancerName: inv.freelancer_name ?? null,
        paymentDetails: inv.payment_details ?? null,
      });

      if (emailRes.success) {
        sentCount++;
        // Record in reminders table
        try {
          await supabase.from("reminders").insert({
            invoice_id: inv.id,
            user_id: inv.user_id || "",
            stage,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn("[ReminderRunner] Sent email but could not log reminder to DB:", dbErr);
        }

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
  client_name?: string;
  clientEmail?: string;
  client_email?: string;
  amount?: number | string;
  dueDate?: string;
  due_date?: string;
  description?: string | null;
  userId?: string;
  user_id?: string;
  paymentDetails?: string | null;
  payment_details?: string | null;
  freelancerName?: string | null;
  freelancer_name?: string | null;
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

  let clientEmail = (payload?.clientEmail || payload?.client_email || "").trim();
  let clientName = (payload?.clientName || payload?.client_name || "").trim();
  const rawAmount = payload?.amount;
  let amount: number | undefined =
    rawAmount !== undefined && rawAmount !== null ? Number(rawAmount) : undefined;
  let dueDate = (payload?.dueDate || payload?.due_date || "").trim();
  let description = payload?.description ?? null;
  let userId = payload?.userId || payload?.user_id;
  let paymentDetails = (payload?.paymentDetails || payload?.payment_details || "").trim();
  let freelancerName = (payload?.freelancerName || payload?.freelancer_name || "").trim();

  // If email or details were not passed in payload, query database for details
  if (!clientEmail || !paymentDetails) {
    try {
      const { data: inv, error: invError } = await supabase
        .from("invoices")
        .select(
          "id, user_id, client_name, client_email, amount, invoice_date, due_date, description, status, payment_details",
        )
        .eq("id", invoiceId)
        .maybeSingle();

      if (inv) {
        if (!clientName) clientName = inv.client_name;
        if (!clientEmail) clientEmail = inv.client_email;
        if (amount === undefined) amount = Number(inv.amount);
        if (!dueDate) dueDate = inv.due_date;
        if (!description) description = inv.description;
        if (!userId) userId = inv.user_id;
        if (!paymentDetails && inv.payment_details) paymentDetails = inv.payment_details;
      } else if (invError) {
        console.warn("[sendManualInvoiceReminder] Supabase query returned error:", invError.message);
      }
    } catch (dbErr) {
      console.warn("[sendManualInvoiceReminder] Failed to query Supabase:", dbErr);
    }
  }

  // If payment details or freelancer name still missing, try querying profile
  if (userId && (!paymentDetails || !freelancerName)) {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, payment_details")
        .eq("id", userId)
        .maybeSingle();

      if (prof) {
        if (!paymentDetails && prof.payment_details) paymentDetails = prof.payment_details;
        if (!freelancerName && prof.full_name) freelancerName = prof.full_name;
      }
    } catch (profErr) {
      console.warn("[sendManualInvoiceReminder] Could not query profile:", profErr);
    }
  }

  // Ensure clientEmail exists and is valid
  if (!clientEmail || !clientEmail.includes("@")) {
    return { success: false, error: "Invoice not found or missing client email." };
  }

  // Default fallbacks for non-critical metadata
  if (!clientName) {
    clientName = clientEmail.split("@")[0] || "Valued Client";
  }
  if (!dueDate) {
    dueDate = new Date().toISOString().slice(0, 10);
  }
  if (amount === undefined || isNaN(amount)) {
    amount = 0;
  }
  if (!freelancerName) {
    freelancerName = "PayReminder Freelancer";
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
    freelancerName,
    paymentDetails,
  });

  if (!emailRes.success) {
    return { success: false, error: emailRes.error || "Failed to send email via SMTP." };
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
