// Pagination des listes (enquêtes, B.D.D., mandats, rapports, plaintes) :
// paramètre d'URL `?page=N` (1 par défaut), plage PostgREST `.range()`.

export const PAGE_SIZE = 30;

export function pageRange(pageParam: string | undefined) {
  const parsed = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const from = (page - 1) * PAGE_SIZE;
  return { page, from, to: from + PAGE_SIZE - 1 };
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

// Page demandée au-delà de la dernière (`?page=99`, ou liste raccourcie
// entre-temps) : PostgREST répond « plage non satisfiable » (PGRST103).
export function isOutOfRange(error: { code?: string } | null): boolean {
  return error?.code === "PGRST103";
}
