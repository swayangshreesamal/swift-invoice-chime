import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import {
  cleanDescription,
  unpackInvoiceMetadata,
  saveLocalInvoiceMeta,
  getLocalInvoiceMeta,
} from "@/lib/invoice-metadata";

export type InvoiceRow = {
  id: string;
  user_id?: string;
  client_name: string;
  client_email: string;
  amount: number;
  invoice_date: string;
  due_date: string;
  description: string | null;
  payment_details?: string | null;
  client_notes?: string | null;
  late_fee?: string | null;
  status: string;
};

const schema = z.object({
  client_name: z.string().trim().min(1, "Client name is required").max(120),
  client_email: z.string().trim().email("Client email doesn't look right").max(255),
  amount: z.number().positive("Amount must be more than zero").max(10_000_000),
  invoice_date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().min(1, "Due date is required"),
  description: z.string().trim().max(300).optional(),
  payment_details: z.string().trim().max(1000).optional(),
  client_notes: z.string().trim().max(500).optional(),
  late_fee: z.string().trim().max(120).optional(),
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inTwoWeeks() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function InvoiceForm({
  userId,
  existing,
  defaultPaymentDetails,
  onDone,
  onCancel,
}: {
  userId: string;
  existing?: InvoiceRow;
  defaultPaymentDetails?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const initialUnpacked = unpackInvoiceMetadata(existing?.description);
  const initialLocal = existing?.id ? getLocalInvoiceMeta(existing.id) : {};

  const [clientName, setClientName] = useState(existing?.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(existing?.client_email ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [invoiceDate, setInvoiceDate] = useState(existing?.invoice_date ?? today());
  const [dueDate, setDueDate] = useState(existing?.due_date ?? inTwoWeeks());
  const [description, setDescription] = useState(
    initialUnpacked.cleanDescription,
  );
  const [paymentDetails, setPaymentDetails] = useState(
    existing?.payment_details ||
      initialUnpacked.payment_details ||
      initialLocal.payment_details ||
      defaultPaymentDetails ||
      "",
  );
  const [clientNotes, setClientNotes] = useState(
    existing?.client_notes ||
      initialUnpacked.client_notes ||
      initialLocal.client_notes ||
      "",
  );
  const [lateFee, setLateFee] = useState(
    existing?.late_fee ||
      initialUnpacked.late_fee ||
      initialLocal.late_fee ||
      "",
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse({
      client_name: clientName,
      client_email: clientEmail,
      amount: Number(amount),
      invoice_date: invoiceDate,
      due_date: dueDate,
      description: description || undefined,
      payment_details: paymentDetails || undefined,
      client_notes: clientNotes || undefined,
      late_fee: lateFee || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    setBusy(true);
    const cleanDesc = description ? cleanDescription(description) || null : null;
    const values = {
      ...parsed.data,
      description: cleanDesc,
      payment_details: parsed.data.payment_details ?? null,
      client_notes: parsed.data.client_notes ?? null,
      late_fee: parsed.data.late_fee ?? null,
    };

    // 1. Attempt standard insert/update with all dedicated columns
    let result = existing
      ? await supabase.from("invoices").update(values).eq("id", existing.id).select()
      : await supabase.from("invoices").insert({ ...values, user_id: userId }).select();

    let error = result.error;
    let savedInvoice = result.data?.[0];

    // 2. Resilient fallback: if extended columns fail in Supabase schema cache, fallback to core fields (clean description!)
    if (
      error &&
      (error.message?.includes("column") ||
        error.message?.includes("schema cache") ||
        (error as any).code === "PGRST204" ||
        error.message?.includes("payment_details") ||
        error.message?.includes("client_notes") ||
        error.message?.includes("late_fee"))
    ) {
      console.warn(
        "Extended columns not present in Supabase schema cache. Falling back to core columns with clean description.",
      );

      const coreValues = {
        client_name: parsed.data.client_name,
        client_email: parsed.data.client_email,
        amount: parsed.data.amount,
        invoice_date: parsed.data.invoice_date,
        due_date: parsed.data.due_date,
        description: cleanDesc,
      };

      const retry = existing
        ? await supabase.from("invoices").update(coreValues).eq("id", existing.id).select()
        : await supabase.from("invoices").insert({ ...coreValues, user_id: userId }).select();

      error = retry.error;
      savedInvoice = retry.data?.[0];
    }

    setBusy(false);

    if (error) {
      toast.error(
        error.message.includes("Free plan")
          ? "The free plan holds 3 invoices. Upgrade to Pro for unlimited."
          : error.message,
      );
      return;
    }

    // Persist metadata locally and to Supabase Auth user_metadata
    const invoiceId = existing?.id || savedInvoice?.id;
    if (invoiceId) {
      const meta = {
        payment_details: parsed.data.payment_details?.trim() || null,
        client_notes: parsed.data.client_notes?.trim() || null,
        late_fee: parsed.data.late_fee?.trim() || null,
      };

      saveLocalInvoiceMeta(invoiceId, meta);

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const existingMeta =
            (authData.user.user_metadata?.invoices_meta as Record<string, any>) || {};
          await supabase.auth.updateUser({
            data: {
              invoices_meta: {
                ...existingMeta,
                [invoiceId]: meta,
              },
            },
          });
        }
      } catch (syncErr) {
        console.warn("Could not sync invoice metadata to user_metadata:", syncErr);
      }
    }

    // Also sync default payment details to Auth user metadata if provided
    if (parsed.data.payment_details && !defaultPaymentDetails) {
      try {
        await supabase.auth.updateUser({
          data: { payment_details: parsed.data.payment_details },
        });
      } catch (authErr) {
        console.warn("Could not sync user_metadata payment_details:", authErr);
      }
    }

    toast.success(existing ? "Invoice updated" : "Invoice saved — reminders are set");
    onDone();
  }

  return (
    <form onSubmit={submit} className="card-elevated space-y-4 p-5 sm:p-7 shadow-sm border border-border/80">
      <div className="border-b border-border/50 pb-3">
        <h3 className="font-display text-lg font-bold text-foreground">
          {existing ? "Edit Invoice Details" : "New Client Invoice"}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {existing
            ? "Update invoice amounts, dates, or payment settlement instructions."
            : "Enter client details and your preferred payout methods."}
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-foreground/90">Client name</span>
        <input
          className="field-paper mt-1.5"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Acme Studio or Sarah Jenkins"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-foreground/90">Client email</span>
        <input
          type="email"
          className="field-paper mt-1.5"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="billing@client.com"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="block">
          <span className="text-xs font-semibold text-foreground/90">Amount ($ USD)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="field-paper mt-1.5 font-display font-semibold text-base"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1500"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-foreground/90">Invoice date</span>
          <input
            type="date"
            className="field-paper mt-1.5"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-foreground/90">Due date</span>
        <input
          type="date"
          className="field-paper mt-1.5 font-medium"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-foreground/90">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </span>
        <input
          className="field-paper mt-1.5"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Brand identity & website design package"
        />
      </label>

      {/* Payment Details Field */}
      <label className="block">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
            <span>Payment details <span className="font-normal text-muted-foreground">(how client should pay)</span></span>
          </span>
          {defaultPaymentDetails && !existing ? (
            <span className="text-[10px] font-mono text-brand font-medium">Pre-filled from defaults</span>
          ) : null}
        </div>
        <textarea
          rows={2}
          className="field-paper mt-1.5 font-mono text-xs leading-relaxed"
          value={paymentDetails}
          onChange={(e) => setPaymentDetails(e.target.value)}
          placeholder="e.g. PayPal: https://paypal.me/yourname or UPI: yourname@okaxis or Bank: Wire Routing #123456, Acct #789012"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          💡 Highlighted in reminder emails. URLs (like PayPal.me or Stripe) automatically generate 1-click payment buttons.
        </p>
      </label>

      {/* Late Fee Option */}
      <label className="block">
        <span className="text-xs font-semibold text-foreground/90">
          Late fee policy <span className="font-normal text-muted-foreground">(optional — stated on 14-day notice)</span>
        </span>
        <input
          className="field-paper mt-1.5"
          value={lateFee}
          onChange={(e) => setLateFee(e.target.value)}
          placeholder="e.g. 5% late fee ($75) or $50 overdue charge"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Warns the client if their invoice exceeds 14 days overdue.
        </p>
      </label>

      {/* Private Client Notes */}
      <label className="block">
        <span className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
          <span>🔒 Private client notes <span className="font-normal text-muted-foreground">(only visible to you)</span></span>
        </span>
        <input
          className="field-paper mt-1.5"
          value={clientNotes}
          onChange={(e) => setClientNotes(e.target.value)}
          placeholder="e.g. Usually pays 5 days late; prefers UPI; contact finance at accounting@client.com"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Saved privately on your dashboard to help you remember client tendencies. Never emailed to client.
        </p>
      </label>

      <div className="flex gap-2.5 pt-2">
        <button type="submit" disabled={busy} className="btn-brand flex-1 py-3 text-sm font-semibold shadow-xs">
          {busy ? "Saving…" : existing ? "Save changes" : "Save & start reminders"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="btn-quiet px-5 py-3 text-sm font-semibold"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
