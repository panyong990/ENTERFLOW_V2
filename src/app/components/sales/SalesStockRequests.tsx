import type { SalesOrderRow } from "../useSalesOrders";
import { StockRequestsModal } from "./StockRequestsModal";
import { inquiryDraft } from "./drafts";
import { usePipelineDetails } from "./usePipelineDetails";
export function SalesStockRequests({ onClose, rows }: { onClose: () => void; rows: SalesOrderRow[] }) {
  const details = usePipelineDetails(rows, true);
  return <StockRequestsModal mode="sales" onClose={onClose} inquiries={Object.values(details.records).map(inquiryDraft)} />;
}
