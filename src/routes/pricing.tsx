import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PayReminder" },
      {
        name: "description",
        content:
          "Track 3 invoices free, or go Pro for $19 a month for unlimited invoices and automatic payment reminders.",
      },
      { property: "og:title", content: "Pricing — PayReminder" },
      {
        property: "og:description",
        content: "Free for 3 invoices. Pro is $19/month for unlimited invoices and reminders.",
      },
    ],
  }),
  component: Pricing,
});

const PLAN_ID = "P-7PU30395VJ1727507NKR4O6I";
const CONTAINER_ID = `paypal-button-container-${PLAN_ID}`;
const SDK_SRC =
  "https://www.paypal.com/sdk/js?client-id=BAAfpgWRrENfXXGQJoTHPUKITKxodhLascJ8diMsirEGX-Ir_5LzF1w2X-QVATX404EVMEfD3nuFE0r24o&vault=true&intent=subscription";

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        style?: Record<string, string>;
        createSubscription: (
          data: unknown,
          actions: { subscription: { create: (options: { plan_id: string }) => Promise<string> } },
        ) => Promise<string>;
        onApprove: (data: { subscriptionID: string }) => Promise<void> | void;
        onCancel?: (data?: unknown) => void;
        onError?: (err: unknown) => void;
      }) => {
        render: (container: string) => void;
      };
    };
  }
}

function Pricing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const rendered = useRef(false);
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("plan")
      .maybeSingle()
      .then(({ data }) => setPlan(data?.plan ?? "free"));
  }, [user]);

  useEffect(() => {
    if (loading || !user || plan === "pro" || rendered.current) return;

    function render() {
      if (rendered.current || !window.paypal) return;
      const node = document.getElementById(CONTAINER_ID);
      if (!node) return;
      rendered.current = true;
      node.innerHTML = "";
      window.paypal
        .Buttons({
          style: { shape: "rect", color: "gold", layout: "vertical", label: "subscribe" },
          createSubscription: (_data, actions) => actions.subscription.create({ plan_id: PLAN_ID }),
          onApprove: async (data) => {
            const { error } = await supabase
              .from("profiles")
              .update({ plan: "pro", paypal_subscription_id: data.subscriptionID })
              .eq("id", user!.id);
            if (error) {
              toast.error("Payment went through, but we couldn't switch your plan. Contact us.");
              return;
            }
            setPlan("pro");
            toast.success("You're on Pro — unlimited invoices unlocked.");
            navigate({ to: "/dashboard" });
          },
          onCancel: () => {
            toast.info("PayPal subscription checkout was cancelled.");
          },
          onError: (err: unknown) => {
            console.error("[PayPal Error Details]:", err);
            const errMessage =
              err instanceof Error
                ? err.message
                : typeof err === "string"
                  ? err
                  : "PayPal couldn't complete that. Please try again.";
            toast.error(errMessage);
          },
        })
        .render(`#${CONTAINER_ID}`);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (window.paypal) {
      render();
    } else if (existing) {
      existing.addEventListener("load", render);
    } else {
      const script = document.createElement("script");
      script.src = SDK_SRC;
      script.async = true;
      script.setAttribute("data-sdk-integration-source", "button-factory");
      script.addEventListener("load", render);
      document.body.appendChild(script);
    }
  }, [loading, user, plan, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
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

      <main className="mx-auto max-w-xl px-5 pb-14 pt-7">
        <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight">
          One calm price, no surprises.
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Start free with 3 invoices. When the chasing adds up, Pro handles it for you.
        </p>

        <div className="card-paper mt-6 p-5">
          <div className="font-display text-lg font-semibold">Free</div>
          <p className="mt-1 font-display text-3xl font-semibold">$0</p>
          <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
            <li>Track up to 3 invoices</li>
            <li>Dashboard and paid/unpaid tracking</li>
          </ul>
        </div>

        <div className="mt-4 rounded-2xl border-2 border-brand bg-brand-soft/40 p-5">
          <div className="font-display text-lg font-semibold">Pro</div>
          <p className="mt-1 font-display text-3xl font-semibold">
            $19<span className="text-sm font-medium text-muted-foreground">/month</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-[13px]">
            <li>Unlimited invoices</li>
            <li>Automatic reminders after 3, 7 and 14 days</li>
            <li>Cancel any time from PayPal</li>
          </ul>

          <div className="mt-5">
            {plan === "pro" ? (
              <p className="rounded-xl bg-sage-soft px-4 py-3 text-center text-sm text-sage">
                You're already on Pro. Thank you!
              </p>
            ) : !user ? (
              <Link to="/auth" className="btn-brand block w-full py-3 text-center text-[14px]">
                Create an account to upgrade
              </Link>
            ) : (
              <div id={CONTAINER_ID} />
            )}
          </div>
        </div>

        <p className="mt-5 text-center font-mono text-[11px] text-muted-foreground">
          Payments handled securely by PayPal.
        </p>
      </main>
    </div>
  );
}
