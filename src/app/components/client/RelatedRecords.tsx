import { useClientData, unavailable } from './data';

// Preserve all API relationships and exact decimal strings; never fill missing fields with Demo data.
export function RelatedRecords({ surface }: { surface: string }) {
  const { bundles, loading, error } = useClientData();
  if (loading) return null;
  return <section className="px-4 pb-8 sm:px-8 font-dm" aria-label="Returned related records">
    {bundles.map(bundle => <details key={bundle.order.id} className="mb-3 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-[#1A2B4A]">{bundle.order.reference} · Related records and availability</summary>
      <div className="space-y-3 border-t p-5 text-xs text-slate-700">
        {bundle.errors.length > 0 && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3">Some data could not be loaded: {bundle.errors.join(' ')}</div>}
        {surface === 'orders' && <>
          <p>Current stage: {bundle.order.stageLabel ?? 'Unavailable'}. Requested delivery: {bundle.order.requestedDeliveryDate ?? 'Unavailable'}.</p>
          {bundle.quotations.map(q => <div key={q.id} className="rounded border p-3"><b>{q.reference} · Revision {q.revisionNumber} · {q.status}</b><p>Total: ₱{q.totalAmount} · Required downpayment: ₱{q.downpaymentAmount}</p>{q.lines.map(line => <p key={line.id}>{line.description} · {line.quantity} {line.unitLabel} · ₱{line.unitPrice}</p>)}</div>)}
          <p>PO: {bundle.purchaseOrder?.reference ?? 'No PO returned'}. PO review/submission history and file contents: unavailable from the Client API.</p>
        </>}
        {surface === 'status' && <>
          {bundle.jobOrders.map(job => <div key={job.id} className="rounded border p-3"><b>{job.reference}</b><p>{job.quantity} pcs · {job.status ?? 'Status unavailable'} · {job.productionStageLabel ?? 'Stage unavailable'}</p><p>Due: {job.productionDueDate ?? 'Unavailable'} · Completed: {job.completedAt ?? 'Not confirmed'}</p></div>)}
          <p>Job-to-product associations and internal stage event history are unavailable from the Client API.</p>
        </>}
        {surface === 'logistics' && <>
          {bundle.shipments.map(s => <div key={s.id} className="rounded border p-3"><b>{s.deliveryMethodLabel} · {s.status ?? 'Status unavailable'}</b><p>Job: {bundle.jobOrders.find(j => j.id === s.jobOrderId)?.reference ?? s.jobOrderId} · Tracking: {s.trackingReference ?? 'Unavailable'}</p><p>Estimated delivery: {s.estimatedDeliveryDate ?? 'Unavailable'} · Pickup: {s.expectedPickupDate ?? 'Unavailable'}</p><p>Dispatched: {s.dispatchedAt ?? 'Unavailable'} · Delivered: {s.deliveredAt ?? 'Unavailable'}</p></div>)}
          <p>Tracking links, delivery receipt documents, signed receipts and handoff history: unavailable from the Client API.</p>
          <button className="rounded border px-3 py-2" onClick={() => unavailable()}>View / Download Receipt · Not connected</button>
        </>}
        {surface === 'accounting' && <>
          {bundle.invoices.map(i => <div key={i.id} className="rounded border p-3"><b>{i.reference}</b><p>Amount: ₱{i.amount} · Required downpayment: ₱{i.requiredDownpayment}</p><p>Due: {i.dueOn ?? 'Unavailable'} · Payment cycle: {i.paymentCycleStartedAt ?? 'Not confirmed'}</p></div>)}
          {bundle.payments.map(p => <div key={p.id} className="rounded border p-3"><b>{p.paymentType} · {p.verificationStatus}</b><p>Invoice: {bundle.invoices.find(i => i.id === p.invoiceId)?.reference ?? p.invoiceId ?? 'Not allocated'}</p><p>Submitted: ₱{p.submittedAmount} · Verified: {p.verifiedAmount == null ? 'Not verified' : `₱${p.verifiedAmount}`}</p><p>{p.method ?? 'Method unavailable'} · {p.referenceNumber ?? 'Reference unavailable'}</p></div>)}
          <p>Bank/payment instructions, invoice line allocation, receipt files and Official Receipts: unavailable from the Client API.</p>
        </>}
      </div>
    </details>)}
    {!bundles.length && !error && <p className="text-sm text-slate-500">No records were returned for this Client account.</p>}
  </section>;
}
