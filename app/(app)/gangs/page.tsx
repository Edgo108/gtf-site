import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GangCard } from "@/components/gangs/GangCard";
import { GangFilterBar } from "@/components/gangs/GangFilterBar";
import { uniteCanWrite } from "@/lib/permissions";
import type { Gang } from "@/lib/supabase/gangs-types";

export default async function GangsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; niveau?: string }>;
}) {
  const { q, niveau } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unite")
    .eq("id", user!.id)
    .single();

  const canWrite = uniteCanWrite("gangs", profile ?? {});

  let query = supabase.from("gangs").select("*").order("nom", { ascending: true });

  if (niveau) {
    query = query.eq("niveau_menace", niveau);
  }
  const sanitizedQ = q?.replace(/[%,()]/g, "").trim();
  if (sanitizedQ) {
    query = query.ilike("nom", `%${sanitizedQ}%`);
  }

  const { data: gangs } = await query.returns<Gang[]>();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Base de données gangs
        </h1>
        <div className="flex gap-3">
          {profile?.role === "admin" && (
            <Link
              href="/admin/gangs/corbeille"
              className="rounded border border-gtf-border px-4 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
            >
              Corbeille
            </Link>
          )}
          {canWrite && (
            <Link
              href="/gangs/nouveau"
              className="rounded bg-gtf-blue px-4 py-2 text-xs uppercase tracking-widest text-gtf-text hover:bg-gtf-blue-hover"
            >
              Nouveau gang
            </Link>
          )}
        </div>
      </div>

      <Suspense fallback={null}>
        <GangFilterBar />
      </Suspense>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gangs?.map((gang) => (
          <GangCard key={gang.id} gang={gang} />
        ))}
        {gangs && gangs.length === 0 && (
          <p className="col-span-full text-sm text-gtf-text-muted">
            Aucun gang trouvé.
          </p>
        )}
      </div>
    </div>
  );
}
