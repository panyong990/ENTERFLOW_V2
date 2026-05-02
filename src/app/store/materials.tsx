import { createContext, useContext, useState, type ReactNode } from "react";

export type MaterialKey = "mediaLocal" | "mediaImported" | "adhesive" | "box";

export interface Material {
  key: MaterialKey;
  label: string;
  unit: string;
  available: number;
  threshold: number;
  leadTime: string;
}

const seed: Material[] = [
  { key: "mediaLocal",   label: "Filter Media (Local)",    unit: "rolls", available: 12, threshold: 5,  leadTime: "Next day" },
  { key: "mediaImported", label: "Filter Media (Imported)", unit: "rolls", available: 8,  threshold: 4,  leadTime: "Months (customs)" },
  { key: "adhesive",     label: "Adhesive",                unit: "sets",  available: 2,  threshold: 3,  leadTime: "Next day" },
  { key: "box",          label: "Corrugated Box",          unit: "pcs",   available: 45, threshold: 50, leadTime: "~2 weeks" },
];

interface Ctx {
  materials: Material[];
  get: (k: MaterialKey) => Material;
}

const MaterialsContext = createContext<Ctx | null>(null);

export function MaterialsProvider({ children }: { children: ReactNode }) {
  const [materials] = useState<Material[]>(seed);
  const get: Ctx["get"] = (k) => materials.find((m) => m.key === k)!;
  return <MaterialsContext.Provider value={{ materials, get }}>{children}</MaterialsContext.Provider>;
}

export function useMaterials() {
  const c = useContext(MaterialsContext);
  if (!c) throw new Error("useMaterials must be used inside MaterialsProvider");
  return c;
}
