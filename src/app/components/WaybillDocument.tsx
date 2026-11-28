import { WarehouseReference } from "./WarehouseReference";
// Shared Waybill document for Demo and authenticated Real Mode.
import type { CSSProperties, ReactNode } from "react";

export interface WaybillDocumentData {
  shipment: {
    waybillIdentifier: string;
    jo: string;
    client: string;
    item: string;
    qty: number | string;
    po: string;
    si: string;
    method: string;
  };
  qrDataUrl: string;
  dispatchDate: string;
  clientAddress: string;
}

const RED = "#C8102E";
const INK = "#292C31";
const MUTED = "#62666C";
const LINE = "#D7D9DE";

const label: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.5,
  color: MUTED,
  textTransform: "uppercase",
  lineHeight: 1.3,
};

const value: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: INK,
  lineHeight: 1.35,
  overflowWrap: "anywhere",
};

const address: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.3,
  color: MUTED,
  overflowWrap: "anywhere",
};

function Field({ title, children }: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={label}>{title}</div>
      <div style={{ ...value, marginTop: 3 }}>{children}</div>
    </div>
  );
}

function displayDate(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const date = new Date(`${input}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? input :
    new Intl.DateTimeFormat("en-US", {
      month: "long", day: "numeric", year: "numeric",
      timeZone: "UTC",
    }).format(date);
}

export function WaybillDocument({
  data,
  qrIdentifier,
  onQrReady,
  onQrError,
}: {
  data: WaybillDocumentData;
  qrIdentifier?: string;
  onQrReady?: () => void;
  onQrError?: () => void;
}) {
  const s = data.shipment;

  const quantity = /^\d+(\.\d+)?$/.test(String(s.qty))
    ? `${s.qty} ${Number(s.qty) === 1 ? "pc" : "pcs"}`
    : String(s.qty);

  return (
    <article
      id="waybill-preview-document"
      className="bg-white mx-auto print:shadow-none"
      style={{
        width: "100%",
        maxWidth: 620,
        padding: 24,
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        background: "#FFFFFF",
        color: INK,
        border: `1px solid ${LINE}`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* Company header */}
      <header style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 14,
        paddingBottom: 14,
        borderBottom: `3px solid ${RED}`,
      }}>
        <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
          <svg
            viewBox="0 0 50 60"
            width="44"
            height="53"
            aria-label="EFIP"
            style={{ flexShrink: 0 }}
          >
            <path d="M25 3 L47 43 L3 43 Z" fill={RED} />
            <text x="25" y="55" textAnchor="middle"
              fontSize="11" fontWeight="800" fill={RED}>
              EFIP
            </text>
          </svg>

          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 23, fontWeight: 900,
              color: RED, lineHeight: 1,
            }}>
              ENTER-FIL
            </div>
            <div style={{
              fontSize: 11, fontWeight: 800,
              letterSpacing: 1, marginTop: 3,
            }}>
              INDUSTRIAL PRODUCTS
            </div>
            <div style={{ ...address, marginTop: 5, fontSize: 10 }}>
              Sitio Hulo, Barangay Balasing, San Jose Rd.<br />
              Santa Maria, Bulacan 3022
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontSize: 28, fontWeight: 900,
            lineHeight: 1, letterSpacing: 0.5,
          }}>
            WAYBILL
          </div>
          <div style={{ ...label, marginTop: 9 }}>
            Dispatch Date
          </div>
          <div style={{ ...value, marginTop: 3 }}>
            {displayDate(data.dispatchDate)}
          </div>
        </div>
      </header>

      {/* Document identity and actual QR */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 144px",
        alignItems: "center",
        gap: 16,
        padding: "17px 0",
        borderBottom: `1px solid ${LINE}`,
      }}>
        <div style={{
          display: "flex", flexDirection: "column",
          gap: 12, minWidth: 0,
        }}>
          <Field title="Waybill No.">
            <WarehouseReference plainWhenUnchanged value={s.waybillIdentifier}/>
          </Field>

          <Field title="Job Order No.">
            <WarehouseReference plainWhenUnchanged value={s.jo}/>
          </Field>

          {qrIdentifier && (
            <div style={{
              background: "#F4F5F6",
              border: `1px solid ${LINE}`,
              borderLeft: `3px solid ${RED}`,
              borderRadius: 3,
              padding: "9px 10px",
              minWidth: 0,
            }}>
              <div style={label}>QR Identifier</div>
              <div style={{
                ...value,
                fontFamily: "Consolas, monospace",
                fontSize: 11,
                marginTop: 5,
                userSelect: "text",
              }}>
                <WarehouseReference plainWhenUnchanged value={qrIdentifier}/>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <img
            src={data.qrDataUrl}
            onLoad={onQrReady}
            onError={onQrError}
            alt="QR code containing Waybill identifier"
            style={{
              display: "block",
              width: 140,
              height: 140,
              objectFit: "contain",
              margin: "0 auto",
              background: "#FFFFFF",
            }}
          />
          <div style={{ ...label, marginTop: 4 }}>
            Scan to verify
          </div>
        </div>
      </section>

      {/* Compact sender and recipient cards */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 14,
        marginTop: 16,
      }}>
        {[
          {
            title: "Ship From",
            name: "Enter-Fil Industrial Products",
            location: (
              <>
                Sitio Hulo, Barangay Balasing<br />
                San Jose Rd., Santa Maria<br />
                Bulacan 3022
              </>
            ),
          },
          {
            title: "Ship To",
            name: s.client,
            location: data.clientAddress,
          },
        ].map(({ title, name, location }) => (
          <div key={title} style={{
            border: `1px solid ${LINE}`,
            borderRadius: 3,
            minWidth: 0,
          }}>
            <div style={{
              ...label,
              padding: "7px 10px",
              background: "#F0F1F3",
              color: RED,
            }}>
              {title}
            </div>
            <div style={{ padding: "10px" }}>
              <div style={value}>{name}</div>
              <div style={{
                ...address, marginTop: 4,
                whiteSpace: "pre-line",
              }}>
                {location}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Shipment details */}
      <section style={{ marginTop: 20 }}>
        <div style={{
          fontSize: 12, fontWeight: 800,
          letterSpacing: 0.5, marginBottom: 8,
        }}>
          SHIPMENT DETAILS
        </div>

        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          fontSize: 11,
        }}>
          <thead style={{
            background: INK,
            color: "#FFFFFF",
          }}>
            <tr>
              <th style={{
                textAlign: "left", padding: 10,
                fontSize: 10,
              }}>
                ITEM / PRODUCT DESCRIPTION
              </th>
              <th style={{
                width: "22%", padding: 10,
                textAlign: "center", fontSize: 10,
              }}>
                QTY
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{
                padding: 12,
                border: `1px solid ${LINE}`,
                overflowWrap: "anywhere",
              }}>
                {s.item}
              </td>
              <td style={{
                padding: 12,
                textAlign: "center",
                border: `1px solid ${LINE}`,
                overflowWrap: "anywhere",
              }}>
                {quantity}
              </td>
            </tr>
            <tr style={{
              background: "#F0F1F3",
              fontWeight: 700,
            }}>
              <td style={{
                padding: 9,
                border: `1px solid ${LINE}`,
              }}>
                TOTAL QUANTITY
              </td>
              <td style={{
                padding: 9,
                textAlign: "center",
                border: `1px solid ${LINE}`,
                overflowWrap: "anywhere",
              }}>
                {quantity}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Related transaction references */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
        padding: "20px 0",
      }}>
        <Field title="Purchase Order No."><WarehouseReference plainWhenUnchanged value={s.po}/></Field>
        <Field title="Sales Invoice No."><WarehouseReference plainWhenUnchanged value={s.si}/></Field>
        <Field title="Delivery Method">{s.method}</Field>
      </section>

      {/* Company footer */}
      <footer style={{
        borderTop: `2px solid ${RED}`,
        paddingTop: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        fontSize: 9,
        color: MUTED,
      }}>
        <div>
          <strong>ENTER-FIL INDUSTRIAL PRODUCTS</strong>
          <div style={{ marginTop: 3 }}>www.enterfil.com</div>
        </div>
        <div style={{ textAlign: "right" }}>
          Generated by ENTER-FLOW
        </div>
      </footer>
    </article>
  );
}
