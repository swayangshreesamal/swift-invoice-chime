import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { SiteHeader } from "@/components/SiteHeader";
import { lovable } from "@/integrations/lovable/index";
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
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

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
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created. Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in didn't work. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 pt-8 pb-12">
        <h1 className="font-display text-[1.8rem] font-semibold leading-tight tracking-tight">
          {mode === "signup" ? "Start getting paid on time." : "Welcome back."}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Free account, 3 invoices, no card needed."
            : "Log in to see your invoices and reminders."}
        </p>

        <form onSubmit={handleSubmit} className="card-paper mt-5 space-y-3 p-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-paper mt-1"
              placeholder="you@studio.com"
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
            />
          </label>
          <button type="submit" disabled={busy} className="btn-brand w-full py-3.5 text-[15px]">
            {busy ? "One moment…" : mode === "signup" ? "Create free account" : "Log in"}
          </button>
        </form>

        <button onClick={handleGoogle} className="btn-quiet mt-3 w-full py-3.5 text-[15px]">
          Continue with Google
        </button>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="font-semibold text-brand"
          >
            {mode === "signup" ? "Log in" : "Create one"}
          </button>
        </p>
      </main>
    </div>
  );
}
