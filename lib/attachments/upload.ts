import { createClient } from "@/lib/supabase/client";
import { NETWORK_ERROR_MESSAGE } from "@/lib/ui/use-action-runner";
import { ATTACHMENTS_BUCKET, tooLargeMessage } from "@/lib/attachments/types";

// Envoi direct du navigateur vers le bucket, avec la session de l'agent
// (les policies du bucket s'appliquent). XMLHttpRequest plutôt que le
// client supabase-js : seul moyen de suivre la progression de l'envoi.
// Les fichiers ne transitent pas par le serveur Next (limite de taille
// des Server Actions).

export class UploadError extends Error {}

function describeFailure(status: number, body: string, fileName: string): string {
  if (status === 413 || /payload too large|maximum allowed size|413/i.test(body)) {
    return tooLargeMessage(fileName);
  }
  if (status === 401 || status === 403 || /row-level security|unauthorized/i.test(body)) {
    return "Envoi refusé : vous n'avez pas le droit d'ajouter des fichiers à cette fiche, ou votre session a expiré.";
  }
  if (/already exists|duplicate/i.test(body)) {
    return "Un fichier portant ce chemin existe déjà. Réessayez.";
  }
  return `L'envoi de « ${fileName} » a échoué. Réessayez.`;
}

export async function uploadAttachmentFile(
  file: File,
  path: string,
  onProgress: (ratio: number) => void,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new UploadError("Session expirée : rechargez la page puis réessayez.");
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${ATTACHMENTS_BUCKET}/${path}`;
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(
          new UploadError(describeFailure(xhr.status, xhr.responseText, file.name)),
        );
      }
    };
    xhr.onerror = () => reject(new UploadError(NETWORK_ERROR_MESSAGE));
    xhr.onabort = () => reject(new UploadError("Envoi annulé."));
    xhr.send(body);
  });
}

// Supprime des fichiers du bucket (brouillons abandonnés, ou fichier dont
// l'enregistrement a échoué). Échec silencieux : le nettoyage des
// orphelins reprendra ce qui reste.
export async function removeAttachmentFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await createClient().storage.from(ATTACHMENTS_BUCKET).remove(paths);
  } catch {
    // ignoré, voir ci-dessus
  }
}

// URL signée courte, générée avec la session de l'agent (la policy de
// lecture du bucket s'applique). `download` force le téléchargement sous
// le nom d'origine ; sinon le navigateur ouvre le fichier s'il le peut.
export async function signedAttachmentUrl(
  path: string,
  download?: string,
): Promise<string | null> {
  const { data } = await createClient()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path, 60, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}
