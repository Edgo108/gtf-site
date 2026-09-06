"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm({
  mode,
  userId,
}: {
  mode: "forced" | "voluntary";
  userId: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setLoading(false);
      setError("Impossible de changer le mot de passe. Réessayez.");
      return;
    }

    if (mode === "forced") {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ doit_changer_mdp: false })
        .eq("id", userId);

      setLoading(false);

      if (profileError) {
        setError("Mot de passe changé, mais une erreur est survenue. Contactez un administrateur.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
      return;
    }

    setLoading(false);
    setSuccess(true);
    setPassword("");
    setConfirm("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-72 flex-col gap-4">
      <div>
        <label
          htmlFor="new-password"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
        >
          Nouveau mot de passe
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
        >
          Confirmer le mot de passe
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded bg-gtf-blue px-4 py-2 text-xs font-medium uppercase tracking-widest text-gtf-text transition-colors hover:bg-gtf-blue-hover disabled:opacity-60"
      >
        {loading ? "..." : "Valider"}
      </button>

      {error && (
        <p role="alert" className="text-xs text-gtf-red">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-gtf-green">Mot de passe mis à jour.</p>
      )}
    </form>
  );
}
