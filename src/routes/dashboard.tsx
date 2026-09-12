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
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("plan, payment_details, full_name")
          .maybeSingle();
        if (!error && data) {
          return {
            plan: data.plan || "free",
            payment_details:
              data.payment_details || (user?.user_metadata?.payment_details as string) || "",
            full_name: data.full_name || (user?.user_metadata?.full_name as string) || "",
          };
        }
      } catch (e) {
        console.warn("Could not query profiles table directly:", e);
      }
      return {
        plan: "free",
        payment_details: (user?.user_metadata?.payment_details as string) || "",
        full_name: (user?.user_metadata?.full_name as string) || "",
      };
    },
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [defaultFullName, setDefaultFullName] = useState("");
  const [defaultPaymentDetails, setDefaultPaymentDetails] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (profileQuery.data) {
      if (profileQuery.data.full_name !== undefined) {
        setDefaultFullName(profileQuery.data.full_name);
      }
      if (profileQuery.data.payment_details !== undefined) {
        setDefaultPaymentDetails(profileQuery.data.payment_details);
      }
    }
  }, [profileQuery.data]);

  const invoices = invoicesQuery.data ?? [];
  const reminders = remindersQuery.data ?? [];
  const plan = profileQuery.data?.plan ?? "free";
  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const outstanding = unpaid.reduce((sum, i) => sum + Number(i.amount), 0);
  const paidCount = invoices.length - unpaid.length;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["invoices", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["reminders", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
  }

  async function handleSaveProfileDefaults(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      // 1. Save to Auth user metadata (always accessible)
      await supabase.auth.updateUser({
        data: {
          full_name: defaultFullName.trim(),
          payment_details: defaultPaymentDetails.trim(),
        },
      });

      // 2. Also try updating profiles table
      try {
        await supabase
          .from("profiles")
          .update({
            full_name: defaultFullName.trim(),
            payment_details: defaultPaymentDetails.trim(),
          })
          .eq("id", user.id);
      } catch (profileErr) {
        console.warn("Profiles table update skipped/failed:", profileErr);
      }

      toast.success("Default payment details saved!");
      setEditingProfile(false);
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save payment details");
    } finally {
      setSavingProfile(false);
    }
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

  const [testingEmail, setTestingEmail] = useState(false);

  async function handleSendTest() {
    const recipient = user?.email || "sswayamsree@gmail.com";
    setTestingEmail(true);
    toast.info(`Sending test email to ${recipient}…`);
    try {
      const res = await fetch(`/api/reminders/test?to=${encodeURIComponent(recipient)}`);
      const data = await res.json();
      if (data.ok) {
        toast.success(
          `Test email delivered to ${recipient}! If not in Primary, please check your Spam/Promotions folder.`,
          { duration: 8000 },
        );
      } else {
        toast.error(data.error || "Failed to send test email. Check email configuration.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error testing email");
    } finally {
      setTestingEmail(false);
    }
  }

  async function handleSendSingle(invoice: InvoiceRow, stage: 3 | 7 | 14) {
    const key = `${invoice.id}-${stage}`;
    setSendingKey(key);
    try {
      const targetUserId = invoice.user_id || user?.id || "";
      const resolvedPayment =
        invoice.payment_details || profileQuery.data?.payment_details || defaultPaymentDetails || "";
      const resolvedName =
        profileQuery.data?.full_name ||
        defaultFullName ||
        user?.email?.split("@")[0] ||
        "PayReminder Freelancer";

      const payload = {
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
        paymentDetails: resolvedPayment,
        payment_details: resolvedPayment,
        freelancerName: resolvedName,
        freelancer_name: resolvedName,
      };

      let success = false;
      let errorMsg: string | undefined;

      // Primary attempt: direct /api/reminders/send endpoint
      try {
        const response = await fetch("/api/reminders/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (data.success) {
          success = true;
        } else {
          errorMsg = data.error;
        }
      } catch {
        // Secondary fallback: TanStack Start RPC
        try {
          const res = await triggerManualReminder({ data: payload });
          if (res.success) {
            success = true;
          } else {
            errorMsg = res.error;
          }
        } catch (rpcErr) {
          errorMsg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
        }
      }

      if (!success) {
        toast.error(errorMsg || "Could not send reminder. Check email configuration.");
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

      toast.success(
        `${stage}d reminder sent to ${invoice.client_email}! (Check inbox & Spam folder)`,
        { duration: 7000 },
      );
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
      const resolvedPayment = profileQuery.data?.payment_details || defaultPaymentDetails || "";
      const resolvedName =
        profileQuery.data?.full_name ||
        defaultFullName ||
        user?.email?.split("@")[0] ||
        "PayReminder Freelancer";

      const invoicePayload = unpaid.map((inv) => ({
        id: inv.id,
        user_id: inv.user_id || user?.id,
        client_name: inv.client_name,
        client_email: inv.client_email,
        amount: Number(inv.amount),
        due_date: inv.due_date,
        description: inv.description,
        status: inv.status,
        payment_details: inv.payment_details || resolvedPayment,
        freelancer_name: resolvedName,
      }));

      let res: { sentCount: number; checkedCount: number } | null = null;
      try {
        const response = await fetch("/api/reminders/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoices: invoicePayload }),
        });
        const data = await response.json();
        if (data.ok && data.result) {
          res = data.result;
        }
      } catch {
        res = await triggerBatchReminders({ data: { invoices: invoicePayload } });
      }

      if (res && res.sentCount > 0) {
        toast.success(`Sent ${res.sentCount} overdue reminder email(s)! Check inbox and Spam.`, {
          duration: 7000,
        });
      } else if (res) {
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

        {/* Default Payment Details Card */}
        <div className="mt-4 rounded-2xl border border-border bg-card/70 p-4 transition-all">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">💳</span>
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Your Default Payment Details</h3>
                <p className="text-xs text-muted-foreground">
                  Shown clearly in all reminder emails so clients know who and how to pay.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingProfile((prev) => !prev)}
              className="rounded-lg border border-border px-2.5 py-1 font-mono text-xs text-brand hover:bg-brand-soft/40 transition-colors"
            >
              {editingProfile ? "Close" : defaultPaymentDetails ? "Edit details" : "+ Add details"}
            </button>
          </div>

          {editingProfile ? (
            <form onSubmit={handleSaveProfileDefaults} className="mt-4 space-y-3 border-t border-border/50 pt-3">
              <div>
                <label className="block text-xs font-medium text-foreground">
                  Your Name or Business Name <span className="text-muted-foreground font-normal">(Who to pay)</span>
                </label>
                <input
                  type="text"
                  value={defaultFullName}
                  onChange={(e) => setDefaultFullName(e.target.value)}
                  placeholder="e.g. Alex Rivera or Rivera Design Studio"
                  className="input-paper mt-1 w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">
                  Default Payment Instructions <span className="text-muted-foreground font-normal">(How to pay)</span>
                </label>
                <textarea
                  rows={3}
                  value={defaultPaymentDetails}
                  onChange={(e) => setDefaultPaymentDetails(e.target.value)}
                  placeholder="e.g. PayPal: https://paypal.me/alexrivera or UPI: alex@okhdfcbank or Bank: Chase Checking Acct #123456789, Routing #987654321"
                  className="input-paper mt-1 w-full font-mono text-xs leading-relaxed"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  💡 Tip: If you include a link (e.g. https://paypal.me/... or Stripe payment link), reminder emails will include a 1-click &ldquo;Pay Online Now&rdquo; button!
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="btn-quiet px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn-brand px-4 py-1.5 text-xs font-medium"
                >
                  {savingProfile ? "Saving…" : "Save Default Details"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-3 rounded-xl bg-muted/40 p-3 border border-border/30 text-xs">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold text-foreground">Who to pay:</span>
                <span className="text-muted-foreground font-medium">
                  {defaultFullName || user?.email?.split("@")[0] || "PayReminder Freelancer"}
                </span>
              </div>
              <div className="mt-1.5">
                <span className="font-semibold text-foreground">How to pay:</span>
                {defaultPaymentDetails ? (
                  <div className="mt-1 whitespace-pre-wrap rounded bg-background/80 p-2 font-mono text-[11px] text-foreground border border-border/40">
                    {defaultPaymentDetails}
                  </div>
                ) : (
                  <span className="ml-1 text-muted-foreground italic">
                    No payment details set yet. Click &ldquo;+ Add details&rdquo; to add your PayPal, UPI, or bank wire.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold tracking-tight">Your invoices</h2>
          <div className="flex items-center gap-3">
            {unpaid.length > 0 ? (
              <button
                type="button"
                disabled={checkingBatch}
                className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                onClick={handleBatchCheck}
              >
                {checkingBatch ? "Checking…" : "⚡ Check & send"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={testingEmail}
              className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              onClick={handleSendTest}
              title="Send a sample email to verify delivery to your inbox"
            >
              {testingEmail ? "Sending test…" : "✉ Test delivery"}
            </button>
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
              defaultPaymentDetails={profileQuery.data?.payment_details || defaultPaymentDetails}
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
              defaultPaymentDetails={profileQuery.data?.payment_details || defaultPaymentDetails}
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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Due {formatDate(invoice.due_date)}
                      </span>
                      {invoice.payment_details ? (
                        <span
                          className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 border border-border/50"
                          title="Custom payment details specified for this invoice"
                        >
                          💳 Custom payment info
                        </span>
                      ) : null}
                    </div>
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
