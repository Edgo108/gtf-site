import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { WantedCard } from "@/components/wanted/WantedCard";
import { FilterBar } from "@/components/wanted/FilterBar";
import { uniteCanWrite } from "@/lib/permissions";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";
import { withSignedPhotos } from "@/lib/wanted/photos";
import { btn } from "@/lib/ui/styles";
import { isOutOfRange, pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";

export default async function MandatsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; niveau?: string; page?: string }>;
}) {
  const { statut, niveau, page: pageParam } = await searchParams;
  const { page, from, to } = pageRange(pageParam);
  const supabase = await createClient();

  const user = await getCurrentUser();

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
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (statut) {
    query = query.eq("statut", statut);
  }
  if (niveau) {
    query = query.eq("niveau_dangerosite", niveau);
  }

  const { data: rawNotices, error, count } = await query
    .range(from, to)
    .returns<WantedNotice[]>();
  const notices = rawNotices
    ? await withSignedPhotos(supabase, rawNotices)
    : rawNotices;
  if (isOutOfRange(error)) {
    redirect("/mandats");
  }
  if (error) {
    throw new Error("Chargement des mandats impossible.");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Mandats de recherche
        </h1>
        <div className="flex flex-wrap gap-3">
          {profile?.role === "admin" && (
            <Link href="/admin/mandats/corbeille" className={btn("secondary", "md")}>
              Corbeille
            </Link>
          )}
          {canWrite && (
            <Link
              href="/mandats/nouveau"
              className={btn("primary", "md")}
            >
              Nouveau mandat
            </Link>
          )}
        </div>
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

      <Pagination
        page={page}
        total={count ?? 0}
        basePath="/mandats"
        params={{ statut, niveau }}
      />
    </div>
  );
}
