# ADR-0007 — Armazenamento privado e validação de imagens

**Status:** aceito · 2026-11-03

**Decisão.** Fluxo em três passos: `initiate` (autoriza, aplica quota de 10 fotos/ordem e 5 MB, cria chave interna em `quarantine/`, devolve URL de upload de 5 min) → upload direto ao storage → `finalize` (lê o bruto, valida pelo **conteúdo** com `sharp`: JPEG/PNG/WebP, ≤ 8000 px por lado, ≤ 40 MP; reprocessa para WebP ≤ 2560 px **sem metadados EXIF/GPS**; apaga o bruto). Download: URL assinada de 5 min emitida após checar empresa, ordem e papel (técnico só com visita atribuída). Uploads abandonados (> 1 h) são limpos pelo worker. Adaptadores: S3-compatível (produção, obrigatório) e disco local com URLs HMAC (somente dev/testes).

**Limite.** URL pré-assinada de `PUT` no S3 não impõe tamanho máximo; o tamanho é verificado no `finalize` (o objeto excedente é apagado). Quota por empresa em bytes ainda não implementada.

**Verificação.** `attachments.test.ts`: EXIF removido, T17, SVG recusado, T18 (outra empresa, assinatura adulterada, URL expirada), quota, limpeza.
