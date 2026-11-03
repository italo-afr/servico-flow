import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppConfig } from '../config.js';

/** Armazenamento privado de objetos (brief 7.5). Nenhum objeto é público. */
export interface ObjectStorage {
  /** URL curta para o navegador enviar o arquivo bruto direto ao storage. */
  presignPut(key: string, contentType: string, seconds: number): Promise<string>;
  presignGet(key: string, seconds: number): Promise<string>;
  get(key: string, maxBytes: number): Promise<Buffer | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class S3Storage implements ObjectStorage {
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    config: AppConfig,
  ) {
    this.client = new S3Client({
      region: config.STORAGE_REGION,
      endpoint: config.STORAGE_ENDPOINT,
      forcePathStyle: !!config.STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: config.STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY!,
      },
    });
  }
  presignPut(key: string, contentType: string, seconds: number) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: seconds },
    );
  }
  presignGet(key: string, seconds: number) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: seconds,
    });
  }
  async get(key: string, maxBytes: number) {
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if ((r.ContentLength ?? 0) > maxBytes) return Buffer.alloc(maxBytes + 1);
      return r.Body ? Buffer.from(await r.Body.transformToByteArray()) : null;
    } catch (e) {
      if ((e as { name?: string }).name === 'NoSuchKey') return null;
      throw e;
    }
  }
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/**
 * Adaptador local para desenvolvimento/testes (sem Docker): arquivos em disco e URLs
 * assinadas por HMAC servidas pela própria API. Proibido em produção (config.ts).
 */
export class LocalStorage implements ObjectStorage {
  constructor(
    private readonly dir: string,
    private readonly secret: string,
    private readonly publicBase: string,
  ) {}
  private file(key: string) {
    if (!/^[\w/.-]+$/.test(key) || key.includes('..')) throw new Error('chave inválida');
    return path.join(this.dir, key);
  }
  sign(op: 'put' | 'get', key: string, exp: number) {
    return createHmac('sha256', this.secret).update(`${op}:${key}:${exp}`).digest('base64url');
  }
  verify(op: 'put' | 'get', key: string, exp: number, sig: string) {
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const a = Buffer.from(this.sign(op, key, exp));
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  private url(op: 'put' | 'get', key: string, seconds: number) {
    const exp = Date.now() + seconds * 1000;
    return `${this.publicBase}/api/v1/storage-local/${op}/${key}?exp=${exp}&sig=${this.sign(op, key, exp)}`;
  }
  async presignPut(key: string, _ct: string, seconds: number) {
    return this.url('put', key, seconds);
  }
  async presignGet(key: string, seconds: number) {
    return this.url('get', key, seconds);
  }
  async get(key: string) {
    try {
      return await readFile(this.file(key));
    } catch {
      return null;
    }
  }
  async put(key: string, body: Buffer) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, body, { mode: 0o600 });
  }
  async delete(key: string) {
    await rm(this.file(key), { force: true });
  }
}

export function createStorage(config: AppConfig): ObjectStorage {
  if (config.STORAGE_DRIVER === 's3') return new S3Storage(config.STORAGE_BUCKET!, config);
  return new LocalStorage(
    path.resolve(process.cwd(), config.STORAGE_LOCAL_DIR),
    config.SESSION_SECRET,
    config.PUBLIC_APP_URL,
  );
}
