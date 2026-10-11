import { poNumberForDisplay, type Inquiry } from "../store/orders";

export interface DispatchRow {
  id: string;
  jo: string;
  po: string;
  si: string;
  client: string;
  contact: string;
  clientAddress: string;
  clientPhone: string;
  item: string;
  itemCode?: string;
  enterFilPN?: string;
  qty: number;
  method: string;
  waybillIdentifier: string;
  status: "Ready for Dispatch" | "Dispatched" | "Delivered" | "Paid";
  sketch?: string;
  specs?: { od1?: string; od2?: string; id1?: string; id2?: string; height?: string; overallHeight?: string; media?: string; innerCore?: string; outerCore?: string; oring?: string; gasket?: string; oem?: string; brand?: string };
}

export interface LogRow {
  id: string;
  date: string;
  waybillNo: string;
  jo: string;
  client: string;
  item: string;
  qty: number;
  method: string;
  status: string;
  note?: string;
  processedBy: string;
  matchedJob?: DispatchRow;
}

export function generatedWaybillIdentifier(inquiry: Inquiry): string {
  const source = (inquiry.joNumber?.trim() || inquiry.code || inquiry.id)
    .replace(/^JO[-\s]?/i, "")
    .replace(/[^a-z\d]/gi, "")
    .toUpperCase();
  return `EF-${source}`;
}

const stageStatus = (stage: Inquiry["stage"]): DispatchRow["status"] => {
  if (stage === "ready_for_dispatch") return "Ready for Dispatch";
  if (stage === "dispatched") return "Dispatched";
  if (stage === "paid") return "Paid";
  return "Delivered";
};

export function inquiryToDispatchRow(inquiry: Inquiry): DispatchRow {
  const product = inquiry.products[0];
  const oem = product?.oem;
  const description = product?.filterName ?? product?.type ?? "—";

  return {
    id: inquiry.id,
    jo: inquiry.joNumber ?? `JO-${inquiry.code}`,
    po: poNumberForDisplay(inquiry) ?? inquiry.code,
    si: inquiry.invoiceNo ?? `SI-${inquiry.code}`,
    client: inquiry.clientName,
    contact: inquiry.contactPerson,
    clientAddress: "—",
    clientPhone: "—",
    item: oem ? `${description} — ${oem}` : description,
    itemCode: product?.type,
    enterFilPN: oem,
    qty: inquiry.products.reduce((sum, item) => sum + item.qty, 0),
    method: inquiry.deliveryMethod ?? "—",
    waybillIdentifier: inquiry.waybillIdentifier?.trim() || generatedWaybillIdentifier(inquiry),
    status: stageStatus(inquiry.stage),
    sketch: inquiry.joSketch,
    specs: inquiry.joSpecs ? {
      od1: inquiry.joSpecs.od1, od2: inquiry.joSpecs.od2, id1: inquiry.joSpecs.id1, id2: inquiry.joSpecs.id2,
      height: inquiry.joSpecs.height, overallHeight: inquiry.joSpecs.overallHeight,
      media: inquiry.joSpecs.media, innerCore: inquiry.joSpecs.innerCore, outerCore: inquiry.joSpecs.outerCore,
      oring: inquiry.joSpecs.oring, gasket: inquiry.joSpecs.gasket, oem: inquiry.joSpecs.oem, brand: inquiry.joSpecs.brand,
    } : undefined,
  };
}

export function buildWaybillHistory(inquiries: Inquiry[]): LogRow[] {
  const rows: LogRow[] = [];

  for (const inquiry of inquiries) {
    const dispatchRow = inquiryToDispatchRow(inquiry);
    const waybillLog = inquiry.waybillLog ?? [];

    if (waybillLog.length > 0) {
      for (let index = 0; index < waybillLog.length; index++) {
        const entry = waybillLog[index];
        rows.push({
          id: `${inquiry.id}-wl-${index}`,
          date: new Date(entry.ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          waybillNo: inquiry.waybillNumber?.trim() || dispatchRow.waybillIdentifier,
          jo: dispatchRow.jo,
          client: dispatchRow.client,
          item: dispatchRow.item,
          qty: dispatchRow.qty,
          method: dispatchRow.method,
          status: entry.status,
          note: entry.note,
          processedBy: "P. Tan",
          matchedJob: dispatchRow,
        });
      }
    } else if (
      inquiry.stageHistory && inquiry.stageHistory.length > 0 &&
      ["delivered", "paid", "dispatched"].includes(inquiry.stage)
    ) {
      const lastEntry = inquiry.stageHistory[inquiry.stageHistory.length - 1];
      rows.push({
        id: `${inquiry.id}-sh`,
        date: new Date(lastEntry.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        waybillNo: inquiry.waybillNumber?.trim() || dispatchRow.waybillIdentifier,
        jo: dispatchRow.jo,
        client: dispatchRow.client,
        item: dispatchRow.item,
        qty: dispatchRow.qty,
        method: dispatchRow.method,
        status: dispatchRow.status,
        processedBy: lastEntry.completedBy,
        matchedJob: dispatchRow,
      });
    }
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
