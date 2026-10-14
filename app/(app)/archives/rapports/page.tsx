import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPseudoMap } from "@/lib/archives/agents";
import { ArchiveListTable } from "@/components/archives/ArchiveListTable";
import {
  readArchiveTypeFilter,
  type Rapport,
} from "@/lib/supabase/archives-types";
import { ArchiveTypeFilter } from "@/components/archives/ArchiveTypeFilter";
import { btn } from "@/lib/ui/styles";
import { isOutOfRange, pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";

export default async function RapportsPage({
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
    .from("rapports")
    .select(
      "id, numero, numero_test, est_test, date_redaction, agent_redacteur_id, nom_suspect",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  if (type) query = query.eq("est_test", type === "tests");

  // Compteurs : les tests ne comptent jamais dans le total officiel.
  const [{ data: rapports, error, count }, officialResult, testResult] =
    await Promise.all([
      query.range(from, to).returns<
        Pick<
          Rapport,
          | "id"
          | "numero"
          | "numero_test"
          | "est_test"
          | "date_redaction"
          | "agent_redacteur_id"
          | "nom_suspect"
        >[]
      >(),
      supabase
        .from("rapports")
        .select("id", { count: "exact", head: true })
        .eq("est_test", false),
      supabase
        .from("rapports")
        .select("id", { count: "exact", head: true })
        .eq("est_test", true),
    ]);
  const officialCount = officialResult.count ?? 0;
  const testCount = testResult.count ?? 0;
  if (isOutOfRange(error)) {
    redirect(type ? `/archives/rapports?type=${type}` : "/archives/rapports");
  }
  if (error) {
    throw new Error("Chargement des rapports impossible.");
  }

  const pseudoById = await getPseudoMap(
    rapports.map((r) => r.agent_redacteur_id),
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
          Rapports
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
          <Link href="/archives/rapports/nouveau" className={btn("primary", "md")}>
            Nouveau rapport
          </Link>
        </div>
      </div>
      <p className="mt-1 font-mono text-sm text-gtf-text-muted">
        {officialCount > 1
          ? `${officialCount} rapports officiels`
          : `${officialCount} rapport officiel`}
        {testCount > 0 && (
          <span className="text-gtf-violet">
            {" "}
            · {testCount} test{testCount > 1 ? "s" : ""} d&apos;entraînement
          </span>
        )}
      </p>

      <div className="mt-4">
        <ArchiveTypeFilter basePath="/archives/rapports" current={type} />
      </div>

      <div className="mt-6">
        <ArchiveListTable
          basePath="/archives/rapports"
          personneLabel="Suspect"
          emptyLabel="Aucun rapport pour l'instant."
          rows={rapports.map((r) => ({
            id: r.id,
            numero: r.numero,
            numero_test: r.numero_test,
            est_test: r.est_test,
            date_redaction: r.date_redaction,
            agentPseudo: pseudoById.get(r.agent_redacteur_id) ?? "Agent inconnu",
            personne: r.nom_suspect,
          }))}
        />
      </div>

      <Pagination
        page={page}
        total={count ?? 0}
        basePath="/archives/rapports"
        params={{ type }}
      />
    </div>
  );
}
