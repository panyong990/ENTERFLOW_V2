const ATTACHMENTS_DB_NAME = "enterflow.attachments.v1";
const ATTACHMENTS_STORE_NAME = "files";

interface AttachmentRecord {
  key: string;
  dataUrl: string;
}

export interface PersistedAttachmentSet {
  poFileDataUrl?: string;
  paymentReceiptDataUrls: Record<string, string>;
}

function openAttachmentsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is unavailable in this browser"));
      return;
    }
    const request = window.indexedDB.open(ATTACHMENTS_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(ATTACHMENTS_STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
  });
}

function attachmentKey(inquiryId: string, kind: "po" | "payment", childId?: string) {
  return childId ? `${inquiryId}:${kind}:${childId}` : `${inquiryId}:${kind}`;
}

export async function saveInquiryAttachments(
  inquiryId: string,
  attachments: PersistedAttachmentSet,
): Promise<void> {
  const db = await openAttachmentsDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(ATTACHMENTS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(ATTACHMENTS_STORE_NAME);
    if (attachments.poFileDataUrl) {
      store.put({ key: attachmentKey(inquiryId, "po"), dataUrl: attachments.poFileDataUrl } satisfies AttachmentRecord);
    }
    Object.entries(attachments.paymentReceiptDataUrls).forEach(([paymentId, dataUrl]) => {
      store.put({ key: attachmentKey(inquiryId, "payment", paymentId), dataUrl } satisfies AttachmentRecord);
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save attachments"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Attachment transaction was aborted"));
  });
  db.close();
}

export async function loadInquiryAttachments(inquiryId: string): Promise<PersistedAttachmentSet> {
  const db = await openAttachmentsDb();
  const records = await new Promise<AttachmentRecord[]>((resolve, reject) => {
    const transaction = db.transaction(ATTACHMENTS_STORE_NAME, "readonly");
    const request = transaction.objectStore(ATTACHMENTS_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as AttachmentRecord[]);
    request.onerror = () => reject(request.error ?? new Error("Could not load attachments"));
  });
  db.close();
  const prefix = `${inquiryId}:`;
  const result: PersistedAttachmentSet = { paymentReceiptDataUrls: {} };
  records.filter((record) => record.key.startsWith(prefix)).forEach((record) => {
    if (record.key === attachmentKey(inquiryId, "po")) {
      result.poFileDataUrl = record.dataUrl;
    } else if (record.key.startsWith(`${inquiryId}:payment:`)) {
      result.paymentReceiptDataUrls[record.key.slice(`${inquiryId}:payment:`.length)] = record.dataUrl;
    }
  });
  return result;
}
