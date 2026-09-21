"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";
import { Spinner } from "@/components/ui/Spinner";
import { btn, fieldClass, labelClass } from "@/lib/ui/styles";
import { NETWORK_ERROR_MESSAGE } from "@/lib/ui/use-action-runner";

export function ChangePasswordForm({
  mode,
  userId,
}: {
  mode: "forced" | "voluntary";
  userId: string;
}) {
  const router = useRouter();
  const toast = useToast();
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

    let updateError: unknown = null;
    try {
      ({ error: updateError } = await supabase.auth.updateUser({ password }));
    } catch {
      setLoading(false);
      setError(NETWORK_ERROR_MESSAGE);
      toast.error(NETWORK_ERROR_MESSAGE);
      return;
    }

    if (updateError) {
      setLoading(false);
      const message = "Impossible de changer le mot de passe. Réessayez.";
      setError(message);
      toast.error(message);
      return;
    }

    if (mode === "forced") {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ doit_changer_mdp: false })
        .eq("id", userId);

      setLoading(false);

      if (profileError) {
        const message =
          "Mot de passe changé, mais une erreur est survenue. Contactez un administrateur.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("Mot de passe mis à jour");
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setLoading(false);
    toast.success("Mot de passe mis à jour");
    setSuccess(true);
    setPassword("");
    setConfirm("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-72 flex-col gap-4">
      <div>
        <label
          htmlFor="new-password"
          className={labelClass}
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
          className={fieldClass}
        />
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className={labelClass}
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
          className={fieldClass}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className={btn("primary", "md", "mt-2")}
      >
        {loading && <Spinner className="h-3 w-3" />}
        Valider
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
