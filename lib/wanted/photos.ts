import type { createClient } from "@/lib/supabase/server";

// Photos des mandats : bucket privé (supabase/wanted_photos_private.sql).
// La colonne `photo_url` contient le chemin du fichier dans le bucket
// (anciennes fiches : URL publique complète, dont on extrait le chemin).
// Pour l'affichage, le serveur génère des URL signées temporaires avec la
// session de l'agent : la RLS du stockage n'y autorise que les agents
// actifs.

export const WANTED_PHOTOS_BUCKET = "wanted-photos";

// Durée de validité d'une URL signée. Les pages étant rendues à chaque
// visite, une heure suffit largement.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function wantedPhotoPath(photoUrl: string): string {
  const marker = `/${WANTED_PHOTOS_BUCKET}/`;
  const index = photoUrl.indexOf(marker);
  return index === -1 ? photoUrl : photoUrl.slice(index + marker.length);
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

// Remplace `photo_url` par une URL signée (un seul appel pour toute la
// liste). Photo introuvable ou signature impossible → null (« Photo non
// disponible »), jamais d'erreur de page.
export async function withSignedPhotos<T extends { photo_url: string | null }>(
  supabase: ServerSupabase,
  rows: T[],
): Promise<T[]> {
  const paths = [
    ...new Set(
      rows.flatMap((r) => (r.photo_url ? [wantedPhotoPath(r.photo_url)] : [])),
    ),
  ];
  if (paths.length === 0) return rows;

  const { data } = await supabase.storage
    .from(WANTED_PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  const signedByPath = new Map(
    (data ?? []).flatMap((d) =>
      d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [],
    ),
  );

  return rows.map((r) => ({
    ...r,
    photo_url: r.photo_url
      ? (signedByPath.get(wantedPhotoPath(r.photo_url)) ?? null)
      : null,
  }));
}
