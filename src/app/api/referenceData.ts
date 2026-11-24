import { api } from "./client";

export interface ReferenceUnit {
  id: string;
  name: string;
  abbreviation: string | null;
}

interface ReferenceData {
  units: ReferenceUnit[];
}

export function getReferenceData(signal?: AbortSignal) {
  return api<ReferenceData>("/api/phase2/reference-data", { signal });
}