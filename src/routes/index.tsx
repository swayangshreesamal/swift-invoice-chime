import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayReminder — Get paid without the awkward chase" },
      {
        name: "description",
        content:
          "Polite, automatic invoice reminders for freelancers and independent contractors. Add an invoice once; PayReminder sends gentle, escalating notices with direct payment links until you get paid.",
      },
      { property: "og:title", content: "PayReminder — Get paid without the awkward chase" },
      {
        property: "og:description",
        content:
          "Polite, automatic payment reminders for freelancers. Free for 3 invoices, $19/month for unlimited.",
      },
    ],
  }),
  component: Landing,
});

const stages = [
  {
    day: "3",
    tag: "Polite Nudge",
    tone: "text-sage border-sage/30 bg-sage-soft/30",
    quote: '"Just checking in on this invoice."',
    desc: "Gentle and friendly. Reminds the client that their payment was due, including clear settlement instructions.",
  },
  {
    day: "7",
    tag: "Firmer Notice",
    tone: "text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
    quote: '"This account is now 7 days overdue."',
    desc: "Professional and firm. Requests payment status or a remittance confirmation without damaging the relationship.",
  },
  {
    day: "14",
    tag: "Final Notice",
    tone: "text-destructive border-destructive/30 bg-destructive/10",
    quote: '"Immediate settlement required."',
    desc: "Urgent final notice. Highlights settlement details, who to pay, and any applicable late fee terms.",
  },
];

const faqs = [
  {
    q: "Does PayReminder take a cut or transaction fee from my invoices?",
    a: "No, never. PayReminder takes 0% commission. When your client pays via PayPal, UPI, Stripe, or Bank wire, the money goes 100% directly into your own accounts.",
  },
  {
    q: "How does the client know who and how to pay?",
    a: "Every reminder email includes a prominent, highlighted payment box showing your name or business name, exact amount due, due date, and your payment details (PayPal link, UPI ID, or bank wire details) with a 1-click 'Pay Online Now' button.",
  },
  {
    q: "What happens when my client finally pays?",
    a: "Simply click 'Mark as paid' on your dashboard. All future scheduled reminders for that invoice stop immediately.",
  },
  {
    q: "Can I show multiple payment methods (e.g. PayPal + UPI + Wire)?",
    a: "Yes! You can list multiple payment options in your payment instructions. PayReminder automatically detects web links (like PayPal.me or Stripe) and renders dedicated payment buttons for each.",
  },
  {
    q: "Why should I upgrade to Pro for $19/month?",
    a: "The Free plan lets you track up to 3 invoices with manual 1-click reminders. Pro unlocks unlimited invoices, automated daily cron runs (reminders sent on autopilot while you sleep), private client notes, and late fee warnings. Recovering just one $500 unpaid invoice pays for more than 2 full years of Pro!",
  },
  {
    q: "Can I cancel my Pro plan at any time?",
    a: "Yes, absolutely. You can cancel your subscription at any time with one click directly from your PayPal account, with no hidden fees or cancellation penalties.",
  },
];

function Landing() {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <SiteHeader
        right={
          <div className="flex items-center gap-3">
            <Link
              to="/pricing"
              className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              to={user ? "/dashboard" : "/auth"}
              className="font-mono text-xs text-brand hover:underline"
            >
              {user ? "Dashboard →" : "Log in"}
            </Link>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl pb-20">
        {/* Hero Section */}
        <section className="px-5 pt-10 sm:pt-14 pb-12 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand-soft/70 px-3.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand shadow-xs backdrop-blur-xs">
            <span>✨</span> For freelancers who hate chasing money
          </div>

          <h1 className="rise mt-5 text-balance font-display text-4xl sm:text-6xl lg:text-[4.15rem] font-bold leading-[1.04] tracking-[-0.035em] text-foreground">
            Stop chasing clients awkwardly.
            <br className="hidden sm:inline" />
            <span className="text-brand"> Let PayReminder do the knocking.</span>
          </h1>

          <p className="rise mt-6 max-w-xl text-pretty text-[17px] sm:text-[19px] leading-relaxed text-muted-foreground font-normal">
            Chasing overdue invoices is uncomfortable, wastes billable hours, and strains client relationships.
            PayReminder sends calm, escalating email reminders with your direct payment details — so you get paid on time without the stress.
          </p>

          <div className="rise mt-8 flex flex-col sm:flex-row gap-3.5 items-stretch sm:items-center">
            <Link
              to={user ? "/dashboard" : "/auth"}
              className="btn-brand px-7 py-4 text-center text-[15px] font-semibold shadow-md hover:shadow-lg transition-all"
            >
              Add your first invoice — Free
            </Link>
            <a href="#how" className="btn-quiet px-6 py-4 text-center text-[15px] font-medium shadow-xs">
              See how it works ↓
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5">
              <span className="text-brand font-bold">✓</span> 0% Platform Commission
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-brand font-bold">✓</span> Direct UPI, PayPal &amp; Bank Wire
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-brand font-bold">✓</span> 3 Invoices Free Forever
            </span>
          </div>

          {/* Visual Showcase: Sample Reminder Preview */}
          <div className="rise mt-10 rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-mono font-medium text-foreground">What Your Client Receives</span>
              </div>
              <span className="rounded-full bg-sage-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-sage">
                Stage 1 · Polite Nudge
              </span>
            </div>
            <div className="mt-3.5 space-y-2 text-left">
              <p className="text-xs text-muted-foreground">
                Subject: <span className="font-medium text-foreground">Friendly Reminder: Invoice for Acme Studio ($1,200.00)</span>
              </p>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                  <span>💳 HOW &amp; WHERE TO PAY</span>
                  <span className="font-mono text-sm">$1,200.00 DUE</span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-foreground/80">
                  PayPal: paypal.me/yourstudio · UPI: yourstudio@okaxis
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs">
                    Pay via PayPal →
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how" className="px-5 pt-4">
          <div className="card-elevated p-6 sm:p-8">
            <div className="label-mono text-brand">How it works in 3 calm steps</div>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-semibold tracking-tight">
              Set it up once. We handle the follow-ups.
            </h2>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border bg-background/80 p-5 shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand font-mono font-bold text-sm">
                  1
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">Add your invoice</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Enter client email, amount, due date, and your PayPal, UPI, or bank remittance details in 30 seconds.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/80 p-5 shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand font-mono font-bold text-sm">
                  2
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">Automatic follow-ups</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  If unpaid, PayReminder sends polite notices on Day 3, firmer on Day 7, and a final notice on Day 14.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/80 p-5 shadow-xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand font-mono font-bold text-sm">
                  3
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">Get paid directly</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Client clicks your payment link and pays you directly. Mark as paid in 1 click and reminders stop immediately.
                </p>
              </div>
            </div>

            {/* Visual Escalation Timeline */}
            <div className="mt-8 border-t border-border/60 pt-6">
              <div className="label-mono text-muted-foreground">The Escalation Progression</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {stages.map((s) => (
                  <div key={s.day} className={`rounded-2xl border p-4.5 shadow-xs ${s.tone}`}>
                    <div className="flex items-baseline justify-between">
                      <div className="font-display text-2xl font-semibold">
                        {s.day}
                        <small className="text-xs font-normal opacity-80"> days overdue</small>
                      </div>
                      <span className="font-mono text-[10px] font-semibold uppercase">{s.tag}</span>
                    </div>
                    <p className="mt-2 font-medium text-xs italic">{s.quote}</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed opacity-90">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Clear Free vs Pro Comparison */}
        <section className="px-5 pt-14 sm:pt-16">
          <div className="text-center sm:text-left">
            <div className="label-mono text-brand">Simple &amp; Honest Pricing</div>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-semibold tracking-tight">
              Start free. Upgrade when your business grows.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              💡 <strong>Why Pro pays for itself:</strong> Recovering just one $500 unpaid invoice pays for more than 2 full years of Pro.
            </p>
          </div>

          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Free Card */}
            <div className="card-paper flex flex-col justify-between p-6 sm:p-7 hover:border-border/90 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-semibold">Free Plan</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground font-medium">
                    Forever free
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1 font-display text-4xl font-bold tracking-tight">
                  $0
                  <span className="text-xs font-normal text-muted-foreground font-sans">/ month</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Perfect for freelancers starting out with a couple of active clients.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="text-brand font-semibold">✓</span> Up to 3 active invoices
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-brand font-semibold">✓</span> 1-click manual reminder sending
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-brand font-semibold">✓</span> Highlighted payment details in emails
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-brand font-semibold">✓</span> 0% commission on payments
                  </li>
                </ul>
              </div>

              <Link
                to={user ? "/dashboard" : "/auth"}
                className="btn-quiet mt-7 block w-full py-3 text-center text-xs font-semibold"
              >
                {user ? "Go to Dashboard" : "Start Free"}
              </Link>
            </div>

            {/* Pro Card */}
            <div className="card-pro flex flex-col justify-between p-6 sm:p-7 relative bg-gradient-to-b from-brand-soft/30 via-card to-card">
              <div className="absolute -top-3.5 right-6 rounded-full bg-brand px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-foreground shadow-md">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-semibold text-foreground">Pro Plan</span>
                  <span className="rounded-full bg-brand/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-brand">
                    Full Autopilot
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1 font-display text-4xl font-bold tracking-tight text-foreground">
                  $19
                  <span className="text-xs font-normal text-muted-foreground font-sans">/ month</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  For active freelancers and studios with consistent client work.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-foreground/90">
                  <li className="flex items-center gap-2 font-medium">
                    <span className="text-brand font-bold">✓</span> <strong>Unlimited</strong> active invoices
                  </li>
                  <li className="flex items-center gap-2 font-medium">
                    <span className="text-brand font-bold">✓</span> <strong>Automatic daily reminders</strong> (cron runs daily)
                  </li>
                  <li className="flex items-center gap-2 font-medium">
                    <span className="text-brand font-bold">✓</span> <strong>Multiple payment options</strong> &amp; 1-click links
                  </li>
                  <li className="flex items-center gap-2 font-medium">
                    <span className="text-brand font-bold">✓</span> <strong>Private client notes</strong> (track quirks)
                  </li>
                  <li className="flex items-center gap-2 font-medium">
                    <span className="text-brand font-bold">✓</span> <strong>Late fee warnings</strong> on final notices
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-brand font-semibold">✓</span> Cancel anytime in 1 click from PayPal
                  </li>
                </ul>
              </div>

              <Link
                to="/pricing"
                className="btn-brand mt-7 block w-full py-3 text-center text-xs font-semibold shadow-md hover:shadow-lg transition-all"
              >
                Upgrade to Pro — $19/mo
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-5 pt-16">
          <div className="label-mono text-brand text-center sm:text-left">Got questions?</div>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-center sm:text-left">
            Frequently Asked Questions
          </h2>

          <div className="mt-6 space-y-3">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border/80 bg-card p-4.5 transition-all shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between text-left text-sm font-semibold"
                  >
                    <span>{item.q}</span>
                    <span className="ml-2 font-mono text-muted-foreground text-xs">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {isOpen ? (
                    <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground border-t border-border/50 pt-2.5">
                      {item.a}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="mt-16 px-5">
          <div className="card-pro p-8 sm:p-10 text-center bg-gradient-to-b from-brand-soft/50 via-card to-card">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Ready to stop feeling awkward about overdue invoices?
            </h2>
            <p className="mt-2.5 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Join freelancers who let PayReminder handle follow-ups while they focus on their craft.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                to={user ? "/dashboard" : "/auth"}
                className="btn-brand px-8 py-4 text-[15px] font-semibold shadow-md hover:shadow-lg transition-all"
              >
                Add your first invoice — It&apos;s free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-4 border-t border-border px-5 py-8 text-center">
        <p className="font-mono text-xs text-muted-foreground">
          PayReminder — Calm invoice follow-ups for independent creators and freelancers.
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/80">
          Zero commission. Direct payments. Friendly knocking.
        </p>
      </footer>
    </div>
  );
}

