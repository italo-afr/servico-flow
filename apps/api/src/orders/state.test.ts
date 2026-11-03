import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, isTerminal, ORDER_STATUSES } from './state.js';

describe('máquina de estados da ordem', () => {
  it('segue o caminho feliz completo', () => {
    const path = [
      'OPEN',
      'TRIAGE',
      'AWAITING_APPROVAL',
      'APPROVED',
      'SCHEDULED',
      'IN_PROGRESS',
      'COMPLETED',
    ] as const;
    for (let i = 0; i < path.length - 1; i++)
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });
  it('não pula etapas: OPEN não vai direto para APPROVED; TRIAGE não vai para SCHEDULED', () => {
    expect(canTransition('OPEN', 'APPROVED')).toBe(false);
    expect(canTransition('TRIAGE', 'SCHEDULED')).toBe(false);
    expect(() => assertTransition('OPEN', 'COMPLETED')).toThrow(/não pode/);
  });
  it('recusa/expiração devolve à triagem; revisão antes da execução também', () => {
    expect(canTransition('AWAITING_APPROVAL', 'TRIAGE')).toBe(true);
    expect(canTransition('APPROVED', 'TRIAGE')).toBe(true);
    expect(canTransition('SCHEDULED', 'TRIAGE')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'TRIAGE')).toBe(false); // escopo financeiro não muda em execução
  });
  it('estados terminais não têm saída', () => {
    expect(isTerminal('COMPLETED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    for (const s of ORDER_STATUSES)
      if (!isTerminal(s)) expect(canTransition(s, 'CANCELLED')).toBe(true);
  });
});
