import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";

export type InvoiceRow = {
  id: string;
  client_name: string;
  client_email: string;
  amount: number;
  invoice_date: string;
  due_date: string;
  description: string | null;
  status: string;
};

const schema = z.object({
  client_name: z.string().trim().min(1, "Client name is required").max(120),
  client_email: z.string().trim().email("Client email doesn't look right").max(255),
  amount: z.number().positive("Amount must be more than zero").max(10_000_000),
  invoice_date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().min(1, "Due date is required"),
  description: z.string().trim().max(300).optional(),
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
  onDone,
  onCancel,
}: {
  userId: string;
  existing?: InvoiceRow;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [clientName, setClientName] = useState(existing?.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(existing?.client_email ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [invoiceDate, setInvoiceDate] = useState(existing?.invoice_date ?? today());
  const [dueDate, setDueDate] = useState(existing?.due_date ?? inTwoWeeks());
  const [description, setDescription] = useState(existing?.description ?? "");
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
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    setBusy(true);
    const values = { ...parsed.data, description: parsed.data.description ?? null };
    const { error } = existing
      ? await supabase.from("invoices").update(values).eq("id", existing.id)
      : await supabase.from("invoices").insert({ ...values, user_id: userId });
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
          placeholder="Brand design"
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-brand mt-1 flex-1 py-3.5 text-[15px]">
          {busy ? "Saving…" : existing ? "Save changes" : "Save & start reminders"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="btn-quiet mt-1 px-4 py-3.5 text-[15px]">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
