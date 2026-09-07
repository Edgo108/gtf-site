import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { UNITE_MANAGER_GRADES } from "@/lib/permissions";

// Seule la page de connexion est publique. Tout le reste exige une session.
const PUBLIC_PATHS = ["/"];

// Rafraîchit la session Supabase et applique les règles d'accès
// (connexion requise, changement de mot de passe obligatoire, accès admin)
// à chaque requête. Exécuté en Edge Middleware (proxy.ts) : impossible à
// contourner depuis le client.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Tant que .env.local n'est pas renseigné (avant création du projet Supabase),
  // on laisse passer les requêtes sans tenter de rafraîchir la session.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalide le token auprès du serveur Supabase à chaque appel
  // (contrairement à getSession()) : un compte banni/suspendu est donc
  // immédiatement détecté, même en cours de session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!user) {
    if (isPublicPath) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, grade, doit_changer_mdp")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Compte auth sans profil (cas limite) : on laisse passer plutôt que
    // de bloquer complètement l'accès.
    return supabaseResponse;
  }

  if (profile.doit_changer_mdp && pathname !== "/changer-mot-de-passe") {
    const url = request.nextUrl.clone();
    url.pathname = "/changer-mot-de-passe";
    return NextResponse.redirect(url);
  }

  if (!profile.doit_changer_mdp && pathname === "/changer-mot-de-passe") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && profile.role !== "admin") {
    // Les grades Commandant / Capitaine / Lieutenant accèdent à
    // « Gestion des agents » (/admin/agents) — uniquement pour réattribuer
    // le rôle/unité d'un compte. Tout le reste de /admin/* reste admin.
    const canManageUnite = UNITE_MANAGER_GRADES.includes(profile.grade);
    const uniteManagerException =
      canManageUnite &&
      (pathname === "/admin/agents" || pathname === "/admin/agents/");

    if (!uniteManagerException) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
