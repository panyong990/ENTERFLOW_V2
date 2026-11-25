import { api } from "./client";

export interface ReferenceUnit {
  id: string;
  name: string;
  abbreviation: string | null;
}

interface ReferenceData {
  units: ReferenceUnit[];
  deliveryMethods: { id: string; name: string }[];
}

export function getReferenceData(signal?: AbortSignal) {
  return api<ReferenceData>("/api/phase2/reference-data", { signal });
}
