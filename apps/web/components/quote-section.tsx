'use client';
import { useState } from 'react';
import { useOrg } from './org';
import type { OrderDetail } from './order-sections';
import { ErrorAlert, Field, useAction } from './ui';
import { api } from '@/lib/api';
import { brl, dt } from '@/lib/labels';

export interface Quote {
  id: string;
  version: number;
  status: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  validDays: number;
  notes: string | null;
  recipientEmail: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  decidedAt: string | null;
  rowVersion: number;
  items: {
    position: number;
    description: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
}

const QUOTE_STATUS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SENT: 'Enviado — aguardando cliente',
  ACCEPTED: 'Aceito pelo cliente',
  REJECTED: 'Recusado pelo cliente',
  EXPIRED: 'Expirado',
  SUPERSEDED: 'Substituído por nova versão',
  CANCELLED: 'Cancelado',
};

/** "1.234,56" → 123456 centavos, sem ponto flutuante. Retorna null se inválido. */
export function parseBRL(input: string): number | null {
  const s = input.replace(/[R$\s.]/g, '');
  const m = /^(\d{1,12})(?:,(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0'));
}
const fmt = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

interface Row {
  description: string;
  quantity: string;
  unitPrice: string;
}

function Editor({
  order,
  draft,
  onDone,
}: {
  order: OrderDetail;
  draft?: Quote;
  onDone: () => void;
}) {
  const { path } = useOrg();
  const [rows, setRows] = useState<Row[]>(
    draft?.items.map((i) => ({
      description: i.description,
      quantity: String(i.quantity),
      unitPrice: fmt(i.unitPriceCents),
    })) ?? [{ description: '', quantity: '1', unitPrice: '' }],
  );
  const [discount, setDiscount] = useState(draft ? fmt(draft.discountCents) : '0,00');
  const [validDays, setValidDays] = useState(String(draft?.validDays ?? 7));
  const [notes, setNotes] = useState(draft?.notes ?? '');
  const [localError, setLocalError] = useState('');
  const parsed = rows.map((r) => ({
    description: r.description.trim(),
    quantity: Number(r.quantity),
    unitPriceCents: parseBRL(r.unitPrice),
  }));
  // Prévia local apenas para orientar; o valor autorizado é o calculado pelo servidor.
  const subtotal = parsed.reduce(
    (s, r) =>
      s +
      (Number.isInteger(r.quantity) && r.unitPriceCents !== null
        ? r.quantity * r.unitPriceCents
        : 0),
    0,
  );
  const discountCents = parseBRL(discount);
  const save = useAction(async () => {
    setLocalError('');
    if (
      parsed.some(
        (r) => r.unitPriceCents === null || !Number.isInteger(r.quantity) || r.quantity < 1,
      )
    ) {
      setLocalError('Confira quantidades (inteiras) e valores (ex.: 180,00).');
      return;
    }
    if (discountCents === null) return setLocalError('Desconto inválido (ex.: 30,00).');
    const body = {
      items: parsed,
      discountCents,
      validDays: Number(validDays),
      notes: notes || undefined,
    };
    if (draft)
      await api(path(`/quotes/${draft.id}/update`), {
        method: 'POST',
        json: { ...body, rowVersion: draft.rowVersion },
      });
    else await api(path(`/orders/${order.id}/quotes`), { method: 'POST', json: body });
    onDone();
  });
  const set = (i: number, k: keyof Row, v: string) =>
    setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save.run();
      }}
    >
      <ErrorAlert error={save.error} />
      {localError && <div className="alert error">{localError}</div>}
      {rows.map((r, i) => (
        <div key={i} className="grid2" style={{ alignItems: 'end' }}>
          <Field label={`Item ${i + 1}`} name={`items.${i}.description`} error={save.error}>
            <input
              id={`items.${i}.description`}
              required
              value={r.description}
              onChange={(e) => set(i, 'description', e.target.value)}
              placeholder="Ex.: Limpeza de dreno"
            />
          </Field>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div style={{ width: 90 }}>
              <label htmlFor={`q${i}`}>Qtd.</label>
              <input
                id={`q${i}`}
                inputMode="numeric"
                required
                value={r.quantity}
                onChange={(e) => set(i, 'quantity', e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor={`p${i}`}>Valor unitário (R$)</label>
              <input
                id={`p${i}`}
                inputMode="decimal"
                required
                value={r.unitPrice}
                onChange={(e) => set(i, 'unitPrice', e.target.value)}
                placeholder="0,00"
              />
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                className="secondary"
                aria-label={`Remover item ${i + 1}`}
                onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() => setRows((p) => [...p, { description: '', quantity: '1', unitPrice: '' }])}
      >
        Adicionar item
      </button>
      <div className="grid2">
        <Field label="Desconto (R$)" name="discountCents" error={save.error}>
          <input
            id="discountCents"
            inputMode="decimal"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </Field>
        <Field label="Validade (dias)" name="validDays" error={save.error}>
          <input
            id="validDays"
            inputMode="numeric"
            value={validDays}
            onChange={(e) => setValidDays(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Condições para o cliente (aparece na proposta)" name="notes" error={save.error}>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: garantia de 90 dias para o serviço."
        />
      </Field>
      <p>
        Subtotal {brl(subtotal)} · Desconto {brl(discountCents ?? 0)} ·{' '}
        <strong>Total {brl(Math.max(0, subtotal - (discountCents ?? 0)))}</strong>
      </p>
      <button disabled={save.pending}>{save.pending ? 'Salvando…' : 'Salvar rascunho'}</button>
    </form>
  );
}

function QuoteView({ q, timezone }: { q: Quote; timezone: string }) {
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qtd.</th>
            <th>Unitário</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {q.items.map((i) => (
            <tr key={i.position}>
              <td>{i.description}</td>
              <td>{i.quantity}</td>
              <td>{brl(i.unitPriceCents)}</td>
              <td>{brl(i.lineTotalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Subtotal {brl(q.subtotalCents)} · Desconto {brl(q.discountCents)} ·{' '}
        <strong>Total {brl(q.totalCents)}</strong>
      </p>
      {q.notes && <p className="muted">Condições: {q.notes}</p>}
      {q.sentAt && (
        <p className="muted" style={{ fontSize: '0.875rem' }}>
          Enviado em {dt(q.sentAt, timezone)} para {q.recipientEmail} · válido até{' '}
          {q.expiresAt && dt(q.expiresAt, timezone)}
          {q.decidedAt && ` · decidido em ${dt(q.decidedAt, timezone)}`}
        </p>
      )}
    </>
  );
}

export function QuoteSection({ order, reload }: { order: OrderDetail; reload: () => void }) {
  const { org, path } = useOrg();
  const quotes = (order.quotes as Quote[] | undefined) ?? [];
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(order.customer.email ?? '');
  const current = quotes[0];
  const draft = current?.status === 'DRAFT' ? current : undefined;
  const act = useAction(async (url: string, json: object = {}) => {
    await api(path(url), { method: 'POST', json });
    setEditing(false);
    reload();
  });
  const canEditStatus = ['TRIAGE', 'AWAITING_APPROVAL', 'APPROVED', 'SCHEDULED'].includes(
    order.status,
  );
  return (
    <div className="card">
      <div className="row spread">
        <h2 style={{ margin: 0 }}>Orçamento</h2>
        {current && (
          <span className="badge">
            v{current.version} · {QUOTE_STATUS[current.status]}
          </span>
        )}
      </div>
      <ErrorAlert error={act.error} />
      {order.status === 'OPEN' && (
        <p className="muted">Inicie a triagem para elaborar o orçamento.</p>
      )}
      {order.status === 'TRIAGE' && !draft && !editing && (
        <>
          {current && (
            <p className="muted">
              A versão anterior foi {QUOTE_STATUS[current.status]?.toLowerCase()}. Crie uma nova
              versão.
            </p>
          )}
          <button onClick={() => setEditing(true)}>Elaborar orçamento</button>
        </>
      )}
      {editing && !draft && (
        <Editor
          order={order}
          onDone={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
      {draft &&
        (editing ? (
          <Editor
            order={order}
            draft={draft}
            onDone={() => {
              setEditing(false);
              reload();
            }}
          />
        ) : (
          <>
            <QuoteView q={draft} timezone={org.timezone} />
            <div className="stack">
              <button className="secondary" onClick={() => setEditing(true)}>
                Editar rascunho
              </button>
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    confirm(
                      `Enviar a versão ${draft.version} (${brl(draft.totalCents)}) para ${email}? Depois do envio ela não poderá ser alterada.`,
                    )
                  )
                    void act.run(`/quotes/${draft.id}/send`, {
                      rowVersion: draft.rowVersion,
                      recipientEmail: email || undefined,
                    });
                }}
              >
                <Field
                  label="E-mail do cliente para receber o link"
                  name="recipientEmail"
                  error={act.error}
                >
                  <input
                    id="recipientEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <button disabled={act.pending}>Enviar ao cliente</button>
              </form>
            </div>
          </>
        ))}
      {current && current.status !== 'DRAFT' && (
        <>
          <QuoteView q={current} timezone={org.timezone} />
          {['SENT', 'ACCEPTED'].includes(current.status) && canEditStatus && (
            <button
              className="secondary"
              onClick={() => {
                if (
                  confirm(
                    'Revisar invalida o link enviado e cancela a visita de execução agendada. Continuar?',
                  )
                )
                  void act.run(`/quotes/${current.id}/revise`);
              }}
            >
              Revisar orçamento
            </button>
          )}
        </>
      )}
      {quotes.length > 1 && (
        <details>
          <summary>Versões anteriores ({quotes.length - 1})</summary>
          {quotes.slice(1).map((q) => (
            <p key={q.id} className="muted">
              v{q.version} · {QUOTE_STATUS[q.status]} · {brl(q.totalCents)}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
