"use client";

import { useTransition, type ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { btn, type ButtonSize, type ButtonVariant } from "@/lib/ui/styles";

// Bouton qui déclenche une Server Action « simple » (supprimer, restaurer,
// basculer un statut…) : confirmation optionnelle, indicateur de
// chargement, toast de succès et message d'erreur clair en cas d'échec.
// Remplace les petits composants de bouton dupliqués dans chaque section.
export function ActionButton({
  action,
  fields,
  confirm,
  success,
  variant = "secondary",
  size = "md",
  className,
  disabled,
  onSuccess,
  children,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  // Champs ajoutés au FormData envoyé à l'action.
  fields: Record<string, string>;
  // Question posée via la boîte de confirmation du navigateur.
  confirm?: string;
  // Message du toast de confirmation.
  success: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const run = useActionRunner();

  function handleClick() {
    if (confirm && !window.confirm(confirm)) return;

    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }

    startTransition(async () => {
      const result = await run(() => action(formData), { success });
      if (!result?.error) onSuccess?.();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || disabled}
      aria-busy={pending}
      className={btn(variant, size, className)}
    >
      {pending && <Spinner className="h-3 w-3" />}
      {children}
    </button>
  );
}
