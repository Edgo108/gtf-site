// Réduction d'une photo de mandat dans le navigateur, avant l'envoi : le
// bucket étant privé, les photos sont servies telles quelles (URL
// signées, sans optimiseur d'images), donc on n'envoie jamais un original
// de plusieurs Mo pour un affichage en vignette.

const MAX_SIDE = 1200;
const QUALITY = 0.85;

// Renvoie le fichier réduit (WebP, 1200 px max sur le plus grand côté).
// En cas d'échec (format non décodable, navigateur ancien), renvoie le
// fichier d'origine : le serveur applique de toute façon ses propres
// limites (type + 5 Mo).
export async function resizeWantedPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) {
      return file;
    }
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}
