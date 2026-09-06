import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/Panel";
import { StatutBadge } from "@/components/investigations/StatutBadge";
import { DeleteInvestigationButton } from "@/components/investigations/DeleteInvestigationButton";
import type {
  Investigation,
  InvestigationHistoryEntry,
} from "@/lib/supabase/investigations-types";

export default async function EnqueteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const { data: investigation } = await supabase
    .from("investigations")
    .select("*")
    .eq("id", id)
    .single<Investigation>();

  if (!investigation) {
    notFound();
  }

  const { data: history } = await supabase
    .from("investigation_history")
    .select("*")
    .eq("investigation_id", id)
    .order("created_at", { ascending: false })
    .returns<InvestigationHistoryEntry[]>();

  const canDelete =
    investigation.created_by === user!.id || profile?.role === "admin";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
            {investigation.titre}
          </h1>
          <div className="mt-2">
            <StatutBadge statut={investigation.statut} />
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/enquetes/${investigation.id}/modifier`}
            className="rounded border border-gtf-border px-4 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
          >
            Modifier
          </Link>
          {canDelete && <DeleteInvestigationButton id={investigation.id} />}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Panel title="Suspects">
          <p className="whitespace-pre-wrap text-sm">
            {investigation.suspects || "—"}
          </p>
        </Panel>
        <Panel title="Agent responsable">
          <p className="text-sm">{investigation.agent_responsable || "—"}</p>
        </Panel>
      </div>

      <Panel title="Description" className="mt-4">
        <p className="whitespace-pre-wrap text-sm">
          {investigation.description || "—"}
        </p>
      </Panel>

      <Panel title="Preuves" className="mt-4">
        <p className="whitespace-pre-wrap text-sm">
          {investigation.preuves || "—"}
        </p>
      </Panel>

      <Panel title="Historique" className="mt-4">
        {history && history.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {history.map((entry) => (
              <li key={entry.id} className="border-l-2 border-gtf-border pl-3">
                <p className="text-sm">{entry.resume}</p>
                <p className="mt-0.5 font-mono text-xs text-gtf-text-muted">
                  {entry.agent_pseudo} ·{" "}
                  {new Date(entry.created_at).toLocaleString("fr-FR")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gtf-text-muted">Aucun historique.</p>
        )}
      </Panel>
    </div>
  );
}
