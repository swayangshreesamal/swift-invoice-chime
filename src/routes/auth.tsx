import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, RefreshCw, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Log in or sign up — PayReminder" },
      {
        name: "description",
        content: "Create a free PayReminder account and start tracking invoices in seconds.",
      },
      { property: "og:title", content: "Log in or sign up — PayReminder" },
      {
        property: "og:description",
        content: "Create a free PayReminder account and start tracking invoices in seconds.",
      },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationSentEmail, setVerificationSentEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;

        if (data?.session) {
          toast.success("Account created! Redirecting to dashboard…");
          navigate({ to: "/dashboard" });
        } else {
          // Email confirmation is required
          setVerificationSentEmail(parsed.data.email);
          toast.success("Verification link sent! Check your inbox to verify your email.", {
            duration: 10000,
          });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
            setVerificationSentEmail(parsed.data.email);
            toast.error("Please verify your email from your inbox before logging in.", {
              duration: 10000,
            });
            return;
          }
          throw error;
        }

        if (data?.session) {
          toast.success("Welcome back!");
          navigate({ to: "/dashboard" });
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      if (msg.toLowerCase().includes("email not confirmed") || msg.toLowerCase().includes("not confirmed")) {
        setVerificationSentEmail(parsed.data.email);
        toast.error("Please verify your email from your inbox before logging in.", {
          duration: 10000,
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!verificationSentEmail || resendCooldown > 0 || resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: verificationSentEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      toast.success("Fresh verification link sent! Please check your inbox.", {
        duration: 8000,
      });
      setResendCooldown(60);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend email");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 pt-8 pb-12">
        {verificationSentEmail ? (
          /* Verification Notification Screen */
          <div className="card-paper mt-2 p-6 sm:p-7 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5">
              <Mail className="size-7" />
            </div>

            <h1 className="font-display mt-5 text-[1.75rem] font-semibold tracking-tight text-foreground">
              Verify your email address
            </h1>

            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              We sent a verification link to{" "}
              <span className="font-medium text-foreground underline decoration-border underline-offset-2">
                {verificationSentEmail}
              </span>
              . Please open your inbox and click the link to activate your account.
            </p>

            <div className="mt-5 rounded-xl border border-border/80 bg-muted/30 p-3.5 text-left text-xs leading-relaxed text-muted-foreground">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">Don't see it? </span>
                  Check your spam or junk folder. Emails usually arrive within a minute.
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
                className="btn-brand w-full py-3 text-[14.5px] flex items-center justify-center gap-2"
              >
                <RefreshCw className={`size-4 ${resending ? "animate-spin" : ""}`} />
                {resending
                  ? "Sending link…"
                  : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend verification email"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setVerificationSentEmail(null);
                  setMode("signin");
                }}
                className="btn-quiet w-full py-2.5 text-xs text-muted-foreground flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="size-3.5" />
                Back to Log in
              </button>
            </div>
          </div>
        ) : (
          /* Normal Auth Form */
          <>
            <h1 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight">
              {mode === "signup" ? "Start getting paid on time." : "Welcome back."}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signup"
                ? "Free account, 3 invoices, no card needed."
                : "Log in to see your invoices and reminders."}
            </p>

            <form onSubmit={handleSubmit} className="card-paper mt-5 space-y-3.5 p-5">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-paper mt-1"
                  placeholder="you@studio.com"
                  required
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Password</span>
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-paper mt-1"
                  placeholder="At least 6 characters"
                  required
                />
              </label>

              <button type="submit" disabled={busy} className="btn-brand w-full py-3.5 text-[15px] mt-1">
                {busy ? "One moment…" : mode === "signup" ? "Create free account" : "Log in"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className="font-semibold text-brand hover:underline underline-offset-2"
              >
                {mode === "signup" ? "Log in" : "Create one"}
              </button>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
