/**
 * Avaliação reproduzível do baseline (brief 12.4/12.5).
 *   tsx src/triage/evaluate-cli.ts dev        → usar durante o ajuste
 *   tsx src/triage/evaluate-cli.ts holdout    → avaliação final, sem ajustes depois
 * Saída em Markdown (stdout).
 */
import { readFileSync } from 'node:fs';
import { suggestTriage, TRIAGE_CATEGORIES, type TriageCategory } from './rules.js';

interface Example {
  id: string;
  input: string;
  expectedCategory: TriageCategory;
  expectedMissing: string[];
  rationale: string;
}

export function evaluate(examples: Example[]) {
  const rows = examples.map((e) => {
    const t0 = performance.now();
    const s = suggestTriage(e.input);
    const ms = performance.now() - t0;
    return { e, s, ms, catOk: s.category === e.expectedCategory, missOk: JSON.stringify(s.missingInformation) === JSON.stringify(e.expectedMissing) };
  });
  const confusion = new Map<string, number>();
  for (const r of rows) if (!r.catOk) confusion.set(`${r.e.expectedCategory} → ${r.s.category}`, (confusion.get(`${r.e.expectedCategory} → ${r.s.category}`) ?? 0) + 1);
  const lat = rows.map((r) => r.ms).sort((a, b) => a - b);
  return {
    rows,
    total: rows.length,
    categoryHits: rows.filter((r) => r.catOk).length,
    missingHits: rows.filter((r) => r.missOk).length,
    review: rows.filter((r) => r.s.needsHumanReview).length,
    // Afirmação comercial inventada é impossível por construção: a saída não tem campos de preço/prazo.
    inventedCommercialClaims: 0,
    p50: lat[Math.floor(lat.length * 0.5)]!,
    p95: lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))]!,
    confusion: [...confusion.entries()],
  };
}

const isMain = process.argv[1]?.endsWith('evaluate-cli.ts') || process.argv[1]?.endsWith('evaluate-cli.js');
if (isMain) {
  const split = process.argv[2] === 'holdout' ? 'holdout' : 'dev';
  const data = JSON.parse(readFileSync(new URL(`../../src/triage/dataset/${split}.json`, import.meta.url), 'utf8'));
  const r = evaluate(data.examples);
  const pct = (n: number) => `${((100 * n) / r.total).toFixed(1)}%`;
  console.log(`### Conjunto \`${split}\` (dataset ${data.version}, ${r.total} exemplos)\n`);
  console.log(`| Métrica | Resultado |\n|---|---|`);
  console.log(`| Categoria correta | ${r.categoryHits}/${r.total} (${pct(r.categoryHits)}) |`);
  console.log(`| Informações faltantes corretas | ${r.missingHits}/${r.total} (${pct(r.missingHits)}) |`);
  console.log(`| Marcados para revisão humana | ${r.review}/${r.total} |`);
  console.log(`| Afirmações comerciais inventadas | ${r.inventedCommercialClaims} (a saída não tem campos de preço, prazo ou serviço feito) |`);
  console.log(`| Latência p50 / p95 | ${r.p50.toFixed(3)} ms / ${r.p95.toFixed(3)} ms |`);
  console.log(`| Custo por solicitação | R$ 0 (sem chamada externa) |`);
  console.log(`\nCategorias avaliadas: ${TRIAGE_CATEGORIES.join(', ')}.\n`);
  if (r.confusion.length) {
    console.log(`**Erros de categoria (esperado → sugerido):**\n`);
    for (const r2 of r.rows.filter((x) => !x.catOk)) console.log(`- \`${r2.e.id}\` "${r2.e.input}": ${r2.e.expectedCategory} → ${r2.s.category}`);
    console.log('');
  }
  const missErr = r.rows.filter((x) => x.catOk && !x.missOk);
  if (missErr.length) {
    console.log(`**Informações faltantes divergentes (categoria certa):**\n`);
    for (const m of missErr) console.log(`- \`${m.e.id}\`: esperado [${m.e.expectedMissing}] · sugerido [${m.s.missingInformation}]`);
  }
}
