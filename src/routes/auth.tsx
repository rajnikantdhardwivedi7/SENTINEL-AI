import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/sentinel/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Sign in — SENTINEL AI" },
      { name: "description", content: "Sign in or create a SENTINEL AI account to manage incidents and investigations." },
      { property: "og:title", content: "Sign in — SENTINEL AI" },
      { property: "og:description", content: "Access your SENTINEL AI workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/incidents";
  try {
    const u = new URL(p, window.location.origin);
    if (u.origin !== window.location.origin) return "/incidents";
    return u.pathname + u.search;
  } catch {
    return "/incidents";
  }
}

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ href: safePath(redirect), replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ href: safePath(redirect), replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, redirect]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/incidents", data: { display_name: name.trim(), join_code: code.trim() } },
        });
        if (error) throw error;
        if (!data.session) setNotice("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setNotice("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    const res = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (res.error) toast.error(res.error.message ?? "Sign-in failed");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-grid px-4">
      <div className="w-full max-w-sm rounded-lg border bg-surface p-6 shadow-glow">
        <Logo />
        <h1 className="mt-6 text-lg font-medium">{mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signup" ? "New accounts get their own organization with simulated infrastructure. Have an invite code? Enter it to join a team." : mode === "forgot" ? "We'll email you a reset link." : "Welcome back."}
        </p>

        {mode !== "forgot" && (
          <div className="mt-5 space-y-2">
            <button type="button" onClick={() => oauth("google")} className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border px-3 text-sm font-medium" style={{ background: "#131314", borderColor: "#8E918F", color: "#E3E3E3" }}>
              <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
              Continue with Google
            </button>
            <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>Continue with Lovable</button>
            <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          </div>
        )}

        <form onSubmit={submit} className="mt-3 space-y-3">
          {mode === "signup" && (
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
          )}
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          {mode !== "forgot" && (
            <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></div>
          )}
          {mode === "signup" && (
            <div className="space-y-1.5"><Label htmlFor="code">Invite code <span className="text-muted-foreground">(optional)</span></Label><Input id="code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} className="font-mono uppercase" /></div>
          )}
          {notice && <p className="rounded-md border bg-elevated p-2 text-xs text-foreground">{notice}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}</Button>
        </form>

        <div className="mt-4 flex justify-between text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>
              <button onClick={() => setMode("forgot")} className="hover:text-foreground">Forgot password?</button>
              <button onClick={() => setMode("signup")} className="hover:text-foreground">Create account</button>
            </>
          ) : (
            <button onClick={() => setMode("signin")} className="hover:text-foreground">← Back to sign in</button>
          )}
        </div>
        <Link to="/dashboard" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">Continue to the demo without an account</Link>
      </div>
    </div>
  );
}
