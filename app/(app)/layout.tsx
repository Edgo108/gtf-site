import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { NavBadge } from "@/components/ui/NavBadge";
import { canManageUnite } from "@/lib/permissions";
import type { Profile } from "@/lib/supabase/types";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, role, grade")
    .eq("id", user.id)
    .single<Pick<Profile, "pseudo" | "role" | "grade">>();

  const { data: allAnnouncements } = await supabase
    .from("announcements")
    .select("id");
  const { data: readAnnouncements } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", user.id);
  const readIds = new Set(
    (readAnnouncements ?? []).map((r) => r.announcement_id),
  );
  const unreadCount = (allAnnouncements ?? []).filter(
    (a) => !readIds.has(a.id),
  ).length;

  const { data: wantedView } = await supabase
    .from("wanted_notice_views")
    .select("last_seen_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const wantedLastSeen = wantedView?.last_seen_at ?? "1970-01-01T00:00:00Z";
  const { count: newMandatsCount } = await supabase
    .from("wanted_notices")
    .select("id", { count: "exact", head: true })
    .eq("statut", "actif")
    .gt("created_at", wantedLastSeen);

  return (
    <div className="min-h-screen bg-gtf-bg text-gtf-text">
      <header className="flex items-center justify-between border-b border-gtf-border bg-gtf-panel px-6 py-3">
        <div className="flex items-center gap-8">
          <span className="font-display text-sm font-bold uppercase tracking-widest text-gtf-text">
            Gang Task Force
          </span>
          <nav className="flex items-center gap-5 font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            <Link href="/dashboard" className="hover:text-gtf-text">
              Tableau de bord
            </Link>
            <Link href="/enquetes" className="hover:text-gtf-text">
              Enquêtes
            </Link>
            <Link href="/mandats" className="relative hover:text-gtf-text">
              Mandats
              <NavBadge count={newMandatsCount ?? 0} />
            </Link>
            <Link href="/gangs" className="hover:text-gtf-text">
              B.D.D
            </Link>
            <Link href="/zones" className="hover:text-gtf-text">
              Carte
            </Link>
            <Link href="/annonces" className="relative hover:text-gtf-text">
              Annonces
              <NavBadge count={unreadCount} />
            </Link>
            <Link href="/patch-notes" className="hover:text-gtf-text">
              Patch notes
            </Link>
            <Link href="/profil" className="hover:text-gtf-text">
              Mon profil
            </Link>
            {(profile?.role === "admin" ||
              (profile && canManageUnite(profile))) && (
              <Link href="/admin/agents" className="hover:text-gtf-text">
                Gestion des agents
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {profile && (
            <span className="font-mono text-xs text-gtf-text-muted">
              {profile.pseudo} · {profile.grade}
            </span>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded border border-gtf-border px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-gtf-text-muted transition-colors hover:border-gtf-red hover:text-gtf-red"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}
