import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/Panel";
import { StatutBadge } from "@/components/investigations/StatutBadge";
import { WantedMiniCard } from "@/components/wanted/WantedMiniCard";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { PatchNoteCategorieBadge } from "@/components/patch-notes/PatchNoteCategorieBadge";
import {
  formatPatchDate,
  type PatchNote,
} from "@/lib/supabase/patch-notes-types";
import type { Profile } from "@/lib/supabase/types";
import type { Investigation } from "@/lib/supabase/investigations-types";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";
import type { Announcement } from "@/lib/supabase/announcements-types";

type RecentInvestigation = Pick<
  Investigation,
  "id" | "titre" | "statut" | "updated_at"
>;

const READ_ANNOUNCEMENTS_LIMIT = 5;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, grade")
    .eq("id", user!.id)
    .single<Pick<Profile, "pseudo" | "grade">>();

  const [
    enCoursResult,
    totalResult,
    recentInvestigationsResult,
    activeWantedResult,
    announcementsResult,
    readRowsResult,
    recentPatchNotesResult,
  ] = await Promise.all([
    supabase
      .from("investigations")
      .select("id", { count: "exact", head: true })
      .eq("statut", "en_cours"),
    supabase.from("investigations").select("id", { count: "exact", head: true }),
    supabase
      .from("investigations")
      .select("id, titre, statut, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5)
      .returns<RecentInvestigation[]>(),
    supabase
      .from("wanted_notices")
      .select("*")
      .eq("statut", "actif")
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<WantedNotice[]>(),
    supabase
      .from("announcements")
      .select("*")
      .order("priorite", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Announcement[]>(),
    supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", user!.id),
    supabase
      .from("patch_notes")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3)
      .returns<PatchNote[]>(),
  ]);

  const enCoursCount = enCoursResult.count ?? 0;
  const totalCount = totalResult.count ?? 0;
  const recentInvestigations = recentInvestigationsResult.data ?? [];
  const activeWanted = activeWantedResult.data ?? [];
  const announcements = announcementsResult.data ?? [];
  const recentPatchNotes = recentPatchNotesResult.data ?? [];

  const readIds = new Set(
    (readRowsResult.data ?? []).map((r) => r.announcement_id),
  );
  const unreadAnnouncements = announcements.filter((a) => !readIds.has(a.id));
  const readAnnouncements = announcements
    .filter((a) => readIds.has(a.id))
    .slice(0, READ_ANNOUNCEMENTS_LIMIT);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Bienvenue, {profile?.grade} {profile?.pseudo}
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-md border border-gtf-border bg-gtf-panel p-4">
          <p className="font-mono text-3xl font-bold text-gtf-blue-hover">
            {enCoursCount}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            Enquête{enCoursCount > 1 ? "s" : ""} en cours
          </p>
        </div>
        <div className="rounded-md border border-gtf-border bg-gtf-panel p-4">
          <p className="font-mono text-3xl font-bold text-gtf-text">
            {totalCount}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            Enquête{totalCount > 1 ? "s" : ""} au total
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Dernières enquêtes modifiées">
          {recentInvestigations.length > 0 ? (
            <ul className="flex flex-col divide-y divide-gtf-border">
              {recentInvestigations.map((investigation) => (
                <li key={investigation.id}>
                  <Link
                    href={`/enquetes/${investigation.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:text-gtf-blue-hover"
                  >
                    <span className="truncate text-sm">
                      {investigation.titre}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <StatutBadge statut={investigation.statut} />
                      <span className="font-mono text-xs text-gtf-text-muted">
                        {new Date(investigation.updated_at).toLocaleString(
                          "fr-FR",
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gtf-text-muted">
              Aucune enquête pour l&apos;instant.
            </p>
          )}
          <Link
            href="/enquetes"
            className="mt-3 inline-block font-mono text-xs uppercase tracking-wider text-gtf-blue-hover hover:underline"
          >
            Voir toutes les enquêtes →
          </Link>
        </Panel>

        <Panel title="Mandats de recherche actifs">
          {activeWanted.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeWanted.map((notice) => (
                <WantedMiniCard key={notice.id} notice={notice} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gtf-text-muted">
              Aucun mandat actif actuellement.
            </p>
          )}
          <Link
            href="/mandats"
            className="mt-3 inline-block font-mono text-xs uppercase tracking-wider text-gtf-blue-hover hover:underline"
          >
            Voir tous les mandats →
          </Link>
        </Panel>
      </div>

      <Panel title="Annonces" className="mt-6">
        {unreadAnnouncements.length === 0 && readAnnouncements.length === 0 ? (
          <p className="text-sm text-gtf-text-muted">Aucune notification.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {unreadAnnouncements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                isRead={false}
                canManage={false}
              />
            ))}
            {readAnnouncements.length > 0 && (
              <>
                <p className="mt-1 font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
                  Déjà lues
                </p>
                {readAnnouncements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                    isRead={true}
                    canManage={false}
                  />
                ))}
              </>
            )}
          </div>
        )}
        <Link
          href="/annonces"
          className="mt-3 inline-block font-mono text-xs uppercase tracking-wider text-gtf-blue-hover hover:underline"
        >
          Voir toutes les annonces →
        </Link>
      </Panel>

      <Panel title="Dernières mises à jour" className="mt-6">
        {recentPatchNotes.length > 0 ? (
          <ul className="flex flex-col divide-y divide-gtf-border">
            {recentPatchNotes.map((note) => (
              <li
                key={note.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <PatchNoteCategorieBadge categorie={note.categorie} />
                  <span className="text-sm text-gtf-text">{note.titre}</span>
                </span>
                <span className="font-mono text-xs text-gtf-text-muted">
                  {formatPatchDate(note.date)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gtf-text-muted">
            Aucune mise à jour pour l&apos;instant.
          </p>
        )}
        <Link
          href="/patch-notes"
          className="mt-3 inline-block font-mono text-xs uppercase tracking-wider text-gtf-blue-hover hover:underline"
        >
          Voir tout l&apos;historique →
        </Link>
      </Panel>
    </div>
  );
}
