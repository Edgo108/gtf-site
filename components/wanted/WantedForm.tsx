"use client";

import { useEffect, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createWantedNotice, updateWantedNotice } from "@/app/(app)/mandats/actions";
import { createClient } from "@/lib/supabase/client";
import { normalizeName } from "@/lib/investigations/suspects";
import { NameSuggestField } from "@/components/ui/NameSuggestField";
import { useNameSuggestions } from "@/lib/suggestions/use-name-suggestions";
import type { WantedNotice } from "@/lib/supabase/wanted-notices-types";
import type { Gang, GangMember } from "@/lib/supabase/gangs-types";
import { FormFooter } from "@/components/ui/FormFooter";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { useToast } from "@/components/ui/ToastProvider";
import { fieldClass, labelClass } from "@/lib/ui/styles";

const AUCUNE_ORGANISATION = "Aucune organisation identifiée";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 Mo, comme uploadWantedPhoto

type OrganisationEntry = { nomNormalized: string; orgNom: string };

const NIVEAUX = [
  { value: "faible", label: "Faible" },
  { value: "moyen", label: "Moyen" },
  { value: "eleve", label: "Élevé" },
];

const STATUTS = [
  { value: "actif", label: "Actif" },
  { value: "capture", label: "Capturé" },
];


export function WantedForm({ notice }: { notice?: WantedNotice }) {
  const router = useRouter();
  const run = useActionRunner();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(
    notice?.photo_url ?? null,
  );
  const [nomSuspect, setNomSuspect] = useState(notice?.nom_suspect ?? "");
  const nameSuggestions = useNameSuggestions({ excludeNoticeId: notice?.id });
  const [organisations, setOrganisations] = useState<OrganisationEntry[]>([]);

  useEffect(() => {
    // Annuaire membre → organisation (B.D.D) chargé une fois à
    // l'ouverture du formulaire, pour la détection automatique
    // d'organisation ci-dessous. Pas besoin de rafraîchissement temps
    // réel si la B.D.D. change entretemps : le recalcul n'a lieu qu'à
    // l'enregistrement du mandat.
    fetchOrganisationDirectory();

    async function fetchOrganisationDirectory() {
      const supabase = createClient();
      const [{ data: members }, { data: gangs }] = await Promise.all([
        supabase
          .from("gang_members")
          .select("nom, gang_id")
          .order("created_at", { ascending: true })
          .returns<Pick<GangMember, "nom" | "gang_id">[]>(),
        supabase.from("gangs").select("id, nom").returns<Pick<Gang, "id" | "nom">[]>(),
      ]);

      const orgNomById = new Map((gangs ?? []).map((g) => [g.id, g.nom]));

      setOrganisations(
        (members ?? []).flatMap((member) => {
          const orgNom = orgNomById.get(member.gang_id);
          return orgNom
            ? [{ nomNormalized: normalizeName(member.nom), orgNom }]
            : [];
        }),
      );
    }
  }, []);

  const normalizedSuspect = normalizeName(nomSuspect);
  const organisationDetectee = normalizedSuspect
    ? organisations.find((entry) => entry.nomNormalized === normalizedSuspect)
        ?.orgNom ?? AUCUNE_ORGANISATION
    : AUCUNE_ORGANISATION;

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Même limite que côté serveur (5 Mo) : on prévient tout de suite
    // plutôt que d'échouer après un long envoi.
    if (file && file.size > MAX_PHOTO_SIZE) {
      toast.error("L'image dépasse la taille maximale (5 Mo).");
      event.target.value = "";
      return;
    }
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  }

  function handleAction(formData: FormData) {
    setError(null);
    if (notice) {
      formData.set("id", notice.id);
    }

    startTransition(async () => {
      const action = notice ? updateWantedNotice : createWantedNotice;
      const result = await run(() => action(formData), {
        success: notice ? "Mandat de recherche mis à jour" : "Mandat de recherche créé",
        inline: true,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleAction} className="flex flex-col gap-5">
      <div>
        <label className={labelClass}>Photo</label>
        <div className="flex items-center gap-4">
          <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded border border-gtf-border bg-gtf-panel-alt">
            {preview ? (
              // Prévisualisation locale (blob:) — next/image ne convient
              // pas ici, l'affichage final réutilise WantedPhoto.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-1 text-center font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted">
                Photo non disponible
              </div>
            )}
          </div>
          <input
            type="file"
            name="photo"
            accept="image/png,image/jpeg,image/webp"
            onChange={handlePhotoChange}
            className="text-xs text-gtf-text-muted file:mr-3 file:rounded file:border file:border-gtf-border file:bg-gtf-panel-alt file:px-3 file:py-1.5 file:text-xs file:text-gtf-text file:uppercase file:tracking-wider hover:file:border-gtf-blue"
          />
        </div>
      </div>

      <div>
        <label htmlFor="nom_suspect" className={labelClass}>
          Nom du suspect
        </label>
        <NameSuggestField
          id="nom_suspect"
          name="nom_suspect"
          required
          suggestions={nameSuggestions}
          defaultValue={notice?.nom_suspect}
          onValueChange={setNomSuspect}
        />
        <div className="mt-2">
          <span className={labelClass}>Organisation détectée</span>
          <div
            aria-readonly="true"
            className="w-full cursor-default select-none rounded border border-gtf-border/60 bg-gtf-panel px-3 py-2 text-sm text-gtf-text-muted"
          >
            {organisationDetectee}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="niveau_dangerosite" className={labelClass}>
            Niveau de dangerosité
          </label>
          <select
            id="niveau_dangerosite"
            name="niveau_dangerosite"
            defaultValue={notice?.niveau_dangerosite ?? "moyen"}
            className={fieldClass}
          >
            {NIVEAUX.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>

        {notice && (
          <div>
            <label htmlFor="statut" className={labelClass}>
              Statut
            </label>
            <select
              id="statut"
              name="statut"
              defaultValue={notice.statut}
              className={fieldClass}
            >
              {STATUTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={notice?.description}
          className={fieldClass}
        />
      </div>

      <FormFooter
        error={error}
        pending={pending}
        onCancel={() => router.back()}
      />
      </form>
  );
}
