import { useEffect, useMemo, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Fragment } from "react";
import { Printer, CheckCircle2, X, ScanLine, Info, Camera, Search, Filter, QrCode, ShieldCheck } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useOrders } from "../store/orders";
import { clientCompanyAddress, getClientCompanySettings } from "../store/clientCompanySettings";
import { NotificationBell } from "./NotificationBell";
import { inquiryToDispatchRow, type DispatchRow } from "./waybillData";

interface WaybillPreviewData {
  shipment: DispatchRow;
  qrDataUrl: string;
  dispatchDate: string;
  clientAddress: string;
}

function cameraErrorMessage(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error
    ? String(error.name)
    : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "Camera permission was denied. Allow camera access in your browser settings and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found. Connect or enable a camera, then try again.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera could not be accessed. It may be in use by another app.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "No available camera supports QR scanning.";
  }
  if (name === "NotSupportedError") {
    return "Camera access is unavailable in this browser or page. Open the page in a supported browser over HTTPS and try again.";
  }

  return "The camera scanner could not be started. Check your camera connection and browser permissions, then try again.";
}

export function WaybillScanner() {
  const { inquiriesByStage, updateInquiry } = useOrders();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanPopup, setScanPopup] = useState<DispatchRow | null>(null);
  const [waybillPreview, setWaybillPreview] = useState<WaybillPreviewData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchDateFilter, setDispatchDateFilter] = useState("all");
  const [isDispatchFilterOpen, setIsDispatchFilterOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanControlsRef = useRef<IScannerControls | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const scanSessionRef = useRef(0);
  const lastInvalidIdentifierRef = useRef("");

  /* DERIVED: live ready-for-dispatch JOs from production */
  const readyInquiries = useMemo(() => inquiriesByStage(["ready_for_dispatch"]), [inquiriesByStage]);
  const ready: DispatchRow[] = useMemo(() => readyInquiries.map(inquiryToDispatchRow), [readyInquiries]);
  const filteredReady = useMemo(() => {
    const query = dispatchSearch.trim().toLocaleLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateCutoff = new Date(today);
    if (dispatchDateFilter === "7days") dateCutoff.setDate(dateCutoff.getDate() - 6);
    if (dispatchDateFilter === "30days") dateCutoff.setDate(dateCutoff.getDate() - 29);

    return ready.filter((row) => {
      const inquiry = readyInquiries.find((candidate) => candidate.id === row.id);
      const matchesSearch = !query || [
        row.jo,
        row.client,
        row.item,
        row.itemCode,
        row.enterFilPN,
        ...(inquiry?.products.flatMap((product) => [product.filterName, product.type, product.oem]) ?? []),
      ].some((value) => value?.toLocaleLowerCase().includes(query));
      const submittedDate = inquiry ? new Date(inquiry.submittedDate) : new Date(Number.NaN);
      const matchesDate = dispatchDateFilter === "all" ||
        (!Number.isNaN(submittedDate.getTime()) && submittedDate >= dateCutoff && submittedDate < tomorrow);
      return matchesSearch && matchesDate;
    });
  }, [dispatchSearch, dispatchDateFilter, ready, readyInquiries]);
  const shipmentInquiries = useMemo(
    () => inquiriesByStage(["ready_for_dispatch", "dispatched", "delivered", "paid", "overdue"]),
    [inquiriesByStage]
  );
  const shipments = useMemo(() => shipmentInquiries.map(inquiryToDispatchRow), [shipmentInquiries]);
  const shipmentsRef = useRef(shipments);
  const readyRef = useRef(ready);
  shipmentsRef.current = shipments;
  readyRef.current = ready;

  const releaseCameraStream = () => {
    const stream = cameraStreamRef.current;
    cameraStreamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  };

  const stopScanner = () => {
    scanSessionRef.current += 1;
    scanControlsRef.current?.stop();
    scanControlsRef.current = null;
    releaseCameraStream();
    setIsScanning(false);
  };

  useEffect(() => {
    if (!isScanning || !cameraStream) return;

    let cancelled = false;
    const scanSession = scanSessionRef.current;
    const startCameraScan = async () => {
      try {
        const video = videoRef.current;
        if (!video) {
          throw new Error("The camera preview is unavailable. Please try again.");
        }

        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (cancelled || scanSessionRef.current !== scanSession) return;

        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromStream(cameraStream, video, (result, _error, scannerControls) => {
          if (cancelled || scanSessionRef.current !== scanSession || !result) return;

          const identifier = result.getText().trim();
          const match = shipmentsRef.current.find(
            (shipment) => shipment.waybillIdentifier.toLocaleLowerCase() === identifier.toLocaleLowerCase()
          );
          if (!match) {
            setSelectedId(null);
            setScanPopup(null);
            setCameraError("Waybill not found. Please scan a valid Enter-Flow Waybill QR code.");
            if (lastInvalidIdentifierRef.current !== identifier) {
              lastInvalidIdentifierRef.current = identifier;
              toast.error("Waybill not found", {
                description: "Please scan a valid Enter-Flow Waybill QR code.",
              });
            }
            return;
          }

          scanSessionRef.current += 1;
          scannerControls.stop();
          scanControlsRef.current = null;
          releaseCameraStream();
          lastInvalidIdentifierRef.current = "";
          setCameraError("");
          setIsScanning(false);
          setSelectedId(readyRef.current.some((shipment) => shipment.id === match.id) ? match.id : null);
          setScanPopup(match);
        });

        if (cancelled || scanSessionRef.current !== scanSession) {
          controls.stop();
        } else {
          scanControlsRef.current = controls;
        }
      } catch (error) {
        if (cancelled || scanSessionRef.current !== scanSession) return;
        const message = cameraErrorMessage(error);
        releaseCameraStream();
        setCameraError(message);
        setIsScanning(false);
        toast.error("Unable to start QR scanner", { description: message });
      }
    };

    void startCameraScan();

    return () => {
      cancelled = true;
      scanControlsRef.current?.stop();
      scanControlsRef.current = null;
      if (cameraStreamRef.current === cameraStream) {
        cameraStreamRef.current = null;
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isScanning, cameraStream]);

  useEffect(() => () => {
    scanSessionRef.current += 1;
    scanControlsRef.current?.stop();
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
  }, []);

  const startScanner = async () => {
    const scanSession = scanSessionRef.current + 1;
    scanSessionRef.current = scanSession;
    setCameraError("");
    lastInvalidIdentifierRef.current = "";
    setIsScanning(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const unsupportedError = new Error("Camera access is not supported by this browser.");
        unsupportedError.name = "NotSupportedError";
        throw unsupportedError;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (scanSessionRef.current !== scanSession) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setCameraStream(stream);
    } catch (error) {
      if (scanSessionRef.current !== scanSession) return;
      const message = cameraErrorMessage(error);
      setCameraError(message);
      setIsScanning(false);
      toast.error("Unable to start QR scanner", { description: message });
    }
  };

  const openWaybillPreview = async (shipment: DispatchRow) => {
    const inquiry = readyInquiries.find((item) => item.id === shipment.id);
    if (!inquiry) {
      toast.error("Unable to open Waybill preview", { description: "The selected Ready-for-Dispatch JO could not be found." });
      return;
    }

    const waybillIdentifier = inquiry.waybillIdentifier?.trim() || shipment.waybillIdentifier;
    const previewShipment = { ...shipment, waybillIdentifier };
    try {
      const QRCode = await import("qrcode");
      const qrDataUrl = await QRCode.toDataURL(waybillIdentifier, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 320,
      });
      if (!inquiry.waybillIdentifier?.trim()) {
        updateInquiry(inquiry.id, { waybillIdentifier });
      }
      setWaybillPreview({
        shipment: previewShipment,
        qrDataUrl,
        dispatchDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        clientAddress: clientCompanyAddress(getClientCompanySettings(inquiry.clientName)),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "QR code generation failed.";
      toast.error("Unable to prepare Waybill preview", { description: message });
    }
  };

  const handlePrintWaybill = () => {
    if (!waybillPreview) return;

    const inquiry = shipmentInquiries.find((item) => item.id === waybillPreview.shipment.id);
    if (!inquiry) {
      toast.error("Unable to hand off shipment", {
        description: "The Job Order could not be found. Close the preview and reopen the Waybill.",
      });
      return;
    }

    try {
      window.print();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The print dialog could not be opened.";
      toast.error("Unable to print Waybill", { description: message });
      return;
    }

    const log = inquiry.waybillLog ?? [];
    const existingPrintEntry = log.find((entry) => entry.status === "Waybill Printed");
    const printedAt = inquiry.waybillPrintedAt ?? existingPrintEntry?.ts ?? new Date().toISOString();
    updateInquiry(inquiry.id, {
      stage: "dispatched",
      dispatchedAt: inquiry.dispatchedAt ?? printedAt,
      waybillPrintedAt: printedAt,
      waybillNumber: inquiry.waybillNumber?.trim() || waybillPreview.shipment.waybillIdentifier,
      waybillIdentifier: inquiry.waybillIdentifier?.trim() || waybillPreview.shipment.waybillIdentifier,
      waybillLog: existingPrintEntry
        ? log
        : [...log, { ts: printedAt, status: "Waybill Printed", note: waybillPreview.shipment.waybillIdentifier }],
    });

    toast.success("Waybill sent to printer", {
      description: "This shipment is now ready for Logistics delivery processing.",
    });
    setSelectedId(null);
    setWaybillPreview(null);
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            Waybill Scanner
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            Scan the QR code on the waybill to verify the shipment
          </p>
        </div>
        <NotificationBell />
      </header>

      <div className="px-6 md:px-8 py-6 md:py-8 flex flex-col gap-6">
        <section aria-label="Waybill Scanner" className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="p-5 md:p-7 flex flex-col" style={{ backgroundColor: "#F1F5FB" }}>
              <div className="flex items-center gap-2 mb-2">
                <ScanLine size={18} style={{ color: "#C8102E" }} />
                <span className="font-dm" style={{ fontSize: 10, fontWeight: 800, color: "#C8102E", letterSpacing: 0.8 }}>WAREHOUSE SCANNER</span>
              </div>
              <h2 className="font-syne" style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>QR Code Scanner</h2>
              <p className="font-dm mt-1" style={{ fontSize: 12, color: "#64748B" }}>Scan the QR code on the waybill to verify the shipment</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {isScanning ? (
                  <button onClick={stopScanner} className="font-dm flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700 }}>
                    <Camera size={15} /> Stop Camera
                  </button>
                ) : (
                  <button onClick={startScanner} className="font-dm flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 12, fontWeight: 700 }}>
                    <Camera size={15} /> Start QR Scanner
                  </button>
                )}
                <span className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>
                  {isScanning ? "Point the camera at the Waybill QR code." : "Allow camera access to scan the QR code. The QR contains only the Waybill identifier."}
                </span>
              </div>
              {cameraError && <p className="font-dm mt-3" role="alert" style={{ fontSize: 12, color: "#B91C1C" }}>{cameraError}</p>}

              <div
                className="relative mt-5 mx-auto w-full overflow-hidden rounded-lg"
                style={{
                  maxWidth: 600,
                  aspectRatio: "3 / 2",
                  backgroundColor: isScanning ? "#0B1424" : "#DCE6F3",
                  border: `1px solid ${isScanning ? "#1A2B4A" : "#B8C7DA"}`,
                  boxShadow: isScanning ? "0 0 0 3px rgba(37,99,235,0.12)" : "inset 0 1px 3px rgba(26,43,74,0.08)",
                }}
              >
                {isScanning ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-contain"
                      muted
                      playsInline
                      aria-label="QR code camera preview"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                      <div className="relative rounded-md" style={{ width: "min(72%, 280px)", aspectRatio: "1 / 1", backgroundColor: "rgba(11,20,36,0.18)", border: "1px solid rgba(255,255,255,0.78)", boxShadow: "0 0 0 1px rgba(15,23,42,0.32), 0 4px 18px rgba(0,0,0,0.22)" }}>
                        <div className="absolute -left-px -top-px w-8 h-8 border-l-[3px] border-t-[3px] rounded-tl-md border-white" style={{ filter: "drop-shadow(0 1px 2px rgba(15,23,42,0.8))" }} />
                        <div className="absolute -right-px -top-px w-8 h-8 border-r-[3px] border-t-[3px] rounded-tr-md border-white" style={{ filter: "drop-shadow(0 1px 2px rgba(15,23,42,0.8))" }} />
                        <div className="absolute -left-px -bottom-px w-8 h-8 border-l-[3px] border-b-[3px] rounded-bl-md border-white" style={{ filter: "drop-shadow(0 1px 2px rgba(15,23,42,0.8))" }} />
                        <div className="absolute -right-px -bottom-px w-8 h-8 border-r-[3px] border-b-[3px] rounded-br-md border-white" style={{ filter: "drop-shadow(0 1px 2px rgba(15,23,42,0.8))" }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="relative flex items-center justify-center w-full h-full" style={{ backgroundColor: "#E4ECF6" }}>
                    <div className="absolute top-4 left-4 w-8 h-8 border-l-[3px] border-t-[3px] rounded-tl-md" style={{ borderColor: "#1A2B4A" }} />
                    <div className="absolute top-4 right-4 w-8 h-8 border-r-[3px] border-t-[3px] rounded-tr-md" style={{ borderColor: "#1A2B4A" }} />
                    <div className="absolute bottom-4 left-4 w-8 h-8 border-l-[3px] border-b-[3px] rounded-bl-md" style={{ borderColor: "#1A2B4A" }} />
                    <div className="absolute bottom-4 right-4 w-8 h-8 border-r-[3px] border-b-[3px] rounded-br-md" style={{ borderColor: "#1A2B4A" }} />
                    <div className="flex items-center justify-center rounded-full border border-white/80 shadow-sm" style={{ width: 132, height: 132, backgroundColor: "#F8FAFD", color: "#1A2B4A" }}>
                      <QrCode size={80} strokeWidth={1.6} aria-hidden="true" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="p-5 md:p-6 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-start gap-4" style={{ backgroundColor: "#EAF0F8" }}>
              <div className="rounded-lg border p-4" style={{ backgroundColor: "#F8FAFD", borderColor: "#D4DFEC" }}>
                <div className="font-dm mb-2" style={{ fontSize: 10, fontWeight: 800, color: "#64748B", letterSpacing: 0.7 }}>SCANNER STATUS</div>
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: scanPopup ? "#DCFCE7" : cameraError ? "#FEE2E2" : isScanning ? "#DBEAFE" : "#DCFCE7",
                  }}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${isScanning && !cameraError ? "animate-pulse" : ""}`}
                    style={{ backgroundColor: scanPopup ? "#16A34A" : cameraError ? "#DC2626" : isScanning ? "#2563EB" : "#16A34A" }}
                  />
                  <span
                    className="font-dm"
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: scanPopup ? "#166534" : cameraError ? "#B91C1C" : isScanning ? "#1D4ED8" : "#166534",
                      letterSpacing: 0.4,
                    }}
                  >
                    {scanPopup ? "VERIFIED" : cameraError ? "ERROR" : isScanning ? "SCANNING" : "READY"}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border p-4" style={{ backgroundColor: "#F8FAFD", borderColor: "#D4DFEC" }}>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={17} style={{ color: "#1A2B4A" }} />
                  <span className="font-syne" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>Secure Verification</span>
                </div>
                <p className="font-dm mt-1.5" style={{ fontSize: 11, lineHeight: 1.5, color: "#64748B" }}>Scan the Waybill QR code to automatically verify the shipment details.</p>
              </div>
            </aside>
          </div>
        </section>

        <section>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-3">
            <div>
              <h2 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>📦 Dispatch Labels — Ready for Packing</h2>
              <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>Print or reprint dispatch labels for finished production items before they ship.</p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                <input
                  type="search"
                  value={dispatchSearch}
                  onChange={(event) => setDispatchSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setIsDispatchFilterOpen(false);
                  }}
                  placeholder="Search JO, client, or item..."
                  aria-label="Search ready-for-dispatch job orders"
                  className="font-dm w-full pl-9 pr-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400"
                  style={{ fontSize: 13, color: "#0F172A" }}
                />
              </div>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDispatchFilterOpen((open) => !open)}
                  aria-label="Filter dispatch job orders"
                  aria-expanded={isDispatchFilterOpen}
                  className="font-dm flex items-center justify-center w-10 h-10 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  style={{ color: dispatchDateFilter !== "all" ? "#1A2B4A" : "#64748B" }}
                >
                  <Filter size={16} />
                </button>
                {isDispatchFilterOpen && (
                  <div className="absolute right-0 top-12 z-20 w-64 bg-white rounded-lg border border-slate-200 p-4 shadow-lg">
                    <label className="font-dm block" style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
                      Date
                      <select
                        value={dispatchDateFilter}
                        onChange={(event) => setDispatchDateFilter(event.target.value)}
                        className="font-dm mt-1.5 w-full px-3 py-2 rounded-md border border-slate-200 bg-white outline-none focus:border-slate-400"
                        style={{ fontSize: 13, color: "#0F172A" }}
                      >
                        <option value="today">Today</option>
                        <option value="7days">Last 7 Days</option>
                        <option value="30days">Last 30 Days</option>
                        <option value="all">All</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
            <table className="w-full">
              <thead style={{ backgroundColor: "#F4F6F9" }}>
                <tr>
                  {["JO No.", "Client", "Item", "Qty", "Method", "Status"].map((h) => (
                    <th key={h} className="font-dm text-left px-4 py-3" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ready.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No items ready for dispatch.</td></tr>
                ) : filteredReady.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>No matching job orders found.</td></tr>
                ) : filteredReady.map((c) => {
                  const inquiry = readyInquiries.find((item) => item.id === c.id);
                  const isExpanded = selectedId === c.id;
                  const hasWaybill = Boolean(inquiry?.waybillIdentifier?.trim() || inquiry?.waybillNumber?.trim());
                  const displayedWaybill = inquiry?.waybillNumber?.trim() || c.waybillIdentifier;

                  return (
                    <Fragment key={c.id}>
                      <tr
                        onClick={() => setSelectedId(isExpanded ? null : c.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedId(isExpanded ? null : c.id);
                          }
                        }}
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        aria-controls={`dispatch-details-${c.id}`}
                        className="border-t border-slate-200/70 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                      >
                        <td className="px-4 py-3 font-mono-jb" style={{ fontSize: 12, fontWeight: 700, color: "#1A2B4A" }}>{c.jo}</td>
                        <td className="px-4 py-3 font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{c.client}</td>
                        <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{c.item}</td>
                        <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{c.qty} pcs</td>
                        <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{c.method}</td>
                        <td className="px-4 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#C8102E" }}>Ready for Dispatch</span></td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <section id={`dispatch-details-${c.id}`} className="border-t border-slate-200/70 px-4 py-3" style={{ backgroundColor: "#F8FAFC" }}>
                              <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                  <h3 className="font-syne" style={{ fontSize: 14, fontWeight: 800, color: "#1A2B4A", letterSpacing: 0.5 }}>WAYBILL</h3>
                                  <p className="font-dm mt-0.5" style={{ fontSize: 11, color: "#64748B" }}>Shipment document</p>
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-4">
                                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                                    {hasWaybill && (
                                      <span className="font-mono-jb" style={{ fontSize: 14, fontWeight: 800, color: "#1A2B4A" }}>
                                        {displayedWaybill}
                                      </span>
                                    )}
                                    <span className="font-dm flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 700, color: hasWaybill ? "#15803D" : "#64748B" }}>
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hasWaybill ? "#16A34A" : "#94A3B8" }} />
                                      {hasWaybill ? "Ready" : "Not Generated"}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => { void openWaybillPreview(c); }}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-white font-dm hover:opacity-90"
                                    style={{ backgroundColor: "#C8102E", fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}
                                  >
                                    <Printer size={14} strokeWidth={2.5} />
                                    {hasWaybill ? "Print Waybill" : "Generate & Print Waybill"}
                                  </button>
                                </div>
                              </div>
                            </section>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {waybillPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.7)" }}
        >
          <div
            className="bg-white rounded-xl w-full max-w-4xl flex flex-col"
            style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.35)", maxHeight: "90vh" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0 waybill-preview-actions">
              <div>
                <h3 className="font-syne" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Waybill Preview</h3>
                <p className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{waybillPreview.shipment.waybillIdentifier} · ready to print</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintWaybill}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-white font-dm hover:opacity-90"
                  style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700 }}
                >
                  <Printer size={13} /> Print Waybill
                </button>
                <button onClick={() => setWaybillPreview(null)} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center" aria-label="Close Waybill preview">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-auto p-4 md:p-5 print:p-0" style={{ backgroundColor: "#F4F6F9" }}>
              <article
                id="waybill-preview-document"
                className="bg-white mx-auto print:shadow-none"
                style={{ width: "100%", maxWidth: 560, padding: 20, boxShadow: "0 4px 16px rgba(15,23,42,0.08)", border: "1px solid #E2E8F0" }}
              >
                <div className="flex items-start justify-between gap-3 pb-3 border-b" style={{ borderColor: "#CBD5E1" }}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex flex-col items-center">
                      <span style={{ fontSize: 30, color: "#C8102E", fontWeight: 900, lineHeight: 0.9 }}>▲</span>
                      <span className="font-dm" style={{ fontSize: 7, fontWeight: 800, color: "#C8102E", letterSpacing: 0.8, marginTop: 1 }}>EFIP</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-syne" style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", letterSpacing: 0.3, textTransform: "uppercase" }}>
                        Enter-Flow / Enter-Fil Industrial Products
                      </div>
                      <div className="font-dm mt-1" style={{ fontSize: 10, color: "#475569", lineHeight: 1.4 }}>
                        Sitio Hulo, Barangay Balasing - San Jose Rd<br />
                        Santa Maria, 3022 Bulacan
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-syne" style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: 1, lineHeight: 1 }}>WAYBILL</div>
                    <div className="font-dm mt-1.5" style={{ fontSize: 9, color: "#64748B" }}>Dispatch Date</div>
                    <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{waybillPreview.dispatchDate}</div>
                  </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 border-b border-slate-200">
                  <div className="flex flex-col gap-2.5 min-w-0">
                    <div>
                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.6, textTransform: "uppercase" }}>Waybill No.</div>
                      <div className="font-mono-jb mt-0.5 break-words" style={{ fontSize: 19, fontWeight: 800, color: "#1A2B4A" }}>{waybillPreview.shipment.waybillIdentifier}</div>
                    </div>
                    <div>
                      <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.6, textTransform: "uppercase" }}>JO No.</div>
                      <div className="font-mono-jb mt-0.5 break-words" style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{waybillPreview.shipment.jo}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <img src={waybillPreview.qrDataUrl} alt="QR code containing Waybill identifier" className="w-24 h-24" />
                    <div className="font-dm mt-0.5 text-center" style={{ fontSize: 9, fontWeight: 700, color: "#475569" }}>QR Code</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 py-3 border-b border-slate-200">
                  <div className="pr-4 border-r border-slate-200">
                    <div className="font-dm pb-1 mb-1.5 border-b border-slate-200" style={{ fontSize: 10, fontWeight: 800, color: "#1A2B4A", letterSpacing: 0.8 }}>FROM</div>
                    <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Enter-Fil Industrial Products</div>
                    <div className="font-dm mt-1" style={{ fontSize: 11, lineHeight: 1.45, color: "#475569" }}>
                      Sitio Hulo, Barangay Balasing - San Jose Rd<br />
                      Santa Maria, 3022 Bulacan
                    </div>
                  </div>
                  <div className="pl-1">
                    <div className="font-dm pb-1 mb-1.5 border-b border-slate-200" style={{ fontSize: 10, fontWeight: 800, color: "#1A2B4A", letterSpacing: 0.8 }}>TO</div>
                    <div className="font-dm" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{waybillPreview.shipment.client}</div>
                    <div className="font-dm mt-1" style={{ fontSize: 11, lineHeight: 1.45, color: "#475569", overflowWrap: "anywhere" }}>
                      {waybillPreview.clientAddress}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  {[
                    ["Item / Product", waybillPreview.shipment.item],
                    ["Quantity", `${waybillPreview.shipment.qty} pcs`],
                    ["PO Number", waybillPreview.shipment.po],
                    ["SI Number", waybillPreview.shipment.si],
                    ["Delivery Method", waybillPreview.shipment.method],
                  ].map(([label, value]) => (
                    <WaybillField key={label} label={label} value={value} />
                  ))}
                </div>
              </article>
            </div>
          </div>
        </div>
      )}

      {/* Scan popup */}
      {scanPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={() => setScanPopup(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1A2B4A" }}>
              <div className="flex items-center gap-3">
                <ScanLine size={18} style={{ color: "white" }} />
                <span className="font-syne text-white" style={{ fontSize: 15, fontWeight: 700 }}>Waybill Found</span>
              </div>
              <button onClick={() => setScanPopup(null)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/10"><X size={16} style={{ color: "white" }} /></button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "#F0FDF4", border: "1px solid #86EFAC" }}>
                <CheckCircle2 size={18} style={{ color: "#16A34A" }} />
                <div>
                  <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", textTransform: "uppercase" }}>Waybill Number</div>
                  <div className="font-mono-jb" style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>{scanPopup.waybillIdentifier}</div>
                  <div className="font-dm" style={{ fontSize: 11, color: "#16A34A" }}>Waybill matched successfully</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Job Order", scanPopup.jo], ["Client", scanPopup.client],
                  ["Item / Product", scanPopup.item], ["Quantity", `${scanPopup.qty} pcs`],
                  ["Shipment Status", scanPopup.status], ["PO", scanPopup.po],
                  ["SI", scanPopup.si], ["Contact", scanPopup.contact],
                  ["Delivery Method", scanPopup.method],
                ].map(([lbl, val]) => (
                  <div key={lbl}>
                    <div className="font-dm" style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>{lbl}</div>
                    <div className="font-dm" style={{ fontSize: 12, color: "#0F172A", fontWeight: 600 }}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setScanPopup(null)} className="flex-1 py-2.5 rounded-md font-dm border border-slate-200 hover:bg-slate-50" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Close</button>
                {scanPopup.status === "Ready for Dispatch" && (
                  <button onClick={() => { setSelectedId(scanPopup.id); setScanPopup(null); toast.success("Shipment details loaded"); }} className="flex-1 py-2.5 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>Load & View Details</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          #waybill-preview-document, #waybill-preview-document * { visibility: visible !important; }
          #waybill-preview-document {
            position: fixed !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 18px !important;
            border: 0 !important;
            box-shadow: none !important;
            aspect-ratio: auto !important;
          }
          .waybill-preview-actions { display: none !important; }
        }
        @media screen and (max-width: 640px) {
          #waybill-preview-document { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}

function WaybillField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 border-b border-slate-100 last:border-b-0 min-w-0">
      <span className="font-dm" style={{ fontSize: 9, color: "#64748B" }}>{label}</span>
      <span className="font-dm text-right break-words" style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{value}</span>
    </div>
  );
}
