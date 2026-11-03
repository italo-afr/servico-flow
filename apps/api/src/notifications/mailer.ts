import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import type { AppConfig } from '../config.js';

export interface Email {
  to: string;
  subject: string;
  text: string;
  /** Chave estável por entrega, enviada ao provedor quando ele suportar deduplicação. */
  idempotencyKey: string;
}
export interface Mailer {
  send(email: Email): Promise<{ providerMessageId: string }>;
}

/** Erro permanente: não adianta tentar de novo (ex.: endereço rejeitado). */
export class PermanentMailError extends Error {}

export class SmtpMailer implements Mailer {
  private readonly transport;
  constructor(
    url: string,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport(url);
  }
  async send(email: Email) {
    try {
      const info = await this.transport.sendMail({
        from: this.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        headers: { 'X-Idempotency-Key': email.idempotencyKey },
      });
      return { providerMessageId: String(info.messageId) };
    } catch (err) {
      const code = (err as { responseCode?: number }).responseCode;
      if (code && code >= 500 && code < 600) throw new PermanentMailError(`SMTP ${code}`);
      throw err;
    }
  }
}

/** Caixa de e-mail local (desenvolvimento sem Docker): grava arquivos em .local-mail/. */
export class FileMailer implements Mailer {
  constructor(private readonly dir: string) {}
  async send(email: Email) {
    await mkdir(this.dir, { recursive: true });
    const id = `${Date.now()}-${email.idempotencyKey.replace(/[^\w-]/g, '_')}`;
    await writeFile(
      path.join(this.dir, `${id}.txt`),
      `To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`,
      {
        mode: 0o600,
      },
    );
    return { providerMessageId: `file:${id}` };
  }
}

/** Para testes: guarda em memória e pode simular falhas. */
export class MemoryMailer implements Mailer {
  sent: Email[] = [];
  failNext: Error[] = [];
  async send(email: Email) {
    const fail = this.failNext.shift();
    if (fail) throw fail;
    this.sent.push(email);
    return { providerMessageId: `mem:${this.sent.length}` };
  }
}

export function createMailer(config: AppConfig): Mailer {
  if (config.SMTP_URL) return new SmtpMailer(config.SMTP_URL, config.EMAIL_FROM);
  if (config.APP_ENV === 'production') throw new Error('SMTP_URL é obrigatória em produção.');
  return new FileMailer(path.resolve(process.cwd(), '../../.local-mail'));
}

/**
 * Política de destinatários: fora de produção (e sempre em demo), só envia para
 * endereços/domínios listados em EMAIL_ALLOWED_RECIPIENTS (brief 7.7, T25).
 */
export function recipientAllowed(config: AppConfig, to: string): boolean {
  const restricted = config.APP_ENV !== 'production' || config.DEMO_MODE;
  if (!restricted) return true;
  const rules = (config.EMAIL_ALLOWED_RECIPIENTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const addr = to.toLowerCase();
  return rules.some((r) => (r.startsWith('@') ? addr.endsWith(r) : addr === r));
}
