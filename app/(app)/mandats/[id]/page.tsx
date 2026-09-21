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
import { btn } from "@/lib/ui/styles";

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

  let organisationNom: string | null = null;
  if (notice.organisation_gang_id) {
    const { data: gang } = await supabase
      .from("gangs")
      .select("nom")
      .eq("id", notice.organisation_gang_id)
      .single();
    organisationNom = gang?.nom ?? null;
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

        <div className="min-w-[14rem] flex-1">
          <h1 className="break-words font-display text-2xl font-bold uppercase tracking-wide">
            {notice.nom_suspect}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <DangerBadge niveau={notice.niveau_dangerosite} />
            <StatutBadge statut={notice.statut} />
          </div>

          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            Organisation :{" "}
            {organisationNom ? (
              <Link
                href={`/gangs/${notice.organisation_gang_id}`}
                className="text-gtf-blue-hover underline"
              >
                {organisationNom}
              </Link>
            ) : (
              "Aucune organisation identifiée"
            )}
          </p>

          {canWrite && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/mandats/${notice.id}/modifier`}
                className={btn("secondary", "md")}
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
