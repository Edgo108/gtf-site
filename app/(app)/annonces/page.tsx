import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { canAuthorAnnouncements, uniteCanWrite } from "@/lib/permissions";
import type { Announcement } from "@/lib/supabase/announcements-types";

export default async function AnnoncesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("grade, role, unite")
    .eq("id", user!.id)
    .single();

  const canWriteAnnonces = uniteCanWrite("annonces", profile ?? {});
  const canCreate =
    !!profile && canAuthorAnnouncements(profile.grade) && canWriteAnnonces;

  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .order("priorite", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<Announcement[]>();

  const { data: readRows } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", user!.id);

  const readIds = new Set((readRows ?? []).map((r) => r.announcement_id));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Annonces
        </h1>
        {canCreate && (
          <Link
            href="/annonces/nouvelle"
            className="rounded bg-gtf-blue px-4 py-2 text-xs uppercase tracking-widest text-gtf-text hover:bg-gtf-blue-hover"
          >
            Nouvelle notification
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {announcements?.map((announcement) => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
            isRead={readIds.has(announcement.id)}
            canManage={
              canWriteAnnonces &&
              (announcement.created_by === user!.id ||
                profile?.role === "admin")
            }
          />
        ))}
        {announcements && announcements.length === 0 && (
          <p className="text-sm text-gtf-text-muted">
            Aucune notification pour l&apos;instant.
          </p>
        )}
      </div>
    </div>
  );
}
