// Helpers de arquivo no client — capas de evento e anexos de NF viram
// data URLs para persistir na base local (e depois migrarem ao Storage).

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Reduz uma imagem para caber em `maxWidth` (mantendo proporção) e devolve
 * JPEG comprimido — controla o peso no localStorage (~5 MB no total).
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("invalid image"));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Dispara o download/abertura de um anexo guardado como data URL. */
export function downloadDataUrl(name: string, data: string) {
  const a = document.createElement("a");
  a.href = data;
  a.download = name;
  a.click();
}
