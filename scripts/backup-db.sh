#!/usr/bin/env bash
# Backup lógico adicional do PostgreSQL (complementa o backup automático do provedor).
# Uso: DATABASE_URL=... BACKUP_DIR=/var/backups/servicoflow scripts/backup-db.sh
# Copie o arquivo para armazenamento EXTERNO e criptografado; um volume local não é backup.
set -euo pipefail
: "${DATABASE_URL:?defina DATABASE_URL}"
: "${BACKUP_DIR:?defina BACKUP_DIR}"
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/servicoflow-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --file="$file" "$DATABASE_URL"
pg_restore --list "$file" > /dev/null # confere que o arquivo é legível
echo "backup ok: $file ($(du -h "$file" | cut -f1))"
