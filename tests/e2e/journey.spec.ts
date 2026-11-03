import { createDecipheriv } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import pg from 'pg';
import { E2E } from '../../playwright.config';

/**
 * T23: jornada principal completa em viewport de celular, com persistência real.
 * Seed fictício é aplicado pela própria API (CLI) antes do teste.
 */
test.beforeAll(async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync('pnpm', ['--filter', '@servicoflow/api', 'exec', 'tsx', 'src/db/seed-cli.ts'], {
    env: {
      ...process.env,
      APP_ENV: 'local',
      DATABASE_URL: E2E.DB,
      PUBLIC_APP_URL: 'http://localhost:3100',
      SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret-1234',
      TOKEN_PAYLOAD_ENCRYPTION_KEY: E2E.KEY,
    },
    stdio: 'inherit',
  });
});

async function login(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', 'demo-senha-123');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app/);
  return page;
}

/** Lê o link do e-mail na outbox (o worker não roda no E2E) — mesmo conteúdo que iria por e-mail. */
async function quoteLink(): Promise<string> {
  const c = new pg.Client({ connectionString: E2E.DB });
  await c.connect();
  const r = await c.query(
    `SELECT payload_encrypted FROM outbox_events WHERE type = 'quote.sent' ORDER BY id DESC LIMIT 1`,
  );
  await c.end();
  const [, iv, tag, ct] = String(r.rows[0].payload_encrypted).split('.');
  const d = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(E2E.KEY, 'hex'),
    Buffer.from(iv!, 'base64url'),
  );
  d.setAuthTag(Buffer.from(tag!, 'base64url'));
  const json = Buffer.concat([d.update(Buffer.from(ct!, 'base64url')), d.final()]).toString();
  return JSON.parse(json).link.replace('http://localhost:3100', '');
}

test('jornada: abrir ordem → orçamento → aceite do cliente → agenda → execução no celular', async ({
  browser,
}) => {
  const att = await login(browser, 'beto@clima-norte.example.com');
  await att.getByRole('link', { name: 'Ordens', exact: true }).click();
  await att.getByRole('link', { name: 'Nova ordem' }).first().click();
  await att.getByRole('button', { name: 'Novo cliente' }).click();
  await att.fill('#name', 'Mercado Fictício');
  await att.fill('#email', 'cliente@example.com');
  await att.fill('[id="address.street"]', 'Avenida Exemplo');
  await att.fill('[id="address.city"]', 'Campinas');
  await att.fill('[id="address.state"]', 'SP');
  await att.fill('[id="equipment.description"]', 'Split 18.000 BTU do caixa');
  await att.getByRole('button', { name: 'Salvar cliente' }).click();
  await att.fill('#description', 'Não liga desde ontem.');
  await att.getByRole('button', { name: 'Abrir ordem' }).click();
  await expect(att.locator('h1')).toContainText('Aberta');
  await att.getByRole('button', { name: 'Iniciar triagem' }).click();
  await expect(att.locator('h1')).toContainText('Em triagem');

  await att.getByRole('button', { name: 'Elaborar orçamento' }).click();
  await att.fill('[id="items.0.description"]', 'Troca de capacitor');
  await att.fill('#p0', '250,00');
  await att.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(att.getByText('Total R$ 250,00').first()).toBeVisible();
  att.once('dialog', (d) => d.accept());
  await att.getByRole('button', { name: 'Enviar ao cliente' }).click();
  await expect(att.locator('h1')).toContainText('Aguardando aprovação');

  const customer = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await customer.goto(await quoteLink());
  await expect(customer.getByText('R$ 250,00').first()).toBeVisible();
  expect(customer.url()).not.toContain('token'); // fragmento removido do histórico
  await customer.getByRole('button', { name: 'Aceitar orçamento' }).click();
  await customer.getByRole('button', { name: 'Sim, aceito' }).click();
  await expect(customer.getByText('Você aceitou')).toBeVisible();

  await att.reload();
  await expect(att.locator('h1')).toContainText('Aprovada');
  await att.getByRole('button', { name: 'Agendar execução' }).click();
  await att.selectOption('#technicianMembershipId', { label: 'Duda Técnica' });
  await att.fill('#time', '10:00');
  await att.getByRole('button', { name: 'Confirmar' }).click();
  await expect(att.locator('h1')).toContainText('Agendada');
  const orderUrl = att.url();

  const tech = await login(browser, 'duda@clima-norte.example.com');
  await tech.goto(orderUrl.replace('http://localhost:3100', ''));
  await expect(tech.getByText('R$')).toHaveCount(0); // técnico não vê valores
  await tech.getByRole('button', { name: 'Iniciar visita' }).click();
  await expect(tech.locator('h1')).toContainText('Em execução');
  await tech.fill('#summary', 'Capacitor substituído; equipamento ligando normalmente.');
  await tech.getByRole('button', { name: 'Concluir serviço' }).click();
  await expect(tech.locator('h1')).toContainText('Concluída');
});
