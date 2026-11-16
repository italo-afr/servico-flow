/**
 * Gera as capturas de docs/screenshots a partir do ambiente LOCAL (pnpm dev em :3000, API em :3001).
 * Pré-requisitos: seed + scripts/demo-telas.sql aplicados. Usa só contas e dados fictícios.
 * Uso: node scripts/capturas.mjs
 */
import { createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import pg from 'pg';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const URL = 'http://localhost:3000';
const OUT = 'docs/screenshots';
const db = new pg.Client({ connectionString: env.DATABASE_URL });
await db.connect();
const browser = await chromium.launch({ channel: 'chrome' });

async function login(email, viewport, scale) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    colorScheme: 'light',
    locale: 'pt-BR',
    baseURL: URL,
  });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', 'demo-senha-123');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app/);
  return page;
}
const shot = async (page, name) => {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('ok', name);
};
const orderId = async (n) =>
  (
    await db.query(
      `SELECT so.id FROM service_orders so JOIN organizations o ON o.id = so.organization_id WHERE o.name LIKE 'Clima Norte%' AND so.number = $1`,
      [n],
    )
  ).rows[0].id;

const DESK = { width: 1440, height: 900 };
const CEL = { width: 390, height: 844 };

// 1. Administradora, no computador
const adm = await login('ana@clima-norte.example.com', DESK, 2);
const base = `/app/${(await db.query(`SELECT id FROM organizations WHERE name LIKE 'Clima Norte%'`)).rows[0].id}`;
await adm.goto(base);
await adm.getByText('Visitas de hoje').waitFor();
await shot(adm, '01-painel');
await adm.goto(`${base}/ordens`);
await adm.getByRole('table').waitFor();
await shot(adm, '11-ordens-lista');
await adm.goto(`${base}/agenda`);
await adm.getByText('Padaria').first().waitFor();
await shot(adm, '06-agenda-semana');

// 2. Atendente monta e envia o orçamento da ordem 5 (pule com SO_TECNICO=1 se já foi enviado)
if (!process.env.SO_TECNICO) {
  const att = await login('beto@clima-norte.example.com', DESK, 2);
  await att.goto(`${base}/ordens/${await orderId(5)}`);
  await att.getByRole('button', { name: 'Elaborar orçamento' }).click();
  await att.fill('[id="items.0.description"]', 'Troca da placa receptora e limpeza do aparelho');
  await att.fill('#p0', '380,00');
  await att.getByRole('button', { name: 'Salvar rascunho' }).click();
  await att.getByText('Total R$ 380,00').first().waitFor();
  att.once('dialog', (d) => d.accept());
  await att.getByRole('button', { name: 'Enviar ao cliente' }).click();
  await att.locator('h1', { hasText: 'Aguardando aprovação' }).waitFor();
  await att.evaluate(() => window.scrollTo(0, 0));
  await shot(att, '03-ordem-com-orcamento');

  // 3. Cliente abre o link privado no celular (mesmo conteúdo do e-mail)
  const r = await db.query(
    `SELECT payload_encrypted FROM outbox_events WHERE type = 'quote.sent' ORDER BY id DESC LIMIT 1`,
  );
  const [, iv, tag, ct] = String(r.rows[0].payload_encrypted).split('.');
  const d = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(env.TOKEN_PAYLOAD_ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'base64url'),
  );
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  const link = JSON.parse(
    Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString(),
  ).link;
  const cli = await (
    await browser.newContext({
      viewport: CEL,
      deviceScaleFactor: 3,
      colorScheme: 'light',
      locale: 'pt-BR',
    })
  ).newPage();
  await cli.goto(link.replace(/^https?:\/\/[^/]+/, URL));
  await cli.getByText('R$ 380,00').first().waitFor();
  await shot(cli, '04-cliente-orcamento-celular');
  await cli.getByRole('button', { name: 'Aceitar orçamento' }).click();
  await cli.getByRole('button', { name: 'Sim, aceito' }).click();
  await cli.getByText('Você aceitou').waitFor();
  await shot(cli, '05-cliente-confirmacao-celular');
}

// 4. Técnico no celular
const tec = await login('caio@clima-norte.example.com', CEL, 3);
await tec.goto(`${base}/minhas-visitas`);
await tec.getByText('Padaria').first().waitFor();
await shot(tec, '07-tecnico-minhas-visitas-celular');
await tec.goto(`${base}/ordens/${await orderId(1)}`);
await tec.getByRole('button', { name: 'Iniciar visita' }).click();
await tec.locator('h1', { hasText: 'Em execução' }).waitFor();
await tec.fill('#summary', 'Dreno desobstruído e gás completado. Aparelho gelando normalmente.');
await shot(tec, '08-tecnico-execucao-celular');

await browser.close();
await db.end();
