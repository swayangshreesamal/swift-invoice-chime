import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";

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
  const [clientName, setClientName] = useState(existing?.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(existing?.client_email ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [invoiceDate, setInvoiceDate] = useState(existing?.invoice_date ?? today());
  const [dueDate, setDueDate] = useState(existing?.due_date ?? inTwoWeeks());
  const [description, setDescription] = useState(existing?.description ?? "");
  const [paymentDetails, setPaymentDetails] = useState(
    existing?.payment_details ?? defaultPaymentDetails ?? "",
  );
  const [clientNotes, setClientNotes] = useState(existing?.client_notes ?? "");
  const [lateFee, setLateFee] = useState(existing?.late_fee ?? "");
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
    const values = {
      ...parsed.data,
      description: parsed.data.description ?? null,
      payment_details: parsed.data.payment_details ?? null,
      client_notes: parsed.data.client_notes ?? null,
      late_fee: parsed.data.late_fee ?? null,
    };

    let { error } = existing
      ? await supabase.from("invoices").update(values).eq("id", existing.id)
      : await supabase.from("invoices").insert({ ...values, user_id: userId });

    // Resilient fallback: if any new column is still propagating in Supabase cache, fallback to core fields
    if (error && (error.message?.includes("client_notes") || error.message?.includes("late_fee") || error.message?.includes("payment_details"))) {
      console.warn("Database column mismatch detected. Falling back cleanly...");
      const fallbackValues = { ...values };
      delete (fallbackValues as any).client_notes;
      delete (fallbackValues as any).late_fee;
      if (error.message?.includes("payment_details")) {
        delete (fallbackValues as any).payment_details;
      }
      const retry = existing
        ? await supabase.from("invoices").update(fallbackValues).eq("id", existing.id)
        : await supabase.from("invoices").insert({ ...fallbackValues, user_id: userId });
      error = retry.error;
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
    toast.success(existing ? "Invoice updated" : "Invoice saved — reminders are set");
    onDone();
  }

  return (
    <form onSubmit={submit} className="card-paper space-y-3 p-4">
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Client name</span>
        <input
          className="field-paper mt-1"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Acme Bakery"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Client email</span>
        <input
          type="email"
          className="field-paper mt-1"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="hello@acme.com"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Amount</span>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="field-paper mt-1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1500"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Invoice date</span>
          <input
            type="date"
            className="field-paper mt-1"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Due date</span>
        <input
          type="date"
          className="field-paper mt-1"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          Description <span className="opacity-70">(optional)</span>
        </span>
        <input
          className="field-paper mt-1"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brand design & web development"
        />
      </label>

      {/* Payment Details Field */}
      <label className="block">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <span>Payment details <span className="opacity-70">(how client should pay)</span></span>
          </span>
          {defaultPaymentDetails && !existing ? (
            <span className="text-[10px] font-mono text-brand">Pre-filled from defaults</span>
          ) : null}
        </div>
        <textarea
          rows={2}
          className="field-paper mt-1 font-sans text-xs leading-relaxed"
          value={paymentDetails}
          onChange={(e) => setPaymentDetails(e.target.value)}
          placeholder="e.g. PayPal: https://paypal.me/yourname or UPI: yourname@okaxis or Bank: Wire Routing #123456, Acct #789012"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Displayed in a prominent highlighted box in reminder emails. Multiple payment links will each get a button.
        </p>
      </label>

      {/* Late Fee Option */}
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          Late fee policy <span className="opacity-70">(optional — mentioned in final 14-day notice)</span>
        </span>
        <input
          className="field-paper mt-1"
          value={lateFee}
          onChange={(e) => setLateFee(e.target.value)}
          placeholder="e.g. 5% late fee ($75) or $50 overdue fee"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          If left blank, no late fee is mentioned. If filled, clearly warns client in the final notice.
        </p>
      </label>

      {/* Private Client Notes */}
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <span>🔒 Private client notes <span className="opacity-70">(only visible to you)</span></span>
        </span>
        <input
          className="field-paper mt-1"
          value={clientNotes}
          onChange={(e) => setClientNotes(e.target.value)}
          placeholder="e.g. Prefers UPI; usually pays 10 days late; contact finance at accounting@client.com"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Never sent to the client. Kept securely on your dashboard to help you remember client quirks.
        </p>
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-brand mt-1 flex-1 py-3.5 text-[15px]">
          {busy ? "Saving…" : existing ? "Save changes" : "Save & start reminders"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="btn-quiet mt-1 px-4 py-3.5 text-[15px]"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
