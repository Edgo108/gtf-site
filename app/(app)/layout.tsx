import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader, type NavLink } from "@/components/layout/AppHeader";
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

  const links: NavLink[] = [
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/enquetes", label: "Enquêtes" },
    { href: "/mandats", label: "Mandats", badge: newMandatsCount ?? 0 },
    { href: "/gangs", label: "B.D.D" },
    { href: "/zones", label: "Carte" },
    { href: "/annonces", label: "Annonces", badge: unreadCount },
    { href: "/profil", label: "Mon profil" },
  ];
  if (profile?.role === "admin" || (profile && canManageUnite(profile))) {
    links.push({ href: "/admin/agents", label: "Gestion des agents" });
  }

  return (
    <div className="min-h-screen bg-gtf-bg text-gtf-text">
      <AppHeader
        links={links}
        pseudo={profile?.pseudo}
        grade={profile?.grade}
      />

      <main className="p-4 sm:p-6">{children}</main>
    </div>
  );
}
