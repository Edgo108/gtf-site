import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/Panel";
import { DangerBadge } from "@/components/wanted/DangerBadge";
import { DeleteGangButton } from "@/components/gangs/DeleteGangButton";
import { CategorieBadge } from "@/components/gangs/CategorieBadge";
import { MembersList } from "@/components/gangs/MembersList";
import { uniteCanWrite } from "@/lib/permissions";
import type { Gang, GangMember } from "@/lib/supabase/gangs-types";

export default async function GangDetailPage({
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
    .select("role, unite")
    .eq("id", user!.id)
    .single();
  const canWrite = uniteCanWrite("gangs", profile ?? {});

  const { data: gang } = await supabase
    .from("gangs")
    .select("*")
    .eq("id", id)
    .single<Gang>();

  if (!gang) {
    notFound();
  }

  const { data: members } = await supabase
    .from("gang_members")
    .select("*")
    .eq("gang_id", id)
    .order("nom", { ascending: true })
    .returns<GangMember[]>();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: gang.couleur }}
            aria-hidden="true"
          />
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
              {gang.nom}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CategorieBadge categorie={gang.categorie} />
              <DangerBadge niveau={gang.niveau_menace} />
              <span className="font-mono text-xs text-gtf-text-muted">
                {gang.territoire || "Territoire inconnu"}
              </span>
            </div>
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Link
              href={`/gangs/${gang.id}/modifier`}
              className="rounded border border-gtf-border px-4 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
            >
              Modifier
            </Link>
            <DeleteGangButton id={gang.id} />
          </div>
        )}
      </div>

      <Panel title="Activités" className="mt-6">
        <p className="whitespace-pre-wrap text-sm">
          {gang.activites || "—"}
        </p>
      </Panel>

      {gang.notes && (
        <Panel title="Notes" className="mt-4">
          <p className="whitespace-pre-wrap text-sm">{gang.notes}</p>
        </Panel>
      )}

      <Panel title="Membres identifiés" className="mt-4">
        <MembersList
          gangId={gang.id}
          members={members ?? []}
          canWrite={canWrite}
        />
      </Panel>
    </div>
  );
}
