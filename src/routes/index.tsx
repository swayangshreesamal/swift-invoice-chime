import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayReminder — get paid without the awkward chase" },
      {
        name: "description",
        content:
          "Add an invoice once and PayReminder emails your client a polite reminder after 3 days, a firmer one after 7, and a final notice after 14.",
      },
      { property: "og:title", content: "PayReminder — get paid without the awkward chase" },
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
  { day: "3", tone: "text-sage", text: 'A polite nudge. "Just checking in on this."' },
  { day: "7", tone: "text-brand", text: 'A firmer note. "This is now overdue."' },
  { day: "14", tone: "text-ink", text: "A final notice. Calm, but clear." },
];

function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <SiteHeader
        right={
          <Link
            to={user ? "/dashboard" : "/auth"}
            className="font-mono text-xs text-muted-foreground"
          >
            {user ? "Dashboard" : "Log in"}
          </Link>
        }
      />

      <main className="mx-auto max-w-3xl pb-12">
        <section className="px-5 pt-7 pb-6">
          <p className="rise font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
            For freelancers who hate chasing money
          </p>
          <h1 className="rise mt-3 text-balance font-display text-[2.1rem] font-semibold leading-[1.05] tracking-tight">
            We knock politely, then a little firmer.
          </h1>
          <p className="rise mt-3 max-w-[34ch] text-pretty text-[15px] leading-relaxed text-muted-foreground">
            Add an invoice once. PayReminder sends gentle, on-schedule reminders so your clients pay
            you — and you never have to awkwardly ask.
          </p>
          <div className="rise mt-5 flex gap-3">
            <Link
              to={user ? "/dashboard" : "/auth"}
              className="btn-brand flex-1 px-5 py-3.5 text-center text-[15px]"
            >
              Add your first invoice
            </Link>
            <a href="#how" className="btn-quiet px-4 py-3.5 text-[15px]">
              See how it works
            </a>
          </div>
        </section>

        <div id="how" className="px-5">
          <div className="rounded-3xl border border-border bg-brand-soft p-5">
            <div className="label-mono">The knock, over time</div>
            <div className="mt-4 flex items-stretch gap-2">
              {stages.map((s) => (
                <div key={s.day} className="flex-1 rounded-2xl border border-border bg-card/70 p-3">
                  <div className={`font-display text-2xl font-semibold leading-none ${s.tone}`}>
                    {s.day}
                    <small className="text-sm font-medium text-muted-foreground"> d</small>
                  </div>
                  <p className="mt-2 text-xs leading-snug">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="px-5 pt-9">
          <h2 className="font-display text-xl font-semibold tracking-tight">Simple pricing</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="card-paper p-4">
              <div className="font-display text-lg font-semibold">Free</div>
              <p className="mt-1 font-display text-2xl font-semibold">$0</p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
                <li>Up to 3 invoices</li>
                <li>Manual reminders</li>
              </ul>
              <Link
                to={user ? "/dashboard" : "/auth"}
                className="btn-quiet mt-4 block w-full py-2.5 text-center text-[13px]"
              >
                Start free
              </Link>
            </div>
            <div className="rounded-2xl border-2 border-brand bg-brand-soft/40 p-4">
              <div className="font-display text-lg font-semibold">Pro</div>
              <p className="mt-1 font-display text-2xl font-semibold">
                $19<span className="text-sm font-medium text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-[13px]">
                <li>Unlimited invoices</li>
                <li>Automatic reminders</li>
              </ul>
              <Link
                to="/pricing"
                className="btn-brand mt-4 block w-full py-2.5 text-center text-[13px]"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-4 border-t border-border px-5 py-6">
        <p className="text-center font-mono text-[11px] text-muted-foreground">
          PayReminder — get paid, without the awkward part.
        </p>
      </footer>
    </div>
  );
}
