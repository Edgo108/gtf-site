"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PATCH_NOTE_CATEGORIE_OPTIONS } from "@/lib/supabase/patch-notes-types";
import { inputBase } from "@/lib/ui/styles";

const CATEGORIES = [
  { value: "", label: "Toutes les catégories" },
  ...PATCH_NOTE_CATEGORIE_OPTIONS,
];

export function PatchNoteFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateCategorie(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("categorie", value);
    else params.delete("categorie");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <select
        defaultValue={searchParams.get("categorie") ?? ""}
        onChange={(e) => updateCategorie(e.target.value)}
        className={inputBase}
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
