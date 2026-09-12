import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { InvoiceForm, type InvoiceRow } from "@/components/InvoiceForm";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { daysOverdue, formatDate, formatMoney } from "@/lib/format";
import { triggerBatchReminders, triggerManualReminder } from "@/lib/reminder-actions";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your invoices — PayReminder" },
      {
        name: "description",
        content: "See what you're owed, which reminders went out, and mark invoices as paid.",
      },
      { property: "og:title", content: "Your invoices — PayReminder" },
      {
        property: "og:description",
        content: "See what you're owed, which reminders went out, and mark invoices as paid.",
      },
    ],
  }),
  component: Dashboard,
});

type Reminder = { invoice_id: string; stage: number; sent_at: string };

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [checkingBatch, setCheckingBatch] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const invoicesQuery = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InvoiceRow[];
    },
  });

  const remindersQuery = useQuery({
    queryKey: ["reminders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("reminders").select("invoice_id, stage, sent_at");
      if (error) throw error;
      return (data ?? []) as Reminder[];
    },
  });

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("plan").maybeSingle();
      if (error) throw error;
      return data as { plan: string } | null;
    },
  });

  const invoices = invoicesQuery.data ?? [];
  const reminders = remindersQuery.data ?? [];
  const plan = profileQuery.data?.plan ?? "free";
  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const outstanding = unpaid.reduce((sum, i) => sum + Number(i.amount), 0);
  const paidCount = invoices.length - unpaid.length;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["invoices", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["reminders", user?.id] });
  }

  async function markPaid(invoice: InvoiceRow) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoice.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${invoice.client_name} marked as paid`);
    refresh();
  }

  async function markUnpaid(invoice: InvoiceRow) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "unpaid", paid_at: null })
      .eq("id", invoice.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  }

  async function remove(invoice: InvoiceRow) {
    const { error } = await supabase.from("invoices").delete().eq("id", invoice.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invoice deleted");
    refresh();
  }

  async function handleSendSingle(invoice: InvoiceRow, stage: 3 | 7 | 14) {
    const key = `${invoice.id}-${stage}`;
    setSendingKey(key);
    try {
      const targetUserId = invoice.user_id || user?.id || "";
      const res = await triggerManualReminder({
        data: {
          invoiceId: invoice.id,
          stage,
          clientName: invoice.client_name,
          client_name: invoice.client_name,
          clientEmail: invoice.client_email,
          client_email: invoice.client_email,
          amount: Number(invoice.amount),
          dueDate: invoice.due_date,
          due_date: invoice.due_date,
          description: invoice.description,
          userId: targetUserId,
          user_id: targetUserId,
        },
      });
      if (!res.success) {
        toast.error(res.error || "Could not send reminder. Check email configuration.");
        return;
      }

      // Upsert reminder status in Supabase so dashboard badge updates immediately
      if (targetUserId) {
        try {
          await supabase.from("reminders").upsert(
            {
              invoice_id: invoice.id,
              user_id: targetUserId,
              stage,
              status: "sent",
              sent_at: new Date().toISOString(),
            },
            { onConflict: "invoice_id,stage" },
          );
        } catch (logErr) {
          console.warn("Could not save reminder log to database:", logErr);
        }
      }

      toast.success(`${stage}d reminder successfully emailed to ${invoice.client_email}`);
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminder");
    } finally {
      setSendingKey(null);
    }
  }

  async function handleBatchCheck() {
    setCheckingBatch(true);
    toast.info("Scanning invoices and dispatching pending reminders…");
    try {
      const res = await triggerBatchReminders({
        data: {
          invoices: unpaid.map((inv) => ({
            id: inv.id,
            user_id: inv.user_id || user?.id,
            client_name: inv.client_name,
            client_email: inv.client_email,
            amount: Number(inv.amount),
            due_date: inv.due_date,
            description: inv.description,
            status: inv.status,
          })),
        },
      });
      if (res.sentCount > 0) {
        toast.success(`Sent ${res.sentCount} overdue reminder email(s)!`);
      } else {
        toast.info(`Checked ${res.checkedCount} invoice(s). No new reminders needed.`);
      }
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error checking reminders");
    } finally {
      setCheckingBatch(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <p className="px-5 pt-10 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const atFreeLimit = plan === "free" && invoices.length >= 3;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader
        right={
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">
              {plan === "pro" ? "Pro plan" : "Free plan"}
            </span>
            <button
              className="font-mono text-xs text-muted-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
            >
              Log out
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl px-5 pb-14 pt-6">
        <div className="rounded-3xl border border-border bg-card/70 p-5">
          <div className="label-mono">Waiting to be paid</div>
          <div className="mt-1 font-display text-[2.9rem] font-semibold leading-none tracking-tight">
            {formatMoney(outstanding)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Across {unpaid.length} open {unpaid.length === 1 ? "invoice" : "invoices"} · {paidCount}{" "}
            paid
          </p>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold tracking-tight">Your invoices</h2>
          <div className="flex items-center gap-3">
            {unpaid.length > 0 ? (
              <button
                type="button"
                disabled={checkingBatch}
                className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                onClick={handleBatchCheck}
              >
                {checkingBatch ? "Checking…" : "⚡ Check & send reminders"}
              </button>
            ) : null}
            {!adding && !editing ? (
              <button
                className="font-mono text-xs text-brand"
                onClick={() => {
                  if (atFreeLimit) {
                    toast.error("Free plan holds 3 invoices — upgrade to Pro for unlimited.");
                    return;
                  }
                  setAdding(true);
                }}
              >
                + Add invoice
              </button>
            ) : null}
          </div>
        </div>

        {adding ? (
          <div className="mt-3">
            <InvoiceForm
              userId={user.id}
              onDone={() => {
                setAdding(false);
                refresh();
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : null}

        {editing ? (
          <div className="mt-3">
            <InvoiceForm
              userId={user.id}
              existing={editing}
              onDone={() => {
                setEditing(null);
                refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        ) : null}

        <div className="mt-3 space-y-3">
          {invoices.length === 0 && !adding ? (
            <div className="card-paper p-5 text-sm text-muted-foreground">
              No invoices yet. Adding one takes about 30 seconds.
            </div>
          ) : null}

          {invoices.map((invoice) => {
            const sent = reminders
              .filter((r) => r.invoice_id === invoice.id)
              .sort((a, b) => b.stage - a.stage);
            const overdue = daysOverdue(invoice.due_date);
            const isPaid = invoice.status === "paid";

            return (
              <div key={invoice.id} className="card-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold">{invoice.client_name}</p>
                      {isPaid ? (
                        <span className="rounded bg-sage-soft px-1.5 py-0.5 font-mono text-[10px] text-sage">
                          Paid
                        </span>
                      ) : sent.length > 0 ? (
                        <span className="rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] text-brand">
                          Sent · {sent[0]!.stage}d
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {invoice.description || invoice.client_email}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Due {formatDate(invoice.due_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-semibold">
                      {formatMoney(Number(invoice.amount))}
                    </p>
                    {!isPaid && overdue > 0 ? (
                      <p className="mt-0.5 text-[11px] font-medium text-brand">
                        Overdue {overdue}d
                      </p>
                    ) : null}
                  </div>
                </div>

                {sent.length > 0 ? (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Reminders sent:{" "}
                    {sent
                      .map((r) => `${r.stage}d`)
                      .reverse()
                      .join(" · ")}
                  </p>
                ) : null}

                {!isPaid ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Send email reminder:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={sendingKey === `${invoice.id}-3`}
                        onClick={() => handleSendSingle(invoice, 3)}
                        className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors disabled:opacity-50 ${
                          sent.some((r) => r.stage === 3)
                            ? "border-brand/40 bg-brand-soft/40 text-brand font-medium"
                            : "border-border hover:bg-muted text-foreground"
                        }`}
                        title="3 days overdue reminder (Polite)"
                      >
                        {sendingKey === `${invoice.id}-3` ? "Sending…" : "3d polite"}
                      </button>
                      <button
                        type="button"
                        disabled={sendingKey === `${invoice.id}-7`}
                        onClick={() => handleSendSingle(invoice, 7)}
                        className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors disabled:opacity-50 ${
                          sent.some((r) => r.stage === 7)
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 font-medium"
                            : "border-border hover:bg-muted text-foreground"
                        }`}
                        title="7 days overdue reminder (Firmer)"
                      >
                        {sendingKey === `${invoice.id}-7` ? "Sending…" : "7d firmer"}
                      </button>
                      <button
                        type="button"
                        disabled={sendingKey === `${invoice.id}-14`}
                        onClick={() => handleSendSingle(invoice, 14)}
                        className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors disabled:opacity-50 ${
                          sent.some((r) => r.stage === 14)
                            ? "border-destructive/40 bg-destructive/10 text-destructive font-medium"
                            : "border-border hover:bg-muted text-foreground"
                        }`}
                        title="14 days overdue reminder (Final notice)"
                      >
                        {sendingKey === `${invoice.id}-14` ? "Sending…" : "14d final"}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex gap-2">
                  {isPaid ? (
                    <button
                      onClick={() => markUnpaid(invoice)}
                      className="btn-quiet flex-1 py-2.5 text-[13px]"
                    >
                      Mark as unpaid
                    </button>
                  ) : (
                    <button
                      onClick={() => markPaid(invoice)}
                      className="btn-brand flex-1 py-2.5 text-[13px]"
                    >
                      Mark as paid
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setAdding(false);
                      setEditing(invoice);
                    }}
                    className="btn-quiet px-3 py-2.5 text-[13px]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(invoice)}
                    className="btn-quiet px-3 py-2.5 text-[13px] text-muted-foreground"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {plan !== "pro" ? (
          <div className="mt-6 rounded-2xl border-2 border-brand bg-brand-soft/40 p-4">
            <p className="font-display text-lg font-semibold">
              {atFreeLimit ? "You've filled your free plan" : "Want automatic reminders?"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pro is $19/month for unlimited invoices and reminders sent for you.
            </p>
            <Link
              to="/pricing"
              className="btn-brand mt-3 block w-full py-3 text-center text-[14px]"
            >
              Upgrade to Pro – $19/month
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}
