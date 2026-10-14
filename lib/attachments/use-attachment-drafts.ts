"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { removeAttachmentFiles } from "@/lib/attachments/upload";
import type {
  AttachmentDraft,
  AttachmentParentType,
} from "@/lib/attachments/types";

// Pièces jointes d'une fiche en cours de CRÉATION. L'identifiant de la
// fiche est généré dès l'ouverture du formulaire : les fichiers sont
// déposés directement sous leur chemin définitif, et l'action de création
// enregistre les lignes `attachments` avec la fiche.
//   - échec de l'enregistrement : les brouillons restent dans l'état du
//     formulaire, un nouvel essai les renvoie sans re-téléverser ;
//   - « Annuler » ou départ de la page sans enregistrer : les fichiers
//     déjà envoyés sont supprimés du stockage.
export type AttachmentDraftsController = {
  parentType: AttachmentParentType;
  parentId: string;
  drafts: AttachmentDraft[];
  // Envois en cours : l'enregistrement de la fiche attend leur fin.
  uploading: number;
  addDraft: (draft: AttachmentDraft) => void;
  removeDraft: (storagePath: string) => void;
  setUploading: (update: (count: number) => number) => void;
  // À appeler juste avant d'envoyer le formulaire (true), puis avec false
  // si l'enregistrement a échoué.
  markSubmitting: (submitting: boolean) => void;
  // Supprime tous les brouillons (bouton « Annuler »).
  discardAll: () => void;
};

export function useAttachmentDrafts(
  parentType: AttachmentParentType,
): AttachmentDraftsController {
  const [parentId] = useState(() => crypto.randomUUID());
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  const [uploading, setUploading] = useState(0);
  // Copies lues au démontage (l'état React n'y est plus accessible).
  const draftsRef = useRef<AttachmentDraft[]>([]);
  const submittingRef = useRef(false);

  const update = useCallback((next: AttachmentDraft[]) => {
    draftsRef.current = next;
    setDrafts(next);
  }, []);

  const addDraft = useCallback(
    (draft: AttachmentDraft) => update([...draftsRef.current, draft]),
    [update],
  );

  const removeDraft = useCallback(
    (storagePath: string) => {
      update(draftsRef.current.filter((d) => d.storage_path !== storagePath));
      void removeAttachmentFiles([storagePath]);
    },
    [update],
  );

  const discardAll = useCallback(() => {
    const paths = draftsRef.current.map((d) => d.storage_path);
    update([]);
    void removeAttachmentFiles(paths);
  }, [update]);

  const markSubmitting = useCallback((submitting: boolean) => {
    submittingRef.current = submitting;
  }, []);

  // Départ de la page sans enregistrer (lien de navigation, retour…).
  // Après un enregistrement réussi, la redirection démonte aussi le
  // formulaire : les fichiers appartiennent alors à la fiche.
  useEffect(
    () => () => {
      if (!submittingRef.current && draftsRef.current.length > 0) {
        void removeAttachmentFiles(draftsRef.current.map((d) => d.storage_path));
      }
    },
    [],
  );

  return {
    parentType,
    parentId,
    drafts,
    uploading,
    addDraft,
    removeDraft,
    setUploading,
    markSubmitting,
    discardAll,
  };
}
