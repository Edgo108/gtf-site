import Link from "next/link";
import { btn } from "@/lib/ui/styles";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gtf-bg p-4 text-gtf-text">
      <div className="w-full max-w-md rounded-md border border-gtf-border bg-gtf-panel p-6 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-gtf-amber">
          Erreur 404
        </p>
        <h1 className="mt-2 font-display text-xl font-bold uppercase tracking-wide">
          Page introuvable
        </h1>
        <p className="mt-3 text-sm text-gtf-text-muted">
          Cette page n&apos;existe pas, ou l&apos;élément demandé a été
          supprimé.
        </p>
        <Link href="/dashboard" className={`${btn("primary")} mt-5`}>
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
