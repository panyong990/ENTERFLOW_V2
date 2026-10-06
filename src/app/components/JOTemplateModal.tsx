import { X, Download, Paperclip, FileText } from "lucide-react";
import { DIMENSION_LABELS, GROUP_TEMPLATES, groupForType, type DimensionKey } from "../store/filterTemplates";

export interface JOTemplateData {
  jo: string;
  client: string;
  product: string;
  filterType?: string;
  qty: number;
  date: string;
  itemCode: string;
  enterFilPN: string;
  specs: {
    od1?: string;
    od2?: string;
    id1?: string;
    id2?: string;
    height?: string;
    overallHeight?: string;
    length?: string; width?: string; thickness?: string; depth?: string; pocketCount?: string;
    diameter?: string;
    clothCuttingWidth?: string; clothCuttingLength?: string;
    springPlateCenterToCenter?: string; springPlateWidth?: string; springPlateLength?: string;
    padOd?: string; padId?: string;
    endCap?: string;
    media?: string;
    innerCore?: string;
    outerCore?: string;
    oring?: string;
    gasket?: string;
    oem?: string;
    brand?: string;
    others?: string;
  };
  preparedBy?: string;
  poRef?: string;
  sketch?: string;
  urgent?: boolean;
  dueDate?: string;
}

interface Props {
  data: JOTemplateData;
  onClose: () => void;
}

const D: React.CSSProperties = { fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: 11 };
const MONO: React.CSSProperties = { fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: 11 };
const BORDER = "1px solid #0F172A";
const BORDER2 = "2px solid #0F172A";

function val(v?: string) {
  return v && v.trim() ? v : "—";
}

function HeaderRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 0, lineHeight: "1.7" }}>
      <span style={{ ...MONO, fontWeight: 600, minWidth: 110, color: "#0F172A" }}>{label}</span>
      <span style={{ ...MONO, fontWeight: 600, marginRight: 8, color: "#0F172A" }}>:</span>
      <span style={{ ...D, fontWeight: bold ? 800 : 600, color: "#0F172A", fontSize: bold ? 12 : 11 }}>{value}</span>
    </div>
  );
}

function SpecRow({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", lineHeight: "1.75", paddingLeft: indent ? 12 : 0 }}>
      <span style={{ ...D, fontWeight: bold ? 800 : 600, minWidth: indent ? 80 : 96, color: "#0F172A", textAlign: "right", paddingRight: 4 }}>{label}</span>
      <span style={{ ...MONO, fontWeight: 500, marginRight: 4, color: "#0F172A" }}>:</span>
      <span style={{ ...D, fontWeight: 500, color: "#0F172A" }}>{value}</span>
    </div>
  );
}

export function JOTemplateModal({ data, onClose }: Props) {
  const dimensionKeys = GROUP_TEMPLATES[groupForType(data.filterType ?? data.product)].dimensions;
  const dimensionRows = dimensionKeys
    .map((key) => [DIMENSION_LABELS[key] ?? key, data.specs[key as keyof typeof data.specs]] as [string, string | undefined])
    .filter(([, value]) => val(value) !== "â€”");
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.75)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full flex flex-col"
        style={{ maxWidth: 1000, boxShadow: "0 24px 48px rgba(0,0,0,0.35)", maxHeight: "95vh" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Job Order Document"
      >
        {/* Modal chrome */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h3 className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
            Job Order — {data.jo}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-dm hover:opacity-90"
              style={{ fontSize: 12, fontWeight: 700, backgroundColor: "#1A2B4A", color: "white" }}
            >
              <Download size={13} /> Download JO PDF
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Document */}
        <div className="p-6 overflow-auto">
          {/* RUSH banner — above document frame */}
          {data.urgent && (
            <div
              className="mb-3 px-4 py-2 rounded-md flex items-center gap-3"
              style={{ backgroundColor: "#FEE2E2", border: "1.5px solid #FECACA" }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: "#C8102E", letterSpacing: 0.5 }}>
                🚨 RUSH ORDER
              </span>
              {data.dueDate && (
                <span style={{ ...D, fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
                  Required by: {data.dueDate}
                </span>
              )}
            </div>
          )}

          {/* ─── Document frame ─── */}
          <div style={{ border: BORDER2, backgroundColor: "white" }}>

            {/* ── Header section ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: BORDER2 }}>
              {/* Left: Item info */}
              <div style={{ padding: "10px 14px", borderRight: BORDER }}>
                <HeaderRow label="ITEM NAME" value={data.product.toUpperCase()} />
                <HeaderRow label="ITEM CODE" value={data.itemCode} />
                <HeaderRow label="ENTER-FIL PN" value={data.enterFilPN} />
              </div>
              {/* Right: Order info */}
              <div style={{ padding: "10px 14px" }}>
                <HeaderRow label="DATE" value={data.date} />
                <HeaderRow label="JO NUMBER" value={data.jo} />
                {data.poRef && <HeaderRow label="PO REFERENCE" value={data.poRef} />}
                <HeaderRow label="COMPANY NAME" value={data.client.toUpperCase()} bold />
                <HeaderRow label="QUANTITY" value={String(data.qty)} />
              </div>
            </div>

            {/* ── Body: specs + sketch ── */}
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", borderBottom: BORDER2, minHeight: 340 }}>

              {/* Left: Technical spec box */}
              <div style={{ borderRight: BORDER2, padding: "14px 12px" }}>
                <div style={{ border: BORDER, padding: "10px 12px" }}>

                  {/* Title */}
                  <div style={{ ...D, fontWeight: 700, textAlign: "center", letterSpacing: 0.8, marginBottom: 8, textTransform: "uppercase" }}>
                    Technical Specification
                  </div>

                  {/* Dimension */}
                  <div style={{ ...D, fontWeight: 800, marginBottom: 4, color: "#0F172A" }}>DIMENSION</div>
                  <div style={{ marginBottom: 6 }}>
                    {dimensionRows.length > 0 && dimensionRows.map(([label, value]) => (
                      <SpecRow key={label} label={label.toUpperCase()} value={`${value} ${label.toLowerCase().includes("count") ? "" : "mm"}`.trim()} indent />
                    ))}
                    {dimensionRows.length === 0 && (<>
                    <SpecRow label="OD 1" value={val(data.specs.od1) !== "—" ? `${data.specs.od1} mm` : "—"} indent />
                    <SpecRow label="OD 2" value={val(data.specs.od2) !== "—" ? `${data.specs.od2} mm` : "—"} indent />
                    <SpecRow label="ID 1" value={val(data.specs.id1) !== "—" ? `${data.specs.id1} mm` : "—"} indent />
                    <SpecRow label="ID 2" value={val(data.specs.id2) !== "—" ? `${data.specs.id2} mm` : "—"} indent />
                    <SpecRow label="HEIGHT" value={val(data.specs.height) !== "—" ? `${data.specs.height} mm` : "—"} indent />
                    </>)}
                  </div>
                  <SpecRow label="OVERALL HEIGHT" value={val(data.specs.overallHeight) !== "—" ? `${data.specs.overallHeight} mm` : "—"} />

                  <div style={{ borderTop: "1px solid #CBD5E1", margin: "8px 0" }} />

                  <SpecRow label="END CAP" value={val(data.specs.endCap)} bold />
                  <SpecRow label="FILTER MEDIA" value={val(data.specs.media)} bold />
                  <SpecRow label="INNER CORE" value={val(data.specs.innerCore)} bold />
                  <SpecRow label="OUTER CORE" value={val(data.specs.outerCore)} bold />
                  <SpecRow label="O RING" value={val(data.specs.oring)} bold />
                  <SpecRow label="GASKET" value={val(data.specs.gasket)} bold />

                  {/* Other technical specs */}
                  <div style={{ borderTop: "1px solid #CBD5E1", margin: "8px 0" }} />
                  <div style={{ ...D, fontWeight: 600, textAlign: "center", color: "#475569", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>
                    Other Technical Specs
                  </div>
                  <SpecRow label="OEM PN" value={val(data.specs.oem)} bold />
                  <SpecRow label="BRAND" value={val(data.specs.brand)} bold />
                  <SpecRow label="OTHERS" value={val(data.specs.others)} bold />
                </div>
              </div>

              {/* Right: Sketch / Drawing area */}
              <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Section label */}
                <div style={{ ...D, fontWeight: 700, color: "#64748B", letterSpacing: 0.8, textTransform: "uppercase" }}>
                  Final Sketch / Technical Drawing
                </div>

                {data.sketch ? (
                  <div
                    style={{
                      flex: 1,
                      border: "1.5px solid #1A2B4A",
                      borderRadius: 4,
                      display: "flex",
                      flexDirection: "column",
                      backgroundColor: "white",
                      overflow: "hidden",
                    }}
                  >
                    {/* Show actual uploaded sketch — image if image type, file-card otherwise */}
                    {data.sketch.match(/\.(png|jpe?g|gif|webp|svg)$/i) ? (
                      <img src={data.sketch} alt="Final approved sketch" style={{ width: "100%", height: "100%", objectFit: "contain", maxHeight: 360, backgroundColor: "white" }} />
                    ) : (
                      <div style={{ flex: 1, position: "relative", backgroundColor: "#F8FAFC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 14, minHeight: 320 }}>
                        <div style={{ width: 60, height: 76, backgroundColor: "white", border: "2px solid #1A2B4A", borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, position: "relative" }}>
                          <span style={{ fontSize: 22 }}>📄</span>
                          <span style={{ fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: 8, fontWeight: 800, color: "#1A2B4A", letterSpacing: 0.5 }}>
                            {data.sketch.match(/\.([a-z]+)$/i)?.[1].toUpperCase() ?? "FILE"}
                          </span>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: 12, fontWeight: 700, color: "#1A2B4A", wordBreak: "break-all", maxWidth: 340 }}>
                            {data.sketch}
                          </div>
                          <div style={{ ...D, fontSize: 11, color: "#64748B", marginTop: 6 }}>
                            Client-approved final drawing<br />Click below to view
                          </div>
                        </div>
                        <button
                          onClick={() => window.open("#", "_blank")}
                          style={{
                            fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                            fontSize: 12, fontWeight: 700,
                            padding: "8px 16px",
                            borderRadius: 6,
                            backgroundColor: "#1A2B4A",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Paperclip size={12} /> Open sketch
                        </button>
                      </div>
                    )}
                    <div style={{ padding: "8px 12px", borderTop: "1px solid #E2E8F0", backgroundColor: "#F8FAFC", display: "flex", alignItems: "center", gap: 8 }}>
                      <Paperclip size={12} style={{ color: "#1A2B4A" }} />
                      <span style={{ fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: 11, fontWeight: 600, color: "#2563EB", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {data.sketch}
                      </span>
                      <span style={{ ...D, fontSize: 10, color: "#94A3B8" }}>Approved drawing</span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      border: "1.5px dashed #CBD5E1",
                      borderRadius: 4,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      padding: 24,
                      backgroundColor: "#F8FAFC",
                    }}
                  >
                    <FileText size={36} style={{ color: "#CBD5E1" }} />
                    <div style={{ ...D, color: "#94A3B8", textAlign: "center" }}>
                      No sketch attached
                      <br />
                      Drawing to be provided separately
                    </div>
                  </div>
                )}

                {/* Dimensions diagram hint */}
                {(data.specs.od1 || data.specs.height) && (
                  <div
                    style={{
                      border: BORDER,
                      borderRadius: 2,
                      padding: "8px 12px",
                      backgroundColor: "#F8FAFC",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px 24px",
                    }}
                  >
                    {[
                      ["OD 1", data.specs.od1, "mm"],
                      ["OD 2", data.specs.od2, "mm"],
                      ["ID 1", data.specs.id1, "mm"],
                      ["ID 2", data.specs.id2, "mm"],
                      ["HT", data.specs.height, "mm"],
                      ["O/A HT", data.specs.overallHeight, "mm"],
                    ]
                      .filter(([, v]) => v && (v as string).trim())
                      .map(([lbl, v, unit]) => (
                        <span key={lbl as string} style={{ ...MONO, fontSize: 10, color: "#475569" }}>
                          <strong style={{ color: "#0F172A" }}>{lbl as string}</strong> {v as string} {unit as string}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
              {/* Logo cell */}
              <div
                style={{
                  padding: "10px 14px",
                  borderRight: BORDER,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 20, color: "#C8102E", fontWeight: 900, lineHeight: 1 }}>▲</span>
                  <span
                    style={{
                      fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                      fontSize: 7,
                      fontWeight: 800,
                      color: "#C8102E",
                      letterSpacing: 1,
                    }}
                  >
                    EFIP
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#0F172A",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  Enter-Fil Industrial Products
                </span>
              </div>

              {/* Prepared by */}
              <div
                style={{
                  padding: "10px 14px",
                  borderRight: BORDER,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ ...D, fontWeight: 700 }}>PREPARED BY :</span>
                <span
                  style={{
                    ...D,
                    fontWeight: 700,
                    borderBottom: "1px solid #0F172A",
                    minWidth: 80,
                    paddingBottom: 1,
                  }}
                >
                  {data.preparedBy ?? "Mae Z."}
                </span>
              </div>

              {/* Approved by */}
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ ...D, fontWeight: 700 }}>APPROVED BY :</span>
                <span
                  style={{
                    ...D,
                    minWidth: 80,
                    borderBottom: "1px solid #0F172A",
                    paddingBottom: 1,
                  }}
                >
                  &nbsp;
                </span>
              </div>
            </div>
          </div>

          {/* System note */}
          <div
            style={{
              marginTop: 8,
              fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              fontSize: 10,
              color: "#94A3B8",
              textAlign: "center",
            }}
          >
            Generated by ENTER-FLOW ERP — Enter-Fil Industrial Products
          </div>
        </div>
      </div>
    </div>
  );
}
