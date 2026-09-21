"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";

type ActionResult = { error?: string } | void | undefined;

type RunOptions = {
  // Message de confirmation affiché (toast vert) quand l'action réussit.
  // Une redirection (`redirect()` côté serveur) compte comme un succès :
  // le toast s'affiche alors sur la page d'arrivée.
  success?: string;
  // À passer quand l'appelant affiche déjà `result.error` près du
  // formulaire : évite de doubler le message par un toast. Les échecs
  // « techniques » (réseau, exception serveur) déclenchent toujours un toast.
  inline?: boolean;
};

export const NETWORK_ERROR_MESSAGE =
  "Connexion perdue ou serveur injoignable. Vérifiez votre connexion puis réessayez.";

// Exception levée par une Server Action (perte de session, permission
// refusée dans un `requireX()`, erreur Supabase inattendue…). En production
// Next masque le message d'origine : on reste volontairement générique.
export const ACTION_FAILED_MESSAGE =
  "L'action a échoué. Votre session a peut-être expiré ou vous n'avez pas les droits nécessaires : rechargez la page puis réessayez.";

// `redirect()` dans une Server Action rejette la promesse côté client avec
// une erreur spéciale (digest « NEXT_REDIRECT… ») que le routeur traite :
// il ne faut surtout pas l'avaler.
function isRedirectError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    error instanceof TypeError ||
    /failed to fetch|fetch failed|network|load failed/i.test(message)
  );
}

export function describeActionError(error: unknown): string {
  return isNetworkError(error) ? NETWORK_ERROR_MESSAGE : ACTION_FAILED_MESSAGE;
}

// Exécute une Server Action de façon sûre :
//   const run = useActionRunner();
//   const result = await run(() => deleteGang(formData), { success: "…" });
//   if (result?.error) …   // erreur déjà traduite en message lisible
// - retour `{ error }` de l'action → renvoyé tel quel (+ toast rouge sauf
//   `inline`) ;
// - exception / réseau coupé → message clair, jamais d'écran cassé ;
// - succès → toast vert si `success` est fourni.
export function useActionRunner() {
  const toast = useToast();

  return useCallback(
    async function run<T extends ActionResult>(
      action: () => Promise<T>,
      options: RunOptions = {},
    ): Promise<T | { error: string }> {
      try {
        const result = await action();

        if (result && typeof result === "object" && result.error) {
          if (!options.inline) toast.error(result.error);
          return result;
        }

        if (options.success) toast.success(options.success);
        return result;
      } catch (error) {
        if (isRedirectError(error)) {
          if (options.success) toast.success(options.success);
          throw error;
        }

        const message = describeActionError(error);
        toast.error(message);
        return { error: message };
      }
    },
    [toast],
  );
}
