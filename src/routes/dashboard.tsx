import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { InvoiceForm, type InvoiceRow } from "@/components/InvoiceForm";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { daysOverdue, formatDate, formatMoney } from "@/lib/format";
import { resolveInvoice } from "@/lib/invoice-metadata";
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
  const [showProWelcome, setShowProWelcome] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("upgraded") === "true" || params.get("success") === "true") {
        setShowProWelcome(true);
        // Clean URL query param without refreshing
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

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
      let plan = "free";
      let payment_details = (user?.user_metadata?.payment_details as string) || "";
      let full_name = (user?.user_metadata?.full_name as string) || "";

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("plan, payment_details, full_name")
          .maybeSingle();
        if (!error && data) {
          plan = data.plan || "free";
          if (data.payment_details) payment_details = data.payment_details;
          if (data.full_name) full_name = data.full_name;
          return { plan, payment_details, full_name };
        }

        // Fallback to querying just plan if extended columns don't exist
        const { data: planData } = await supabase
          .from("profiles")
          .select("plan")
          .maybeSingle();
        if (planData?.plan) {
          plan = planData.plan;
        }
      } catch (e) {
        console.warn("Could not query profiles table directly:", e);
      }
      return {
        plan,
        payment_details,
        full_name,
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

  const userInvoicesMeta = user?.user_metadata?.invoices_meta as
    | Record<string, any>
    | undefined;
  const rawInvoices = invoicesQuery.data ?? [];
  const resolvedPaymentDefault = profileQuery.data?.payment_details || defaultPaymentDetails;
  const invoices = useMemo(
    () => rawInvoices.map((inv) => resolveInvoice(inv, resolvedPaymentDefault, userInvoicesMeta)),
    [rawInvoices, resolvedPaymentDefault, userInvoicesMeta],
  );
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
        lateFee: invoice.late_fee,
        late_fee: invoice.late_fee,
        clientNotes: invoice.client_notes,
        client_notes: invoice.client_notes,
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
      toast.error(err instanceof Error ? err.message : "Failed to trigger reminder");
    } finally {
      setSendingKey(null);
    }
  }

  function getReminderText(invoice: InvoiceRow) {
    const payee =
      profileQuery.data?.full_name ||
      defaultFullName ||
      user?.email?.split("@")[0] ||
      "Freelancer";
    const payment =
      invoice.payment_details ||
      profileQuery.data?.payment_details ||
      defaultPaymentDetails ||
      "";
    return `Hi ${invoice.client_name},

Hope you are having a good week!

Just a gentle follow-up regarding the invoice for ${formatMoney(Number(invoice.amount))}, which was due on ${invoice.due_date}.

Payment Details:
${payment || "Please let me know if you need bank or remittance details."}

Thank you,
${payee}`;
  }

  function handleOpenGmail(invoice: InvoiceRow) {
    const subject = `Invoice Reminder: ${invoice.client_name} (${formatMoney(Number(invoice.amount))})`;
    const body = getReminderText(invoice);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invoice.client_email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
    toast.success("Opening reminder draft in Gmail!");
  }

  function handleOpenWhatsApp(invoice: InvoiceRow) {
    const text = getReminderText(invoice);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  function handleCopyReminder(invoice: InvoiceRow) {
    const text = getReminderText(invoice);
    navigator.clipboard.writeText(text);
    toast.success("Reminder text copied to clipboard!");
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
        late_fee: inv.late_fee,
        client_notes: inv.client_notes,
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
        {showProWelcome ? (
          <div className="mb-5 rounded-2xl border-2 border-brand bg-brand-soft/70 p-4 text-foreground shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎉</span>
                <div>
                  <h3 className="font-display text-base font-semibold text-brand">
                    Welcome to PayReminder Pro!
                  </h3>
                  <p className="mt-0.5 text-xs text-foreground/80 leading-relaxed">
                    Your PayPal subscription is active! Unlimited invoices and automatic reminder checks are now fully unlocked for your account.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProWelcome(false)}
                className="font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                ✕ Close
              </button>
            </div>
          </div>
        ) : null}

        {/* Total Outstanding Summary Card */}
        <div className="card-elevated p-6 sm:p-8 bg-gradient-to-br from-card via-card to-brand-soft/20 border border-border/80 rounded-3xl relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-brand/5 blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-brand animate-pulse" />
              <span className="label-mono font-bold text-brand tracking-widest">Waiting to be paid</span>
            </div>
            <span className="rounded-full bg-brand-soft/80 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-brand">
              {unpaid.length} open {unpaid.length === 1 ? "invoice" : "invoices"}
            </span>
          </div>
          <div className="mt-3 font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-none tracking-[-0.03em] text-foreground">
            {formatMoney(outstanding)}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/60 text-xs">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-2 rounded-full bg-amber-500" />
                <span>{unpaid.length} Pending settlement</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-2 rounded-full bg-sage" />
                <span>{paidCount} Collected</span>
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground/80">
              {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"} total
            </span>
          </div>
        </div>

        {/* Default Payment Details Card */}
        <div className="card-paper p-5 sm:p-6 mt-4 shadow-xs border border-border/80 transition-all">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand text-lg shadow-2xs">
                💳
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground">Default Payment Instructions</h3>
                <p className="text-xs text-muted-foreground">
                  Shown clearly in all reminder notices so clients have direct 1-click settlement options.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingProfile((prev) => !prev)}
              className="btn-quiet px-3.5 py-1.5 font-mono text-xs text-brand hover:bg-brand-soft/40 transition-colors shadow-2xs"
            >
              {editingProfile ? "Close" : defaultPaymentDetails ? "Edit details" : "+ Add details"}
            </button>
          </div>

          {editingProfile ? (
            <form onSubmit={handleSaveProfileDefaults} className="mt-4 space-y-3.5 border-t border-border/50 pt-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Your Name or Business Name <span className="text-muted-foreground font-normal">(Who to pay)</span>
                </label>
                <input
                  type="text"
                  value={defaultFullName}
                  onChange={(e) => setDefaultFullName(e.target.value)}
                  placeholder="e.g. Alex Rivera or Rivera Design Studio"
                  className="field-paper mt-1.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground">
                  Default Payment Instructions <span className="text-muted-foreground font-normal">(How to pay)</span>
                </label>
                <textarea
                  rows={3}
                  value={defaultPaymentDetails}
                  onChange={(e) => setDefaultPaymentDetails(e.target.value)}
                  placeholder="e.g. PayPal: https://paypal.me/alexrivera or UPI: alex@okhdfcbank or Bank: Chase Checking Acct #123456789, Routing #987654321"
                  className="field-paper mt-1.5 font-mono text-xs leading-relaxed"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  💡 Tip: If you include a link (e.g. https://paypal.me/... or Stripe payment link), reminder emails will include a 1-click &ldquo;Pay Online Now&rdquo; button!
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="btn-quiet px-3.5 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn-brand px-4 py-2 text-xs font-semibold shadow-xs"
                >
                  {savingProfile ? "Saving…" : "Save Default Details"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 rounded-xl bg-muted/30 p-4 border border-border/40 text-xs space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold text-foreground/80 font-mono text-[11px] uppercase tracking-wider">
                  Who to pay:
                </span>
                <span className="font-semibold text-foreground">
                  {defaultFullName || user?.email?.split("@")[0] || "PayReminder Freelancer"}
                </span>
              </div>
              <div className="pt-2 border-t border-border/30">
                <span className="font-semibold text-foreground/80 font-mono text-[11px] uppercase tracking-wider">
                  Payment Details:
                </span>
                {defaultPaymentDetails ? (
                  <div className="mt-1.5 whitespace-pre-wrap rounded-lg bg-card p-3 font-mono text-xs text-foreground border border-border/50 shadow-2xs leading-relaxed">
                    {defaultPaymentDetails}
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground italic text-xs">
                    No payment details set yet. Click &ldquo;+ Add details&rdquo; to add your PayPal, UPI, or bank wire.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Invoices Header Bar */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Your invoices</h2>
          <div className="flex items-center gap-2.5">
            {unpaid.length > 0 ? (
              <button
                type="button"
                disabled={checkingBatch}
                className="rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 shadow-2xs"
                onClick={handleBatchCheck}
              >
                {checkingBatch ? "Checking…" : "⚡ Check & send"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={testingEmail}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 shadow-2xs"
              onClick={handleSendTest}
              title="Send a sample email to verify delivery to your inbox"
            >
              {testingEmail ? "Sending test…" : "✉ Test delivery"}
            </button>
            {!adding && !editing ? (
              <button
                className="btn-brand px-3.5 py-1.5 text-xs font-semibold shadow-xs"
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
          <div className="mt-4">
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
          <div className="mt-4">
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

        {/* Invoice Cards List */}
        <div className="mt-4 space-y-4">
          {invoices.length === 0 && !adding ? (
            <div className="card-paper p-8 sm:p-12 text-center border-dashed border-2 border-border/80 bg-card/60 shadow-xs">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand text-2xl shadow-xs">
                🧾
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-foreground">
                No invoices added yet
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Add your first client invoice in under 30 seconds. PayReminder will automatically track the due date and politely follow up if payment is delayed.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (atFreeLimit) {
                      toast.error("Free plan holds 3 invoices — upgrade to Pro for unlimited.");
                      return;
                    }
                    setAdding(true);
                  }}
                  className="btn-brand px-6 py-3 text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  + Add your first invoice
                </button>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground font-mono">
                <span>✓ 3 Invoices Free</span>
                <span>·</span>
                <span>✓ 0% Platform Fee</span>
                <span>·</span>
                <span>✓ Direct Payments</span>
              </div>
            </div>
          ) : null}

          {invoices.map((invoice) => {
            const sent = reminders
              .filter((r) => r.invoice_id === invoice.id)
              .sort((a, b) => b.stage - a.stage);
            const overdue = daysOverdue(invoice.due_date);
            const isPaid = invoice.status === "paid";

            return (
              <div
                key={invoice.id}
                className="card-paper p-5 sm:p-6 transition-all duration-200 hover:shadow-md hover:border-border/90"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                        {invoice.client_name}
                      </p>
                      {isPaid ? (
                        <span className="rounded-full bg-sage-soft px-2.5 py-0.5 font-mono text-[10px] font-bold text-sage uppercase tracking-wider">
                          Paid
                        </span>
                      ) : sent.length > 0 ? (
                        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 font-mono text-[10px] font-bold text-brand uppercase tracking-wider">
                          Sent · {sent[0]!.stage}d
                        </span>
                      ) : overdue > 0 ? (
                        <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-destructive uppercase tracking-wider">
                          Overdue {overdue}d
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-muted-foreground font-normal">
                      {invoice.description || invoice.client_email}
                    </p>

                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <span>📅</span> Due {formatDate(invoice.due_date)}
                      </span>
                      {invoice.payment_details ? (
                        <span
                          className="rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[10px] text-foreground/80 border border-border/50 font-medium"
                          title="Custom payment details specified for this invoice"
                        >
                          💳 Custom payment info
                        </span>
                      ) : null}
                      {invoice.late_fee ? (
                        <span
                          className="rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-400 border border-amber-500/30 font-medium"
                          title={`Late fee specified: ${invoice.late_fee}`}
                        >
                          ⚡ Late fee: {invoice.late_fee}
                        </span>
                      ) : null}
                    </div>

                    {invoice.client_notes ? (
                      <div className="mt-2.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground border border-border/40 flex items-start gap-2">
                        <span className="text-xs select-none">🔒</span>
                        <span>
                          <strong className="text-foreground/90 font-semibold">Private note:</strong>{" "}
                          {invoice.client_notes}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      {formatMoney(Number(invoice.amount))}
                    </p>
                    {!isPaid && overdue > 0 ? (
                      <p className="mt-0.5 text-xs font-semibold text-destructive">
                        {overdue} days past due
                      </p>
                    ) : !isPaid ? (
                      <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                        Awaiting due date
                      </p>
                    ) : null}
                  </div>
                </div>

                {sent.length > 0 ? (
                  <div className="mt-3 rounded-lg bg-muted/20 px-3 py-1.5 border border-border/30">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Reminders dispatched:{" "}
                      {sent
                        .map((r) => `${r.stage}d notice`)
                        .reverse()
                        .join(" → ")}
                    </p>
                  </div>
                ) : null}

                {!isPaid ? (
                  <div className="mt-4 border-t border-border/60 pt-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground font-medium">
                        Automatic reminder notice:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={sendingKey === `${invoice.id}-3`}
                          onClick={() => handleSendSingle(invoice, 3)}
                          className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold transition-all disabled:opacity-50 ${
                            sent.some((r) => r.stage === 3)
                              ? "border-brand/40 bg-brand-soft/60 text-brand shadow-2xs"
                              : "border-border hover:bg-muted text-foreground shadow-2xs"
                          }`}
                          title="3 days overdue reminder (Polite)"
                        >
                          {sendingKey === `${invoice.id}-3` ? "Sending…" : "3d polite"}
                        </button>
                        <button
                          type="button"
                          disabled={sendingKey === `${invoice.id}-7`}
                          onClick={() => handleSendSingle(invoice, 7)}
                          className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold transition-all disabled:opacity-50 ${
                            sent.some((r) => r.stage === 7)
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 shadow-2xs"
                              : "border-border hover:bg-muted text-foreground shadow-2xs"
                          }`}
                          title="7 days overdue reminder (Firmer)"
                        >
                          {sendingKey === `${invoice.id}-7` ? "Sending…" : "7d firmer"}
                        </button>
                        <button
                          type="button"
                          disabled={sendingKey === `${invoice.id}-14`}
                          onClick={() => handleSendSingle(invoice, 14)}
                          className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold transition-all disabled:opacity-50 ${
                            sent.some((r) => r.stage === 14)
                              ? "border-destructive/40 bg-destructive/15 text-destructive shadow-2xs"
                              : "border-border hover:bg-muted text-foreground shadow-2xs"
                          }`}
                          title="14 days overdue reminder (Final notice)"
                        >
                          {sendingKey === `${invoice.id}-14` ? "Sending…" : "14d final"}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground font-mono">
                      <span>Or send yourself:</span>
                      <button
                        type="button"
                        onClick={() => handleOpenGmail(invoice)}
                        className="hover:text-brand hover:underline transition-colors flex items-center gap-1 font-medium"
                        title="Open pre-filled draft in your personal Gmail (100% inbox deliverability)"
                      >
                        ✉ Gmail
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsApp(invoice)}
                        className="hover:text-emerald-600 hover:underline transition-colors flex items-center gap-1 font-medium"
                        title="Send reminder via WhatsApp"
                      >
                        💬 WhatsApp
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => handleCopyReminder(invoice)}
                        className="hover:text-foreground hover:underline transition-colors flex items-center gap-1 font-medium"
                        title="Copy reminder text to clipboard"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex gap-2.5 pt-1">
                  {isPaid ? (
                    <button
                      onClick={() => markUnpaid(invoice)}
                      className="btn-quiet flex-1 py-2.5 text-xs font-semibold"
                    >
                      Mark as unpaid
                    </button>
                  ) : (
                    <button
                      onClick={() => markPaid(invoice)}
                      className="btn-brand flex-1 py-2.5 text-xs font-semibold shadow-xs"
                    >
                      Mark as paid
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setAdding(false);
                      setEditing(invoice);
                    }}
                    className="btn-quiet px-4 py-2.5 text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(invoice)}
                    className="btn-quiet px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/30"
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
