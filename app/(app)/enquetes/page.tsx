import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InvestigationCard } from "@/components/investigations/InvestigationCard";
import { SearchFilterBar } from "@/components/investigations/SearchFilterBar";
import type { Investigation } from "@/lib/supabase/investigations-types";

export default async function EnquetesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const { q, statut } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  let query = supabase
    .from("investigations")
    .select("*")
    .order("created_at", { ascending: false });

  if (statut) {
    query = query.eq("statut", statut);
  }

  const sanitizedQ = q?.replace(/[%,()]/g, "").trim();
  if (sanitizedQ) {
    query = query.or(
      `titre.ilike.%${sanitizedQ}%,suspects.ilike.%${sanitizedQ}%,agent_responsable.ilike.%${sanitizedQ}%`,
    );
  }

  const { data: investigations } = await query.returns<Investigation[]>();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Enquêtes
        </h1>
        <div className="flex gap-3">
          {profile?.role === "admin" && (
            <Link
              href="/admin/enquetes/corbeille"
              className="rounded border border-gtf-border px-4 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
            >
              Corbeille
            </Link>
          )}
          <Link
            href="/enquetes/nouvelle"
            className="rounded bg-gtf-blue px-4 py-2 text-xs uppercase tracking-widest text-gtf-text hover:bg-gtf-blue-hover"
          >
            Nouvelle enquête
          </Link>
        </div>
      </div>

      <Suspense fallback={null}>
        <SearchFilterBar resultCount={investigations?.length ?? 0} />
      </Suspense>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {investigations?.map((investigation) => (
          <InvestigationCard
            key={investigation.id}
            investigation={investigation}
          />
        ))}
        {investigations && investigations.length === 0 && (
          <p className="col-span-full text-sm text-gtf-text-muted">
            Aucune enquête trouvée.
          </p>
        )}
      </div>
    </div>
  );
}
