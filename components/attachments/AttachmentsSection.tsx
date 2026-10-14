"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  File as FileIcon,
  FileImage,
  FileText,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { btn } from "@/lib/ui/styles";
import { formatParisDateTime } from "@/lib/datetime";
import {
  deleteAttachment,
  registerAttachments,
} from "@/lib/actions/attachments";
import {
  ATTACHMENT_DRAFTS_FIELD,
  MAX_ATTACHMENT_BYTES,
  attachmentKind,
  buildAttachmentPath,
  formatFileSize,
  tooLargeMessage,
  type AttachmentDraft,
  type AttachmentParentType,
  type AttachmentView,
} from "@/lib/attachments/types";
import {
  UploadError,
  removeAttachmentFiles,
  signedAttachmentUrl,
  uploadAttachmentFile,
} from "@/lib/attachments/upload";
import type { AttachmentDraftsController } from "@/lib/attachments/use-attachment-drafts";

// Section « Pièces jointes » commune aux Enquêtes, Rapports et Plaintes,
// sur la vue détaillée comme dans les formulaires. Deux modes :
//   - fiche enregistrée (`parentId` + `initial`) : chaque fichier est
//     enregistré dès la fin de son envoi ;
//   - création (`drafts`) : les fichiers sont déposés sous l'identifiant
//     généré par le formulaire et enregistrés avec la fiche (champ caché
//     envoyé avec le formulaire).

type Upload = {
  key: string;
  name: string;
  size: number;
  progress: number;
  error: string | null;
};

type Props = {
  canEdit: boolean;
} & (
  | {
      parentType: AttachmentParentType;
      parentId: string;
      initial: AttachmentView[];
      drafts?: undefined;
    }
  | {
      drafts: AttachmentDraftsController;
      parentType?: undefined;
      parentId?: undefined;
      initial?: undefined;
    }
);

// Élément affiché : pièce enregistrée ou brouillon de création.
type Item = {
  key: string;
  attachmentId: string | null;
  nom_fichier: string;
  storage_path: string;
  taille_octets: number;
  type_mime: string;
  meta: string;
  thumbnail_url: string | null;
};

function KindIcon({ mime, name }: { mime: string; name: string }) {
  const kind = attachmentKind(mime, name);
  const Icon = kind === "image" ? FileImage : kind === "pdf" ? FileText : FileIcon;
  return (
    <Icon
      aria-hidden
      className={`h-5 w-5 ${kind === "pdf" ? "text-gtf-red" : kind === "image" ? "text-gtf-blue-hover" : "text-gtf-text-muted"}`}
    />
  );
}

export function AttachmentsSection(props: Props) {
  const { canEdit, drafts } = props;
  const parentType = drafts ? drafts.parentType : props.parentType;
  const parentId = drafts ? drafts.parentId : props.parentId;

  const toast = useToast();
  const run = useActionRunner();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<AttachmentView[]>(props.initial ?? []);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const items: Item[] = drafts
    ? drafts.drafts.map((d) => ({
        key: d.storage_path,
        attachmentId: null,
        ...d,
        meta: "Sera joint à l'enregistrement de la fiche",
        thumbnail_url: null,
      }))
    : saved.map((a) => ({
        key: a.id,
        attachmentId: a.id,
        nom_fichier: a.nom_fichier,
        storage_path: a.storage_path,
        taille_octets: a.taille_octets,
        type_mime: a.type_mime,
        meta: `Ajouté le ${formatParisDateTime(a.created_at)} par ${a.uploaded_by_pseudo}`,
        thumbnail_url: a.thumbnail_url,
      }));

  function patchUpload(key: string, patch: Partial<Upload>) {
    setUploads((current) =>
      current.map((u) => (u.key === key ? { ...u, ...patch } : u)),
    );
  }

  // Envoie un fichier puis, pour une fiche enregistrée, crée sa ligne.
  // Renvoie true si le fichier est bien joint.
  async function sendFile(file: File, key: string): Promise<boolean> {
    const path = buildAttachmentPath(parentType, parentId, file.name);
    const draft: AttachmentDraft = {
      storage_path: path,
      nom_fichier: file.name,
      taille_octets: file.size,
      type_mime: file.type || "application/octet-stream",
    };

    try {
      await uploadAttachmentFile(file, path, (ratio) =>
        patchUpload(key, { progress: ratio }),
      );
    } catch (error) {
      const message =
        error instanceof UploadError
          ? error.message
          : `L'envoi de « ${file.name} » a échoué. Réessayez.`;
      patchUpload(key, { error: message });
      toast.error(message);
      return false;
    }

    if (drafts) {
      drafts.addDraft(draft);
      setUploads((current) => current.filter((u) => u.key !== key));
      return true;
    }

    const result = await run(
      () => registerAttachments(parentType, parentId, [draft]),
      { inline: true },
    );
    if (result.error || !("attachments" in result) || !result.attachments) {
      void removeAttachmentFiles([path]);
      const message = result.error ?? "Impossible d'enregistrer la pièce jointe.";
      patchUpload(key, { error: message });
      toast.error(message);
      return false;
    }
    const added = result.attachments;
    setSaved((current) => [
      ...current,
      ...added.filter((a) => !current.some((c) => c.id === a.id)),
    ]);
    setUploads((current) => current.filter((u) => u.key !== key));
    return true;
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Permet de re-sélectionner le même fichier ensuite.
    event.target.value = "";
    if (files.length === 0) return;

    const batch = files.map((file) => ({
      file,
      upload: {
        key: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        progress: 0,
        error: file.size > MAX_ATTACHMENT_BYTES ? tooLargeMessage(file.name) : null,
      } satisfies Upload,
    }));
    setUploads((current) => [...current, ...batch.map((b) => b.upload)]);

    const rejected = batch.filter((b) => b.upload.error);
    rejected.forEach((b) => toast.error(b.upload.error!));
    const accepted = batch.filter((b) => !b.upload.error);
    if (accepted.length === 0) return;

    drafts?.setUploading((n) => n + accepted.length);
    const results = await Promise.all(
      accepted.map((b) => sendFile(b.file, b.upload.key)),
    );
    drafts?.setUploading((n) => n - accepted.length);

    const ok = results.filter(Boolean).length;
    if (ok > 0) {
      toast.success(
        ok === 1 ? "Fichier ajouté" : `${ok} fichiers ajoutés`,
      );
    }
  }

  async function handleOpen(item: Item, download: boolean) {
    // Fenêtre ouverte tout de suite (sinon bloquée comme pop-up après
    // l'attente de l'URL signée), puis dirigée vers le fichier.
    const win = download ? null : window.open("", "_blank");
    const url = await signedAttachmentUrl(
      item.storage_path,
      download ? item.nom_fichier : undefined,
    );
    if (!url) {
      win?.close();
      toast.error("Fichier inaccessible : il a peut-être été supprimé.");
      return;
    }
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }

  async function handleDelete(item: Item) {
    if (!window.confirm(`Supprimer la pièce jointe « ${item.nom_fichier} » ?`)) {
      return;
    }
    if (drafts) {
      drafts.removeDraft(item.storage_path);
      toast.success("Fichier retiré");
      return;
    }
    const attachmentId = item.attachmentId!;
    setDeleting(attachmentId);
    const result = await run(() => deleteAttachment(attachmentId), {
      success: "Pièce jointe supprimée",
    });
    setDeleting(null);
    if (!result?.error) {
      setSaved((current) => current.filter((a) => a.id !== attachmentId));
    }
  }

  const count = items.length;

  return (
    <Panel title={`Pièces jointes${count ? ` (${count})` : ""}`}>
      {drafts && (
        <input
          type="hidden"
          name={ATTACHMENT_DRAFTS_FIELD}
          value={JSON.stringify(drafts.drafts)}
        />
      )}

      {count === 0 && uploads.length === 0 && (
        <p className="text-sm text-gtf-text-muted">Aucune pièce jointe.</p>
      )}

      {count > 0 && (
        <ul className="flex flex-col divide-y divide-gtf-border">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 py-2">
              {item.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL signée temporaire, hors optimiseur d'images
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded border border-gtf-border object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-gtf-border bg-gtf-panel-alt">
                  <KindIcon mime={item.type_mime} name={item.nom_fichier} />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => handleOpen(item, false)}
                  title="Ouvrir"
                  className="block max-w-full truncate text-left text-sm text-gtf-text hover:text-gtf-blue-hover hover:underline"
                >
                  {item.nom_fichier}
                </button>
                <p className="truncate font-mono text-[11px] text-gtf-text-muted">
                  {formatFileSize(item.taille_octets)} · {item.meta}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => handleOpen(item, true)}
                  aria-label={`Télécharger ${item.nom_fichier}`}
                  title="Télécharger"
                  className={btn("secondary", "sm")}
                >
                  <Download aria-hidden className="h-4 w-4" />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={deleting === item.attachmentId && deleting !== null}
                    aria-label={`Supprimer ${item.nom_fichier}`}
                    title="Supprimer"
                    className={btn("danger", "sm")}
                  >
                    {deleting !== null && deleting === item.attachmentId ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Trash2 aria-hidden className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {uploads.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {uploads.map((u) => (
            <li
              key={u.key}
              className={`rounded border p-2 ${u.error ? "border-gtf-red bg-gtf-red/10" : "border-gtf-border bg-gtf-panel-alt"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm text-gtf-text">
                  {u.name}{" "}
                  <span className="font-mono text-[11px] text-gtf-text-muted">
                    ({formatFileSize(u.size)})
                  </span>
                </p>
                {u.error ? (
                  <button
                    type="button"
                    onClick={() =>
                      setUploads((current) => current.filter((x) => x.key !== u.key))
                    }
                    aria-label="Masquer l'erreur"
                    className="shrink-0 text-gtf-text-muted hover:text-gtf-text"
                  >
                    <X aria-hidden className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="shrink-0 font-mono text-[11px] text-gtf-text-muted">
                    {Math.round(u.progress * 100)} %
                  </span>
                )}
              </div>
              {u.error ? (
                <p role="alert" className="mt-1 text-xs text-gtf-red">
                  {u.error}
                </p>
              ) : (
                <div
                  role="progressbar"
                  aria-label={`Envoi de ${u.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(u.progress * 100)}
                  className="mt-2 h-1.5 overflow-hidden rounded bg-gtf-border"
                >
                  <div
                    className="h-full bg-gtf-blue transition-[width]"
                    style={{ width: `${u.progress * 100}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={btn("secondary", "sm")}
          >
            <Paperclip aria-hidden className="h-4 w-4" />
            Ajouter un fichier
          </button>
          <span className="font-mono text-[11px] text-gtf-text-muted">
            Tous formats · 15 Mo max par fichier
          </span>
        </div>
      )}
    </Panel>
  );
}
