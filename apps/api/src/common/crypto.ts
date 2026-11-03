import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Token opaco com 256 bits de entropia, seguro para URL. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash para armazenar tokens: só o hash vai para o banco (brief 7.4). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * AES-256-GCM para payloads transitórios (ex.: link bruto aguardando envio por e-mail).
 * Formato: v1.<iv>.<tag>.<ciphertext> em base64url.
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), ct]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('.');
}

export function decrypt(payload: string, keyHex: string): string {
  const [v, iv, tag, ct] = payload.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('payload criptografado inválido');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(keyHex, 'hex'),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString(
    'utf8',
  );
}
