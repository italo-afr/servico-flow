// Teste de carga moderado (brief 10.3). Somente contra ambiente local/staging com massa sintética.
// Uso: node scripts/load-test.mjs --base=http://localhost:3201 --vus=20 --seconds=120
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:3201' },
    origin: { type: 'string', default: 'http://localhost:3000' },
    vus: { type: 'string', default: '20' },
    seconds: { type: 'string', default: '120' },
    email: { type: 'string', default: 'ana@clima-norte.example.com' },
    password: { type: 'string', default: 'demo-senha-123' },
  },
});
const base = values.base;
if (!/localhost|127\.0\.0\.1|staging/.test(base)) {
  console.error('Recusado: alvo não parece local/staging.');
  process.exit(1);
}

const login = await fetch(`${base}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: values.origin },
  body: JSON.stringify({ email: values.email, password: values.password }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
if (!login.ok || !cookie) throw new Error(`login falhou: ${login.status}`);
const H = { cookie, origin: values.origin };
const me = await (await fetch(`${base}/api/v1/me`, { headers: H })).json();
const orgs = me.memberships.map((m) => m.organizationId);
const sample = {};
for (const o of orgs) {
  const r = await (
    await fetch(`${base}/api/v1/organizations/${o}/orders?limit=50`, { headers: H })
  ).json();
  sample[o] = r.items.map((i) => i.id);
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const STATUSES = ['OPEN', 'TRIAGE', 'AWAITING_APPROVAL', 'COMPLETED'];
const scenarios = [
  {
    name: 'orders.list',
    weight: 45,
    url: (o) => `/api/v1/organizations/${o}/orders?limit=20&status=${pick(STATUSES)}`,
  },
  {
    name: 'orders.search',
    weight: 10,
    url: (o) => `/api/v1/organizations/${o}/orders?limit=20&q=sint`,
  },
  {
    name: 'orders.detail',
    weight: 25,
    url: (o) => `/api/v1/organizations/${o}/orders/${pick(sample[o])}`,
  },
  {
    name: 'agenda.week',
    weight: 10,
    url: (o) =>
      `/api/v1/organizations/${o}/appointments?from=${new Date().toISOString()}&to=${new Date(Date.now() + 7 * 864e5).toISOString()}`,
  },
  { name: 'dashboard', weight: 10, url: (o) => `/api/v1/organizations/${o}/dashboard` },
];
const total = scenarios.reduce((s, x) => s + x.weight, 0);
const chooser = () => {
  let r = Math.random() * total;
  for (const s of scenarios) if ((r -= s.weight) < 0) return s;
  return scenarios[0];
};

const stats = new Map(scenarios.map((s) => [s.name, { lat: [], errors: 0 }]));
const end = Date.now() + Number(values.seconds) * 1000;
async function vu() {
  while (Date.now() < end) {
    const s = chooser();
    const t = performance.now();
    try {
      const r = await fetch(base + s.url(pick(orgs)), { headers: H });
      await r.arrayBuffer();
      if (!r.ok) stats.get(s.name).errors++;
    } catch {
      stats.get(s.name).errors++;
    }
    stats.get(s.name).lat.push(performance.now() - t);
  }
}
const started = Date.now();
await Promise.all(Array.from({ length: Number(values.vus) }, vu));
const secs = (Date.now() - started) / 1000;

const pct = (a, p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
let all = [];
let errors = 0;
console.log('| Cenário | Requisições | p50 (ms) | p95 (ms) | p99 (ms) | Erros |');
console.log('|---|---|---|---|---|---|');
for (const [name, s] of stats) {
  const a = s.lat.sort((x, y) => x - y);
  all = all.concat(a);
  errors += s.errors;
  console.log(
    `| ${name} | ${a.length} | ${pct(a, 50).toFixed(1)} | ${pct(a, 95).toFixed(1)} | ${pct(a, 99).toFixed(1)} | ${s.errors} |`,
  );
}
all.sort((x, y) => x - y);
console.log(
  `| **total** | ${all.length} (${(all.length / secs).toFixed(0)} req/s) | ${pct(all, 50).toFixed(1)} | ${pct(all, 95).toFixed(1)} | ${pct(all, 99).toFixed(1)} | ${errors} (${((100 * errors) / all.length).toFixed(2)}%) |`,
);
console.log(`\nVUs=${values.vus}, duração=${secs.toFixed(0)} s, empresas=${orgs.length}`);
