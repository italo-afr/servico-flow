'use client';
import { useEffect, useState } from 'react';
import { useOrg } from './org';
import type { OrderDetail } from './order-sections';
import { ErrorAlert, useAction } from './ui';
import { api, ApiRequestError } from '@/lib/api';

interface Photo {
  id: string;
  width: number;
  height: number;
  uploadedBy: string;
  createdAt: string;
}

/** Miniatura carrega URL assinada curta sob demanda; nunca há link permanente. */
function Thumb({ id }: { id: string }) {
  const { path } = useOrg();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    void api<{ url: string }>(path(`/attachments/${id}/url`)).then((r) => setUrl(r.url));
  }, [id, path]);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img
        src={url}
        alt="Foto do atendimento"
        style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8 }}
      />
    </a>
  ) : (
    <div style={{ width: 120, height: 90, background: 'var(--border)', borderRadius: 8 }} />
  );
}

export function PhotosSection({ order, reload }: { order: OrderDetail; reload: () => void }) {
  const { path } = useOrg();
  const photos = (order.attachments as Photo[] | undefined) ?? [];
  const [status, setStatus] = useState('');
  const upload = useAction(async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new ApiRequestError(422, {
        code: 'TYPE',
        message: 'Use fotos JPEG, PNG ou WebP.',
        requestId: '-',
      });
    }
    setStatus('Autorizando…');
    const init = await api<{ id: string; uploadUrl: string; headers: Record<string, string> }>(
      path('/attachments/initiate'),
      {
        method: 'POST',
        json: { orderId: order.id, contentType: file.type, sizeBytes: file.size },
      },
    );
    setStatus('Enviando…');
    const put = await fetch(init.uploadUrl, {
      method: 'PUT',
      headers: init.headers,
      body: file,
    }).catch(() => null);
    if (!put?.ok)
      throw new ApiRequestError(0, {
        code: 'UPLOAD',
        message: 'O envio não terminou. Verifique a conexão e tente de novo.',
        requestId: '-',
      });
    setStatus('Verificando imagem…');
    await api(path(`/attachments/${init.id}/finalize`), { method: 'POST', json: {} });
    setStatus('');
    reload();
  });
  const terminal = order.status === 'CANCELLED';
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Fotos</h2>
      <ErrorAlert error={upload.error} />
      {photos.length === 0 && <p className="muted">Nenhuma foto.</p>}
      <div className="row">
        {photos.map((p) => (
          <Thumb key={p.id} id={p.id} />
        ))}
      </div>
      {!terminal && photos.length < 10 && (
        <div>
          <label htmlFor="photo" className="button secondary" style={{ display: 'inline-flex' }}>
            {upload.pending ? status || 'Enviando…' : 'Adicionar foto'}
          </label>
          <input
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={upload.pending}
            style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void upload.run(file);
            }}
          />
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            JPEG, PNG ou WebP até 5 MB · até 10 por ordem. Metadados como localização são removidos.
          </p>
        </div>
      )}
    </div>
  );
}
