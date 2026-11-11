import type { Inquiry, PaymentRecord, ProductLine, Stage } from "./orders";

type DemoOrderPlan = {
  id: string;
  stage: Stage;
  productType: string;
  quantity: number;
  materialCost: number;
  labor: number;
  markupPct: number;
  deliveryMethod: NonNullable<Inquiry["deliveryMethod"]>;
  clientName: string;
  contactPerson: string;
  paymentTerms: Inquiry["paymentTerms"];
  daysAgo: number;
  invoiceStatus?: "partial" | "paid";
};

function dateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function pdfDataUrl(title: string, lines: string[]): string {
  const text = [title, "DEMONSTRATION DATA ONLY - NOT A BUSINESS DOCUMENT", ...lines]
    .map((line) => line.replace(/[\\()]/g, "\\$&"));
  const stream = `BT /F1 16 Tf 48 760 Td (${text[0]}) Tj /F1 10 Tf 0 -28 Td (${text[1]}) Tj 0 -28 Td (${text.slice(2).join(") Tj 0 -20 Td (")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return `data:application/pdf,${encodeURIComponent(document)}`;
}

function nextSequence(inquiries: Inquiry[], getValue: (inquiry: Inquiry) => string | undefined, prefix: string): number {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
  return inquiries.reduce((next, inquiry) => {
    const match = getValue(inquiry)?.match(pattern);
    return match ? Math.max(next, Number(match[1]) + 1) : next;
  }, 1);
}

function paymentRecord(
  inquiryId: string,
  invoiceNo: string,
  paymentType: PaymentRecord["paymentType"],
  amount: number,
  status: PaymentRecord["verificationStatus"],
  paymentDate: Date,
  receiptDataUrl: string,
  index: string,
): PaymentRecord {
  return {
    id: `${inquiryId}-${index}`,
    inquiryId,
    invoiceNo,
    paymentType,
    submittedAmount: amount,
    verifiedAmount: status === "verified" ? amount : undefined,
    method: "BDO Bank Transfer",
    referenceNumber: `DEMO-REF-${invoiceNo}-${index.toUpperCase()}`,
    receiptFile: `DEMO-RECEIPT-${invoiceNo}-${index.toUpperCase()}.pdf`,
    receiptDataUrl,
    paymentDate: shortDate(paymentDate),
    verificationStatus: status,
    verifiedAt: status === "verified" ? paymentDate.toISOString() : undefined,
    rejectedAt: status === "rejected" ? new Date(paymentDate.getTime() + 24 * 60 * 60 * 1000).toISOString() : undefined,
    rejectionReason: status === "rejected" ? "Demonstration sample; receipt is not proof of an actual transfer." : undefined,
    note: "DEMONSTRATION DATA ONLY - not a real payment.",
  };
}

export function createDemoInquiries(existing: Inquiry[]): Inquiry[] {
  const year = new Date().getFullYear();
  let poSequence = nextSequence(existing, (inquiry) => inquiry.poNumber, `PO-${year}`);
  let joSequence = nextSequence(existing, (inquiry) => inquiry.joNumber, `JO-${year}`);
  let invoiceSequence = nextSequence(existing, (inquiry) => inquiry.invoiceNo, `SI-${year}`);
  let receiptSequence = nextSequence(existing, (inquiry) => inquiry.deliveryReceiptNumber, `DR-${year}`);

  const plans: DemoOrderPlan[] = [
    { id: "demo-invoice-partial", stage: "delivered", productType: "Pleated Filter ZS20", quantity: 30, materialCost: 1_000, labor: 250, markupPct: 28, deliveryMethod: "Fast Cargo", clientName: "B.E. Aerospace", contactPerson: "M. Rivera", paymentTerms: "30-Day Terms", daysAgo: 8, invoiceStatus: "partial" },
    { id: "demo-invoice-paid", stage: "paid", productType: "Air Filter", quantity: 20, materialCost: 1_600, labor: 400, markupPct: 25, deliveryMethod: "Client Pick-up", clientName: "B.E. Aerospace", contactPerson: "M. Rivera", paymentTerms: "30-Day Terms", daysAgo: 20, invoiceStatus: "paid" },
    { id: "demo-invoice-paid-second", stage: "paid", productType: "Oil Filter", quantity: 24, materialCost: 950, labor: 250, markupPct: 30, deliveryMethod: "AP Cargo", clientName: "B.E. Aerospace", contactPerson: "M. Rivera", paymentTerms: "30-Day Terms", daysAgo: 15, invoiceStatus: "paid" },
  ];

  return plans.map((plan, index) => {
    const inquiryId = plan.id;
    const submittedAt = dateDaysAgo(plan.daysAgo + 20);
    const quotationAt = dateDaysAgo(plan.daysAgo + 18);
    const poNumber = `PO-${year}-${String(poSequence++).padStart(4, "0")}`;
    const joNumber = `JO-${year}-${String(joSequence++).padStart(4, "0")}`;
    const productId = `${inquiryId}-product`;
    const product: ProductLine = {
      id: productId,
      type: plan.productType,
      filterName: plan.productType,
      qty: plan.quantity,
      od1: "175",
      id1: "20",
      height: "250",
      media: "Microglass Fiber",
      oem: `DEMO-${plan.productType.toUpperCase().replaceAll(" ", "-")}`,
      notes: "Demonstration order - not a business transaction.",
    };
    const unitPrice = Math.round((plan.materialCost + plan.labor) * (1 + plan.markupPct / 100));
    const invoiceAmount = unitPrice * plan.quantity;
    const invoiceNo = plan.invoiceStatus ? `SI-${year}-${String(invoiceSequence++).padStart(4, "0")}` : undefined;
    const deliveryReceiptNumber = plan.stage === "ready_for_dispatch" || plan.stage === "dispatched" || plan.stage === "delivered" || plan.stage === "paid"
      ? `DR-${year}-${String(receiptSequence++).padStart(4, "0")}`
      : undefined;
    const poDataUrl = pdfDataUrl("Sample Purchase Order", [
      `Reference: ${poNumber}`,
      `Client: ${plan.clientName}`,
      `Item: ${plan.productType} - ${plan.quantity} pcs`,
      "This document is for demonstration only.",
    ]);
    const signedReceiptAt = plan.stage === "delivered" || plan.stage === "paid"
      ? dateDaysAgo(plan.daysAgo).toISOString()
      : undefined;
    const dueAt = signedReceiptAt ? new Date(signedReceiptAt) : undefined;
    dueAt?.setDate(dueAt.getDate() + (plan.paymentTerms === "30-Day Terms" ? 30 : 15));
    const stageCursor = plan.stage === "in_production" ? (index === 0 ? 3 : 5)
      : plan.stage === "quality_inspection" ? 8 : 9;
    const invoiceSentAt = plan.invoiceStatus ? dateDaysAgo(plan.daysAgo + 2).toISOString() : undefined;
    const inquiry: Inquiry = {
      id: inquiryId,
      code: `DEMO-INQ-${String(index + 1).padStart(3, "0")}`,
      clientName: plan.clientName,
      contactPerson: plan.contactPerson,
      generalNotes: "DEMONSTRATION DATA ONLY - sample record, not an actual business transaction.",
      paymentTerms: plan.paymentTerms,
      products: [product],
      stage: plan.stage,
      submittedDate: shortDate(submittedAt),
      quotation: {
        sentDate: shortDate(quotationAt),
        leadTimeDays: 18,
        lines: [{ productId, materialCost: plan.materialCost, labor: plan.labor, markupPct: plan.markupPct }],
      },
      poUploaded: true,
      poReceived: true,
      poNumber,
      poFileName: `DEMO-${poNumber}.pdf`,
      poFileDataUrl: poDataUrl,
      poUploadedAt: quotationAt.toISOString(),
      joNumber,
      joCompletedAt: quotationAt.toISOString(),
      joSpecs: { od1: "175", id1: "20", height: "250", media: "Microglass Fiber", oem: product.oem },
      joSketch: `${plan.id}-specification.pdf`,
      signedQuotationFile: `DEMO-Q-${joNumber}.pdf`,
      invoiceNo,
      invoiceAmount,
      invoiceDate: invoiceSentAt ? shortDate(new Date(invoiceSentAt)) : undefined,
      invoiceSentAt,
      invoiceDueDate: dueAt ? shortDate(dueAt) : undefined,
      downpaymentPercent: plan.invoiceStatus ? 50 : undefined,
      downpaymentAmount: plan.invoiceStatus ? invoiceAmount / 2 : undefined,
      deliveryMethod: plan.deliveryMethod,
      deliveryReceiptNumber,
      deliveryReceiptGeneratedAt: deliveryReceiptNumber ? quotationAt.toISOString() : undefined,
      deliveryReceiptGeneratedBy: deliveryReceiptNumber ? "Demo Accounting" : undefined,
      deliveryReceiptSentToLogisticsAt: deliveryReceiptNumber ? quotationAt.toISOString() : undefined,
      waybillNumber: deliveryReceiptNumber ? `DEMO-WB-${String(receiptSequence - 1).padStart(4, "0")}` : undefined,
      waybillPrintedAt: deliveryReceiptNumber ? quotationAt.toISOString() : undefined,
      trackingRef: plan.stage === "dispatched" || plan.stage === "delivered" || plan.stage === "paid"
        ? `DEMO-TRACK-${String(index + 1).padStart(3, "0")}`
        : undefined,
      dispatchedAt: plan.stage === "dispatched" || plan.stage === "delivered" || plan.stage === "paid"
        ? dateDaysAgo(plan.daysAgo + (signedReceiptAt ? 1 : 0)).toISOString()
        : undefined,
      deliveryReceiptSentAt: plan.stage === "dispatched" || plan.stage === "delivered" || plan.stage === "paid"
        ? dateDaysAgo(plan.daysAgo + (signedReceiptAt ? 1 : 0)).toISOString()
        : undefined,
      deliveredDate: signedReceiptAt ? shortDate(new Date(signedReceiptAt)) : undefined,
      signedDeliveryReceiptFileName: signedReceiptAt ? `DEMO-SIGNED-${deliveryReceiptNumber}.pdf` : undefined,
      signedDeliveryReceiptSubmittedBy: signedReceiptAt ? "Demo Client Contact" : undefined,
      signedDeliveryReceiptReceivedAt: signedReceiptAt,
      signedDeliveryReceiptNumber: signedReceiptAt ? deliveryReceiptNumber : undefined,
      signedDeliveryReceiptDataUrl: signedReceiptAt
        ? pdfDataUrl("Sample Signed Delivery Receipt", [
            `Receipt: ${deliveryReceiptNumber}`,
            `Job Order: ${joNumber}`,
            `Client: ${plan.clientName}`,
            `Item: ${plan.productType} - ${plan.quantity} pcs`,
          ])
        : undefined,
      clientSignedDRUploadedAt: signedReceiptAt,
      fulfillmentCompletedAt: signedReceiptAt,
      paymentCycleStartedAt: signedReceiptAt,
      currentStage: stageCursor,
      stageHistory: Array.from({ length: stageCursor }, (_, stage) => ({
        stage,
        completedAt: dateDaysAgo(plan.daysAgo + stageCursor - stage).toISOString(),
        completedBy: ["F. Santos", "J. Reyes", "M. Tan"][stage % 3],
        status: "done" as const,
      })),
      ...(invoiceStatusFields(plan.invoiceStatus, inquiryId, invoiceNo, invoiceAmount, signedReceiptAt)),
      ...(plan.stage === "paid" ? { paidAt: signedReceiptAt } : {}),
    };
    return inquiry;
  });
}

function invoiceStatusFields(
  status: DemoOrderPlan["invoiceStatus"],
  inquiryId: string,
  invoiceNo: string | undefined,
  invoiceAmount: number,
  signedReceiptAt: string | undefined,
): Pick<Inquiry, "payments"> {
  if (!status || !invoiceNo) return {};
  const receiptDate = signedReceiptAt ? new Date(signedReceiptAt) : dateDaysAgo(3);
  const invoiceCents = Math.round(invoiceAmount * 100);
  const requiredDownpayment = Math.round(invoiceCents / 2) / 100;
  const balanceDate = new Date(receiptDate.getTime() + 4 * 24 * 60 * 60 * 1000);
  const balancePayment = status === "partial"
    ? Math.round(invoiceCents / 4) / 100
    : invoiceAmount - requiredDownpayment;
  const proof = (amount: number) => pdfDataUrl("Sample Payment Receipt", [
    "This is a fictional demonstration document - not proof of an actual transfer.",
    `Invoice: ${invoiceNo}`,
    `Amount: PHP ${amount.toFixed(2)}`,
  ]);
  return {
    payments: [
      paymentRecord(
        inquiryId, invoiceNo, "DOWNPAYMENT", requiredDownpayment, "verified", receiptDate,
        proof(requiredDownpayment), "verified-downpayment",
      ),
      paymentRecord(
        inquiryId, invoiceNo, "BALANCE_PAYMENT", balancePayment, "verified", balanceDate,
        proof(balancePayment), "verified-balance",
      ),
    ],
  };
}
