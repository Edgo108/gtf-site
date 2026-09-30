"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";
import { Spinner } from "@/components/ui/Spinner";
import { btn, fieldClass, labelClass } from "@/lib/ui/styles";
import { NETWORK_ERROR_MESSAGE } from "@/lib/ui/use-action-runner";
import { completeForcedPasswordChange } from "@/lib/actions/auth";

export function ChangePasswordForm({
  mode,
}: {
  mode: "forced" | "voluntary";
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

    // Changement obligatoire : mot de passe + levée du drapeau faits
    // ensemble par le serveur (le navigateur ne peut plus lever le
    // drapeau lui-même).
    if (mode === "forced") {
      let result: { error?: string };
      try {
        result = await completeForcedPasswordChange(password);
      } catch {
        setLoading(false);
        setError(NETWORK_ERROR_MESSAGE);
        toast.error(NETWORK_ERROR_MESSAGE);
        return;
      }
      setLoading(false);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Mot de passe mis à jour");
      router.push("/dashboard");
      router.refresh();
      return;
    }

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
