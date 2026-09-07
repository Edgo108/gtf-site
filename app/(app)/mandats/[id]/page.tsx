import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/Panel";
import { WantedPhoto } from "@/components/wanted/WantedPhoto";
import { DangerBadge } from "@/components/wanted/DangerBadge";
import { StatutBadge } from "@/components/wanted/StatutBadge";
import { MarkCapturedButton } from "@/components/wanted/MarkCapturedButton";
import { DeleteWantedButton } from "@/components/wanted/DeleteWantedButton";
import { normalizeName, parseSuspectNames } from "@/lib/investigations/suspects";
import { uniteCanWrite } from "@/lib/permissions";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";

export default async function MandatDetailPage({
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
  const canWrite = uniteCanWrite("mandats", profile ?? {});

  const { data: notice } = await supabase
    .from("wanted_notices")
    .select("*")
    .eq("id", id)
    .single<WantedNotice>();

  if (!notice) {
    notFound();
  }

  const { data: investigations } = await supabase
    .from("investigations")
    .select("id, titre, suspects");

  const target = normalizeName(notice.nom_suspect);
  const linkedInvestigations = (investigations ?? []).filter((investigation) =>
    parseSuspectNames(investigation.suspects).some(
      (suspectName) => normalizeName(suspectName) === target,
    ),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap gap-6">
        <div className="relative h-56 w-44 shrink-0 overflow-hidden rounded-md border border-gtf-border">
          <WantedPhoto
            src={notice.photo_url}
            alt={notice.nom_suspect}
            className="absolute inset-0"
          />
        </div>

        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
            {notice.nom_suspect}
          </h1>
          <div className="mt-2 flex gap-2">
            <DangerBadge niveau={notice.niveau_dangerosite} />
            <StatutBadge statut={notice.statut} />
          </div>

          {canWrite && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/mandats/${notice.id}/modifier`}
                className="rounded border border-gtf-border px-4 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
              >
                Modifier
              </Link>
              <MarkCapturedButton id={notice.id} statut={notice.statut} />
              <DeleteWantedButton id={notice.id} />
            </div>
          )}
        </div>
      </div>

      <Panel title="Description" className="mt-6">
        <p className="whitespace-pre-wrap text-sm">
          {notice.description || "—"}
        </p>
      </Panel>

      <Panel title="Enquêtes liées" className="mt-6">
        {linkedInvestigations.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {linkedInvestigations.map((investigation) => (
              <li key={investigation.id}>
                <Link
                  href={`/enquetes/${investigation.id}`}
                  className="text-sm text-gtf-blue-hover underline"
                >
                  {investigation.titre}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gtf-text-muted">
            Aucune enquête liée à ce suspect pour l&apos;instant.
          </p>
        )}
      </Panel>
    </div>
  );
}
