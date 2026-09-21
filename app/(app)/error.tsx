"use client";

import { useEffect } from "react";
import Link from "next/link";
import { btn } from "@/lib/ui/styles";

// Erreur inattendue pendant le chargement d'une page (Supabase
// indisponible, requête refusée, exception de rendu…) : message clair et
// possibilité de réessayer, au lieu de la page d'erreur brute de Next.
// L'en-tête de navigation reste affiché (le layout n'est pas remplacé).
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-md border border-gtf-red bg-gtf-panel p-6 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-gtf-red">
        Erreur
      </p>
      <h1 className="mt-2 font-display text-xl font-bold uppercase tracking-wide">
        Impossible de charger cette page
      </h1>
      <p className="mt-3 text-sm text-gtf-text-muted">
        Les données n&apos;ont pas pu être récupérées. Vérifiez votre
        connexion, puis réessayez. Si le problème persiste, votre session a
        peut-être expiré : reconnectez-vous.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[11px] text-gtf-text-muted">
          Référence : {error.digest}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className={btn("primary")}>
          Réessayer
        </button>
        <Link href="/dashboard" className={btn("secondary")}>
          Tableau de bord
        </Link>
      </div>
    </div>
  );
}
