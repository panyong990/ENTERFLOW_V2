import { useEffect, useState } from 'react';
import { api } from '../api/client';

type Sketch = { id: string; originalFilename: string; mimeType: string; sizeBytes: number | string };
export function EngineerSketchSection({ orderId, itemId, label }: { orderId: string; itemId: string; label: string }) {
  const [open, setOpen] = useState(false);
  return <details className="mt-3 rounded-md border border-slate-200 bg-white p-3" onToggle={event => setOpen(event.currentTarget.open)}><summary className="font-dm text-xs font-semibold">Engineer sketch · {label}</summary>{open && <EngineerSketches orderId={orderId} itemId={itemId} scope="client" />}</details>;
}
export function EngineerSketches({ orderId, itemId, scope }: { orderId: string; itemId: string; scope: 'client' | 'sales' }) {
  const [state, setState] = useState<{ files: Sketch[]; loading: boolean; error: string }>({ files: [], loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const path = `/api/documents/${scope}/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/sketches`;
  useEffect(() => {
    const controller = new AbortController();
    setState({ files: [], loading: true, error: '' });
    api<Sketch[]>(path, { signal: controller.signal }).then(files => {
      if (!Array.isArray(files)) throw new Error('Invalid sketch response.');
      if (!controller.signal.aborted) setState({ files, loading: false, error: '' });
    }).catch(error => { if (!controller.signal.aborted) setState({ files: [], loading: false, error: error.message }); });
    return () => controller.abort();
  }, [path, revision]);
  if (state.loading) return <p role="status" className="mt-2 font-dm text-xs text-slate-500">Loading engineer sketches…</p>;
  if (state.error) return <div role="alert" className="mt-2 font-dm text-xs text-red-700">{state.error} <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>Retry</button></div>;
  return <div className="mt-2 font-dm text-xs text-slate-600">{state.files.length ? state.files.map(file => <a key={file.id} href={`${path}/${encodeURIComponent(file.id)}`} target="_blank" rel="noopener noreferrer" className="mr-3 inline-block text-blue-700 underline">View engineer sketch: {file.originalFilename}</a>) : 'No engineer sketch attached.'}</div>;
}
