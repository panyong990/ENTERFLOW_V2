const ATTACHMENTS_DB_NAME = "enterflow.attachments.v1";
const ATTACHMENTS_STORE_NAME = "files";

interface AttachmentRecord {
  key: string;
  dataUrl: string;
}

export interface PersistedAttachmentSet {
  poFileDataUrl?: string;
  paymentReceiptDataUrls: Record<string, string>;
  pendingSignedDeliveryReceiptDataUrl?: string;
  signedDeliveryReceiptDataUrl?: string;
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

function attachmentKey(inquiryId: string, kind: "po" | "payment" | "signed-dr" | "pending-signed-dr", childId?: string) {
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
    if (attachments.pendingSignedDeliveryReceiptDataUrl) {
      store.put({ key: attachmentKey(inquiryId, "pending-signed-dr"), dataUrl: attachments.pendingSignedDeliveryReceiptDataUrl } satisfies AttachmentRecord);
    }
    if (attachments.signedDeliveryReceiptDataUrl) {
      store.put({ key: attachmentKey(inquiryId, "signed-dr"), dataUrl: attachments.signedDeliveryReceiptDataUrl } satisfies AttachmentRecord);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save attachments"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Attachment transaction was aborted"));
  });
  db.close();
}

export async function discardPendingSignedDeliveryReceiptAttachment(inquiryId: string): Promise<void> {
  const db = await openAttachmentsDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(ATTACHMENTS_STORE_NAME, "readwrite");
      transaction.objectStore(ATTACHMENTS_STORE_NAME).delete(attachmentKey(inquiryId, "pending-signed-dr"));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not discard the pending signed Delivery Receipt"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Pending signed Delivery Receipt discard was aborted"));
    });
  } finally {
    db.close();
  }
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
    } else if (record.key === attachmentKey(inquiryId, "pending-signed-dr")) {
      result.pendingSignedDeliveryReceiptDataUrl = record.dataUrl;
    } else if (record.key === attachmentKey(inquiryId, "signed-dr")) {
      result.signedDeliveryReceiptDataUrl = record.dataUrl;
    }
  });
  return result;
}

export async function promotePendingSignedDeliveryReceipt(inquiryId: string): Promise<string> {
  const db = await openAttachmentsDb();
  try {
    return await new Promise<string>((resolve, reject) => {
      const transaction = db.transaction(ATTACHMENTS_STORE_NAME, "readwrite");
      const store = transaction.objectStore(ATTACHMENTS_STORE_NAME);
      const pendingKey = attachmentKey(inquiryId, "pending-signed-dr");
      let promotedDataUrl: string | undefined;
      let failure: Error | undefined;
      const request = store.get(pendingKey);

      request.onsuccess = () => {
        const record = request.result as AttachmentRecord | undefined;
        if (!record) {
          failure = new Error("No pending signed Delivery Receipt was found for this order");
          transaction.abort();
          return;
        }
        promotedDataUrl = record.dataUrl;
        store.put({ key: attachmentKey(inquiryId, "signed-dr"), dataUrl: record.dataUrl } satisfies AttachmentRecord);
        store.delete(pendingKey);
      };
      request.onerror = () => {
        failure = request.error ?? new Error("Could not read the pending signed Delivery Receipt");
        transaction.abort();
      };
      transaction.oncomplete = () => {
        if (promotedDataUrl) resolve(promotedDataUrl);
        else reject(new Error("Could not promote the pending signed Delivery Receipt"));
      };
      transaction.onerror = () => reject(failure ?? transaction.error ?? new Error("Could not promote the pending signed Delivery Receipt"));
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("Pending signed Delivery Receipt promotion was aborted"));
    });
  } finally {
    db.close();
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read the selected file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the selected file"));
    reader.readAsDataURL(file);
  });
}
