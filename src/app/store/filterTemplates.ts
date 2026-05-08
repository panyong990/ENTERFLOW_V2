/* Filter type catalogue + template groups.
 * 16 filter types (user-facing) → 6 groups (internal) → drives dimensions + parts. */

export type FilterGroup =
  | "cylindrical"
  | "flatPanel"
  | "pocketBag"
  | "hepa"
  | "bagCollector"
  | "padDisc";

export interface FilterTypeMeta {
  code: string;
  label: string;
  group: FilterGroup;
}

export const FILTER_TYPES: Record<string, FilterTypeMeta> = {
  OILSEP:  { code: "OILSEP",  label: "Oil Separator",          group: "cylindrical" },
  WATSEP:  { code: "WATSEP",  label: "Water Separator",        group: "cylindrical" },
  SOLFIL:  { code: "SOLFIL",  label: "Solvent Filter",         group: "cylindrical" },
  HYDFIL:  { code: "HYDFIL",  label: "Hydraulic Filter",       group: "cylindrical" },
  AIRFIL:  { code: "AIRFIL",  label: "Air Filter",             group: "cylindrical" },
  OILFIL:  { code: "OILFIL",  label: "Oil Filter",             group: "cylindrical" },
  FUELFIL: { code: "FUELFIL", label: "Fuel Filter",            group: "cylindrical" },
  COALFIL: { code: "COALFIL", label: "Coalescence Filter",     group: "cylindrical" },
  SEPFIL:  { code: "SEPFIL",  label: "Separation Filter",      group: "cylindrical" },
  PRIFIL:  { code: "PRIFIL",  label: "Primary Filter",         group: "flatPanel" },
  PREFIL:  { code: "PREFIL",  label: "Pre Filter",             group: "flatPanel" },
  ACTIFIL: { code: "ACTIFIL", label: "Activated Carbon Filter",group: "flatPanel" },
  SECFIL:  { code: "SECFIL",  label: "Pocket Bag Filter",      group: "pocketBag" },
  HEPFIL:  { code: "HEPFIL",  label: "HEPA Filter",            group: "hepa" },
  BAGFIL:  { code: "BAGFIL",  label: "Bag / Dust Collector",   group: "bagCollector" },
  PADFIL:  { code: "PADFIL",  label: "Pad / Disc Filter",      group: "padDisc" },
};

/* Visual ordering for the picker grid */
export const GROUP_DISPLAY: { group: FilterGroup; label: string }[] = [
  { group: "cylindrical",  label: "Cylindrical Filters" },
  { group: "flatPanel",    label: "Flat Panel Filters" },
  { group: "pocketBag",    label: "Pocket Bag Filters" },
  { group: "hepa",          label: "HEPA Filters" },
  { group: "bagCollector", label: "Bag / Dust Collectors" },
  { group: "padDisc",      label: "Pad / Disc Filters" },
];

/* Resolve the group from a stored type code. Falls back to cylindrical for legacy seed entries. */
export function groupForType(typeCode: string): FilterGroup {
  return FILTER_TYPES[typeCode]?.group ?? "cylindrical";
}

/* Friendly label lookup for display */
export function labelForType(typeCode: string): string {
  return FILTER_TYPES[typeCode]?.label ?? typeCode;
}

export type DimensionKey =
  | "od1" | "od2" | "id1" | "id2" | "height" | "overallHeight"
  | "length" | "width" | "thickness" | "depth" | "pocketCount"
  | "diameter" | "clothCuttingWidth" | "clothCuttingLength"
  | "springPlateCenterToCenter" | "springPlateWidth" | "springPlateLength"
  /* padDisc uses padOd/padId so the bare "id" key never collides with ProductLine.id */
  | "padOd" | "padId";

export interface GroupTemplate {
  dimensions: DimensionKey[];
  parts: { always: string[]; optional: string[] };
}

export const GROUP_TEMPLATES: Record<FilterGroup, GroupTemplate> = {
  cylindrical: {
    dimensions: ["od1", "od2", "id1", "id2", "height", "overallHeight"],
    parts: { always: ["filter_media", "endcap", "inner_core", "outer_core"], optional: ["oring_gasket", "bonding_adhesive"] },
  },
  flatPanel: {
    dimensions: ["length", "width", "thickness"],
    parts: { always: ["filter_media", "endcap", "gasket"], optional: [] },
  },
  pocketBag: {
    dimensions: ["length", "width", "thickness", "depth", "pocketCount"],
    parts: { always: ["filter_media", "endcap"], optional: ["gasket"] },
  },
  hepa: {
    dimensions: ["length", "width", "depth"],
    parts: { always: ["filter_media", "endcap"], optional: ["inner_core", "outer_core", "gasket"] },
  },
  bagCollector: {
    dimensions: ["diameter", "length", "clothCuttingWidth", "clothCuttingLength", "springPlateCenterToCenter", "springPlateWidth", "springPlateLength"],
    parts: { always: ["filter_media", "endcap"], optional: [] },
  },
  padDisc: {
    dimensions: ["padOd", "padId"],
    parts: { always: ["filter_media"], optional: [] },
  },
};

/* Friendly labels for dimension fields, by group. Some groups want different terminology even for shared keys. */
export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  od1: "OD 1 (mm)",
  od2: "OD 2 (mm)",
  id1: "ID 1 (mm)",
  id2: "ID 2 (mm)",
  height: "Height (mm)",
  overallHeight: "Overall Height (mm)",
  length: "Length (mm)",
  width: "Width (mm)",
  thickness: "Thickness (mm)",
  depth: "Depth (mm)",
  pocketCount: "Pocket Count",
  diameter: "Diameter (mm)",
  clothCuttingWidth: "Cloth Cutting Width (mm)",
  clothCuttingLength: "Cloth Cutting Length (mm)",
  springPlateCenterToCenter: "Spring Plate Center-to-Center (mm)",
  springPlateWidth: "Spring Plate Width (mm)",
  springPlateLength: "Spring Plate Length (mm)",
  padOd: "OD (mm)",
  padId: "ID (mm)",
};

/* For the cost-estimation BOM mapper. Maps a "part" key (used in GROUP_TEMPLATES) to a material partCategory key in the materials store. */
export const PART_TO_CATEGORY: Record<string, string> = {
  filter_media: "filter_media",
  endcap: "end_cap",
  inner_core: "inner_core",
  outer_core: "outer_core",
  oring_gasket: "oring_gasket",
  bonding_adhesive: "adhesive",
  gasket: "gasket",
};
