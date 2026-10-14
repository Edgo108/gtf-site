import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPseudoMap } from "@/lib/archives/agents";
import { ArchiveListTable } from "@/components/archives/ArchiveListTable";
import {
  readArchiveTypeFilter,
  type Plainte,
} from "@/lib/supabase/archives-types";
import { ArchiveTypeFilter } from "@/components/archives/ArchiveTypeFilter";
import { btn } from "@/lib/ui/styles";
import { isOutOfRange, pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";

export default async function PlaintesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const params = await searchParams;
  const { page, from, to } = pageRange(params.page);
  const type = readArchiveTypeFilter(params.type);
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  // Officiels et tests mélangés : tri par date de création (les tests
  // n'ont pas de numéro officiel).
  let query = supabase
    .from("plaintes")
    .select(
      "id, numero, numero_test, est_test, date_redaction, agent_redacteur_id, nom_victime",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  if (type) query = query.eq("est_test", type === "tests");

  // Compteurs : les tests ne comptent jamais dans le total officiel.
  const [{ data: plaintes, error, count }, officialResult, testResult] =
    await Promise.all([
      query.range(from, to).returns<
        Pick<
          Plainte,
          | "id"
          | "numero"
          | "numero_test"
          | "est_test"
          | "date_redaction"
          | "agent_redacteur_id"
          | "nom_victime"
        >[]
      >(),
      supabase
        .from("plaintes")
        .select("id", { count: "exact", head: true })
        .eq("est_test", false),
      supabase
        .from("plaintes")
        .select("id", { count: "exact", head: true })
        .eq("est_test", true),
    ]);
  const officialCount = officialResult.count ?? 0;
  const testCount = testResult.count ?? 0;
  if (isOutOfRange(error)) {
    redirect(type ? `/archives/plaintes?type=${type}` : "/archives/plaintes");
  }
  if (error) {
    throw new Error("Chargement des plaintes impossible.");
  }

  const pseudoById = await getPseudoMap(
    plaintes.map((p) => p.agent_redacteur_id),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/archives"
        className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
      >
        ← Archives
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Plaintes
        </h1>
        <div className="flex flex-wrap gap-3">
          {profile?.role === "admin" && (
            <Link
              href="/admin/archives/corbeille"
              className={btn("secondary", "md")}
            >
              Corbeille
            </Link>
          )}
          <Link href="/archives/plaintes/nouvelle" className={btn("primary", "md")}>
            Nouvelle plainte
          </Link>
        </div>
      </div>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {officialCount > 1
          ? `${officialCount} plaintes officielles`
          : `${officialCount} plainte officielle`}
        {testCount > 0 && (
          <span className="text-gtf-violet">
            {" "}
            · {testCount} test{testCount > 1 ? "s" : ""} d&apos;entraînement
          </span>
        )}
      </p>

      <div className="mt-4">
        <ArchiveTypeFilter basePath="/archives/plaintes" current={type} />
      </div>

      <div className="mt-6">
        <ArchiveListTable
          basePath="/archives/plaintes"
          personneLabel="Victime"
          emptyLabel="Aucune plainte pour l'instant."
          rows={plaintes.map((p) => ({
            id: p.id,
            numero: p.numero,
            numero_test: p.numero_test,
            est_test: p.est_test,
            date_redaction: p.date_redaction,
            agentPseudo: pseudoById.get(p.agent_redacteur_id) ?? "Agent inconnu",
            personne: p.nom_victime,
          }))}
        />
      </div>

      <Pagination
        page={page}
        total={count ?? 0}
        basePath="/archives/plaintes"
        params={{ type }}
      />
    </div>
  );
}
