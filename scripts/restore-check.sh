#!/usr/bin/env bash
# Ensaio de restauração em banco ISOLADO (T22). Nunca aponte TARGET_URL para produção.
# Uso: BACKUP_FILE=... TARGET_URL=postgres://.../servicoflow_restore scripts/restore-check.sh
set -euo pipefail
: "${BACKUP_FILE:?}"; : "${TARGET_URL:?}"
case "$TARGET_URL" in *restore*) ;; *) echo "Recusado: TARGET_URL deve conter 'restore'"; exit 1;; esac
start=$(date +%s)
pg_restore --no-owner --clean --if-exists -d "$TARGET_URL" "$BACKUP_FILE"
# Impede envio de notificações antigas até reconciliar (brief 11.9 item 7)
psql "$TARGET_URL" -c "UPDATE outbox_events SET status = 'SUPPRESSED', last_error = 'restore_hold' WHERE status IN ('PENDING','PROCESSING')"
psql "$TARGET_URL" -Atc "SELECT 'ordens', count(*) FROM service_orders UNION ALL SELECT 'orcamentos', count(*) FROM quotes UNION ALL SELECT 'visitas', count(*) FROM appointments UNION ALL SELECT 'migrations', count(*) FROM schema_migrations UNION ALL SELECT 'ordens_orfas', count(*) FROM service_orders so LEFT JOIN customers c ON c.organization_id = so.organization_id AND c.id = so.customer_id WHERE c.id IS NULL"
echo "restauração concluída em $(( $(date +%s) - start )) s"
