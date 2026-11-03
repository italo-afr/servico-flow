/**
 * Triagem assistida SEM IA (brief 12.2): baseline por regras, determinístico e auditável.
 * É uma SUGESTÃO para o atendente revisar — não é diagnóstico técnico, não define preço,
 * não agenda e não altera registros.
 *
 * Regras escritas olhando apenas dataset/dev.json (o conjunto reservado ficou congelado antes).
 */
export const TRIAGE_CATEGORIES = [
  'INSUFFICIENT_COOLING',
  'WATER_LEAK',
  'NOISE',
  'NOT_TURNING_ON',
  'BAD_SMELL',
  'ERROR_CODE',
  'PREVENTIVE_MAINTENANCE',
  'INSTALLATION',
  'UNKNOWN',
] as const;
export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number];
export type MissingInfo = 'brand_model' | 'error_code' | 'symptom';

export interface TriageSuggestion {
  category: TriageCategory;
  /** Categorias com sinal no texto, na ordem de prioridade. */
  signals: TriageCategory[];
  missingInformation: MissingInfo[];
  questions: string[];
  needsHumanReview: boolean;
  reasonForReview: string | null;
  engine: 'rules-v1';
}

/** Ordem de prioridade quando há mais de um sintoma (justificativas no rationale do dataset). */
const RULES: { category: Exclude<TriageCategory, 'UNKNOWN'>; patterns: RegExp[] }[] = [
  // Código de erro orienta o diagnóstico: vem primeiro.
  {
    category: 'ERROR_CODE',
    patterns: [/\bcodigo\b/, /\berro\b/, /\bpisca/, /\b[a-z]{1,2}\d{1,2}\b/],
  },
  // Vazamento pode causar dano (parede, móveis, piso molhado).
  {
    category: 'WATER_LEAK',
    patterns: [/\bagua\b/, /\bping/, /\bvaz/, /\bgotej/, /\bgoteir/, /\bescorr/, /\bdreno\b/],
  },
  {
    category: 'INSUFFICIENT_COOLING',
    patterns: [
      /\bnao (gela|esfria|esfira|refrigera)/,
      /\bnao gelan/,
      /\bparou de gelar/,
      /\b(gelando|esfriando)( muito)? (pouco|fraco)/,
      /\bfraco\b/,
      /\bnao baixa\b/,
      /\bso sai vento\b/,
      /\besquent/,
      /\bdemora\b.*\besfriar\b/,
    ],
  },
  {
    category: 'NOT_TURNING_ON',
    patterns: [
      /\bnao liga\b/,
      /\bnao ligou\b/,
      /\bnao quer ligar\b/,
      /\bdesligou sozinho\b/,
      /\bnenhuma luz\b/,
      /\bnao acende\b/,
      /\bmorto\b/,
    ],
  },
  {
    category: 'BAD_SMELL',
    patterns: [/\bcheiro\b/, /\bmofo\b/, /\bodor\b/, /\bfedor\b/, /\bqueimad/],
  },
  {
    category: 'NOISE',
    patterns: [
      /\bbarulh/,
      /\bruido\b/,
      /\bestalo\b/,
      /\bzumbido\b/,
      /\bvibra/,
      /\bchiado\b/,
      /\bbatida\b/,
    ],
  },
  {
    category: 'PREVENTIVE_MAINTENANCE',
    patterns: [/\blimpez/, /\bhigieniz/, /\bpreventiv/, /\bfiltros?\b/],
  },
  { category: 'INSTALLATION', patterns: [/\binstal/, /\bmudar\b.*\blugar\b/] },
];

/** Texto do cliente é dado, não instrução: tentativas de comando forçam revisão humana. */
const INJECTION = [
  /\bignore\b/,
  /\binstrucoes?\b/,
  /\bsistema\s*:/,
  /\bcategoria\s*=/,
  /\bpreco\s*=/,
];

const BRANDS =
  /\b(lg|samsung|midea|daikin|consul|gree|elgin|springer|carrier|fujitsu|philco|electrolux|komeco|agratto|tcl|hitachi|britania)\b/;
const CODE = /\b[a-z]{1,2}\d{1,2}\b/;

const QUESTIONS: Record<MissingInfo, string> = {
  brand_model: 'Qual a marca, o modelo e a capacidade (BTU) do aparelho?',
  error_code: 'Aparece algum código no visor? Qual?',
  symptom: 'O que exatamente acontece com o aparelho (não gela, pinga, faz barulho, não liga…)?',
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s:=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function suggestTriage(description: string): TriageSuggestion {
  const t = normalize(description.slice(0, 4000));
  const injection = INJECTION.some((p) => p.test(t));
  const signals = injection
    ? []
    : RULES.filter((r) => r.patterns.some((p) => p.test(t))).map((r) => r.category);
  const category: TriageCategory = signals[0] ?? 'UNKNOWN';
  const missing: MissingInfo[] = [];
  // Capacidade sozinha não identifica o aparelho: exige a marca (rótulo do dataset).
  if (!BRANDS.test(t)) missing.push('brand_model');
  if (category === 'ERROR_CODE' && !CODE.test(t)) missing.push('error_code');
  // Sintoma ausente: relato curto ou texto que tenta dar instruções.
  if (category === 'UNKNOWN' && (injection || t.split(' ').length <= 6)) missing.push('symptom');
  const reasonForReview = injection
    ? 'O texto contém instruções; foi tratado apenas como relato.'
    : category === 'UNKNOWN'
      ? 'Relato sem sintoma reconhecido.'
      : signals.length > 1
        ? 'Mais de um sintoma relatado; confirme a queixa principal.'
        : null;
  return {
    category,
    signals,
    missingInformation: missing.sort(),
    questions: missing.map((m) => QUESTIONS[m]),
    // Sempre é sugestão; "revisão necessária" destaca os casos de maior incerteza.
    needsHumanReview: reasonForReview !== null,
    reasonForReview,
    engine: 'rules-v1',
  };
}
