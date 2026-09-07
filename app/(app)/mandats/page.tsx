import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WantedCard } from "@/components/wanted/WantedCard";
import { FilterBar } from "@/components/wanted/FilterBar";
import { uniteCanWrite } from "@/lib/permissions";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";

export default async function MandatsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; niveau?: string }>;
}) {
  const { statut, niveau } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unite")
    .eq("id", user!.id)
    .single();
  const canWrite = uniteCanWrite("mandats", profile ?? {});

  // Marque les mandats comme "vus" pour cet agent : remet à zéro la
  // pastille de compteur affichée dans la navigation.
  if (user) {
    await supabase
      .from("wanted_notice_views")
      .upsert(
        { user_id: user.id, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
  }

  let query = supabase
    .from("wanted_notices")
    .select("*")
    .order("created_at", { ascending: false });

  if (statut) {
    query = query.eq("statut", statut);
  }
  if (niveau) {
    query = query.eq("niveau_dangerosite", niveau);
  }

  const { data: notices } = await query.returns<WantedNotice[]>();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Mandats de recherche
        </h1>
        {canWrite && (
          <Link
            href="/mandats/nouveau"
            className="rounded bg-gtf-blue px-4 py-2 text-xs uppercase tracking-widest text-gtf-text hover:bg-gtf-blue-hover"
          >
            Nouveau mandat
          </Link>
        )}
      </div>

      <Suspense fallback={null}>
        <FilterBar />
      </Suspense>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {notices?.map((notice) => (
          <WantedCard key={notice.id} notice={notice} />
        ))}
        {notices && notices.length === 0 && (
          <p className="col-span-full text-sm text-gtf-text-muted">
            Aucun mandat trouvé.
          </p>
        )}
      </div>
    </div>
  );
}
