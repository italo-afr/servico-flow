-- 0005: corrige a regra de decisão de 0004. Um orçamento ACEITO pode ser substituído
-- (revisão antes da execução) e mantém decided_at como histórico.
ALTER TABLE quotes DROP CONSTRAINT quotes_check3; -- nome gerado pelo PostgreSQL para o CHECK de decided_at em 0004
ALTER TABLE quotes ADD CONSTRAINT quotes_decision_consistent CHECK (
  (status NOT IN ('ACCEPTED', 'REJECTED') OR decided_at IS NOT NULL)
  AND (decided_at IS NULL OR status IN ('ACCEPTED', 'REJECTED', 'SUPERSEDED'))
);
