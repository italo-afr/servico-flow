import sharp from 'sharp';

export const IMAGE_LIMITS = {
  maxBytes: 5 * 1024 * 1024, // 5 MB por arquivo
  maxPerOrder: 10,
  maxDimension: 8000,
  maxPixels: 40_000_000, // proteção contra "bombas" de descompressão
  outputMaxDimension: 2560,
  allowedFormats: ['jpeg', 'png', 'webp'] as const,
};

export type ImageCheck =
  { ok: true; buffer: Buffer; width: number; height: number } | { ok: false; reason: string };

/**
 * Valida pelo CONTEÚDO (não pela extensão), decodifica com biblioteca mantida e
 * reprocessa para WebP: remove metadados (inclusive localização EXIF) e normaliza.
 */
export async function validateAndReencode(raw: Buffer): Promise<ImageCheck> {
  if (raw.length === 0) return { ok: false, reason: 'empty' };
  if (raw.length > IMAGE_LIMITS.maxBytes) return { ok: false, reason: 'too_large' };
  try {
    const img = sharp(raw, {
      limitInputPixels: IMAGE_LIMITS.maxPixels,
      failOn: 'error',
      animated: false,
    });
    const meta = await img.metadata();
    if (!meta.format || !(IMAGE_LIMITS.allowedFormats as readonly string[]).includes(meta.format)) {
      return { ok: false, reason: `format_not_allowed:${meta.format ?? 'unknown'}` };
    }
    if (
      !meta.width ||
      !meta.height ||
      meta.width > IMAGE_LIMITS.maxDimension ||
      meta.height > IMAGE_LIMITS.maxDimension
    ) {
      return { ok: false, reason: 'dimensions' };
    }
    const { data, info } = await img
      .rotate() // aplica a orientação EXIF antes de descartar metadados
      .resize({
        width: IMAGE_LIMITS.outputMaxDimension,
        height: IMAGE_LIMITS.outputMaxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { ok: true, buffer: data, width: info.width, height: info.height };
  } catch {
    return { ok: false, reason: 'decode_failed' };
  }
}
