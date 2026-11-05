import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/sentinel/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — SENTINEL AI" },
      { name: "description", content: "Choose a new password for your SENTINEL AI account." },
      { property: "og:title", content: "Set a new password — SENTINEL AI" },
      { property: "og:description", content: "Reset your SENTINEL AI password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/incidents", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-grid px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-surface/80 p-6">
        <Logo />
        <h1 className="text-lg font-medium">Set a new password</h1>
        <div className="space-y-1.5"><Label htmlFor="pw">New password</Label><Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
      </form>
    </div>
  );
}
