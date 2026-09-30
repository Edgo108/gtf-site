import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AppHeader, type NavLink } from "@/components/layout/AppHeader";
import { canAccessOperations, canManageUnite } from "@/lib/permissions";
import type { Profile } from "@/lib/supabase/types";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  // Requêtes indépendantes lancées en parallèle (un seul aller-retour
  // au lieu de 5 à la suite). Badge « Annonces » = nombre d'annonces −
  // nombre d'annonces lues par l'agent (les lectures sont supprimées en
  // cascade avec leur annonce), en simples comptages sans rapatrier les
  // lignes.
  const [
    { data: profile },
    { count: announcementCount },
    { count: readCount },
    { data: wantedView },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("pseudo, role, grade, unite")
      .eq("id", user.id)
      .single<Pick<Profile, "pseudo" | "role" | "grade" | "unite">>(),
    supabase.from("announcements").select("id", { count: "exact", head: true }),
    supabase
      .from("announcement_reads")
      .select("announcement_id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("wanted_notice_views")
      .select("last_seen_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const unreadCount = Math.max(0, (announcementCount ?? 0) - (readCount ?? 0));

  const wantedLastSeen = wantedView?.last_seen_at ?? "1970-01-01T00:00:00Z";
  const { count: newMandatsCount } = await supabase
    .from("wanted_notices")
    .select("id", { count: "exact", head: true })
    .eq("statut", "actif")
    .gt("created_at", wantedLastSeen);

  const links: NavLink[] = [
    { href: "/dashboard", label: "Tableau de bord" },
    // Enquêtes, Rapports et Plaintes sont regroupés derrière « Archives ».
    { href: "/archives", label: "Archives", match: ["/enquetes"] },
    { href: "/mandats", label: "Mandats", badge: newMandatsCount ?? 0 },
    { href: "/gangs", label: "B.D.D" },
    { href: "/zones", label: "Carte" },
    { href: "/dispatch", label: "Dispatch" },
  ];
  // Section entièrement invisible pour les agents DOJ, y compris dans la
  // navigation.
  if (profile && canAccessOperations(profile)) {
    links.push({ href: "/operations", label: "Opérations" });
  }
  links.push(
    { href: "/annonces", label: "Annonces", badge: unreadCount },
    { href: "/profil", label: "Mon profil" },
  );
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

      <main className="p-4 pb-10 sm:p-6 sm:pb-10">{children}</main>
    </div>
  );
}
