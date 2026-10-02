"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle2, Printer, AlertTriangle } from "lucide-react";
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Select, Toggle, Separator } from "@/components/ui";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { apiFetch, useAuth } from "@/lib/auth";
import QRCode from "qrcode";

const COMMODITIES = [
  { value: "yellow-maize", label: "Yellow Maize" },
  { value: "white-maize",  label: "White Maize" },
  { value: "soybeans",     label: "Soybeans" },
  { value: "sorghum",      label: "Sorghum" },
  { value: "paddy-rice",   label: "Paddy Rice" },
];

const SILOS = [
  { value: "1", label: "Silo A-04 · Tamale Central Depot" },
  { value: "2", label: "Silo A-01 · Kumasi Grain Hub" },
  { value: "3", label: "Silo B-02 · Techiman Aggregation Centre" },
  { value: "4", label: "Silo B-05 · Sunyani Regional Store" },
];

function computeGrade(mc: number, fm: number, bg: number, pest: boolean) {
  if (pest || mc > 14 || fm > 2 || bg > 4) return null;
  if (mc <= 13 && fm <= 1 && bg <= 2) return "Grade 1";
  return "Grade 2";
}

function ScaleTicket({ commodity, gross, tare, net, moisture, foreign, broken, receiptHash }: {
  commodity: string; gross: number; tare: number; net: number;
  moisture: number; foreign: number; broken: number; receiptHash?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const label = COMMODITIES.find(c => c.value === commodity)?.label ?? commodity;
  const grade = computeGrade(moisture, foreign, broken, false) ?? "FAIL";
  const qrData = receiptHash
    ? `smartvault://receipt/${receiptHash}`
    : `smartvault://pending/${commodity}/${net}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrData, {
      width: 80, margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [qrData]);

  return (
    <div className="font-mono text-[10px] leading-snug bg-white text-black rounded border border-border p-3 space-y-1">
      <p className="text-center font-bold text-[11px] tracking-widest">SMARTVAULT · SCALE TICKET</p>
      <p className="text-center text-[9px] text-gray-500">TAMALE CENTRAL · GATE #2</p>
      <div className="border-t border-dashed border-gray-300 my-1" />
      <p>INTAKE  {new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}</p>
      <p>{label.toUpperCase()}  {grade.toUpperCase()}</p>
      <p>GROSS {gross.toLocaleString()}  TARE {tare.toLocaleString()}</p>
      <p className="font-bold">NET  {net.toLocaleString()} KG</p>
      <p>MC {moisture}%  FM {foreign}%  BG {broken}%</p>
      <div className="border-t border-dashed border-gray-300 my-1" />
      <div className="flex justify-center py-1">
        <canvas ref={canvasRef} className="rounded" />
      </div>
      <div className="flex justify-between text-[9px] pt-1">
        <span className="text-orange-500">OFFLINE</span>
        <span className="text-gray-400">PENDING SYNC</span>
      </div>
    </div>
  );
}

function QualityField({ label, value, onChange, max }: {
  label: string; value: string; onChange: (v: string) => void; max: number;
}) {
  const num = parseFloat(value) || 0;
  const ok = num <= max;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm text-foreground shrink-0">{label}</span>
      <span className="text-xs text-muted-foreground shrink-0 w-20">MAX {max}%</span>
      <div className="flex-1 relative">
        <input
          type="number" step="0.1" value={value}
          onChange={e => onChange(e.target.value)}
          className={cn(
            "h-9 w-full rounded-md border bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors",
            ok ? "border-input" : "border-critical focus:ring-critical"
          )}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
      {ok
        ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        : <AlertTriangle className="h-4 w-4 text-critical shrink-0" />}
    </div>
  );
}

export default function IntakePage() {
  const { username } = useAuth();
  const [commodity, setCommodity] = useState("yellow-maize");
  const [gross, setGross]         = useState("32480");
  const [tare, setTare]           = useState("8220");
  const [moisture, setMoisture]   = useState("12.4");
  const [foreign, setForeign]     = useState("0.8");
  const [broken, setBroken]       = useState("1.2");
  const [pest, setPest]           = useState(false);
  const [silo, setSilo]           = useState("1");
  const [saved, setSaved]         = useState(false);
  const [recordError, setRecordError] = useState("");
  const [receiptHash, setReceiptHash] = useState<string | undefined>();

  const grossNum    = parseFloat(gross)    || 0;
  const tareNum     = parseFloat(tare)     || 0;
  const net         = Math.max(0, grossNum - tareNum);
  const moistureNum = parseFloat(moisture) || 0;
  const foreignNum  = parseFloat(foreign)  || 0;
  const brokenNum   = parseFloat(broken)   || 0;
  const grade       = computeGrade(moistureNum, foreignNum, brokenNum, pest);
  const withinLimits = grade !== null;

  const handleRecord = useCallback(async () => {
    setRecordError("");
    const payload = {
      farmer_id:        username ?? "UNKNOWN",
      commodity,
      weight_kg:        net,
      moisture_percent: moistureNum,
      warehouse:        silo,
    };

    // Try API first; fall back to Dexie when offline
    try {
      const res = await apiFetch("/api/intake/transactions/", {
        method: "POST",
        body:   JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setReceiptHash(data.receipt_hash);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        return;
      }

      const data = await res.json().catch(() => ({}));
      const detail = typeof data?.detail === "string" ? data.detail : "";
      const validation = Object.values(data).flat().join(" ");
      setRecordError(detail || validation || "The consignment could not be recorded.");
      return;
    } catch {
      // offline — fall through to Dexie
    }

    const id = await db.intakeTransactions.add({
      farmerId:        username ?? "UNKNOWN",
      commodity,
      weightKg:        net,
      moisturePercent: moistureNum,
      warehouseId:     silo,
      timestamp:       Date.now(),
      synced:          false,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [commodity, net, moistureNum, silo]);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-48px)]">
      {/* Page header */}
      <div className="px-4 md:px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">Screen A · New Consignment</p>
            <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight">
              Offline-First Gate Intake &amp; Produce Grading Terminal
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Weighbridge capture, grading, allocation, and print-ready evidence in one resilient workflow.
            </p>
          </div>
          {/* Session info block — top right */}
          <div className="hidden lg:flex flex-col items-end shrink-0 text-right">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Local Session</span>
            <span className="font-mono text-sm font-bold text-foreground">{username ?? "—"}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }).toUpperCase()}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date().toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" })}
            </span>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-auto">
        {/* Left panel */}
        <div className="flex-1 min-w-0 p-4 md:p-6 space-y-5">
          <Select
            label="Commodity"
            value={commodity}
            onChange={e => setCommodity(e.target.value)}
            options={COMMODITIES}
            hint="Yellow Maize · White Maize · Soybeans · Sorghum · Paddy Rice"
          />

          {/* Gross / Tare / Net */}
          <div>
            <div className="grid grid-cols-[1fr_16px_1fr_16px_1fr] items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gross Weight (KG)</label>
                <input type="number" value={gross} onChange={e => setGross(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <span className="pb-2 text-muted-foreground font-bold text-center">−</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tare Weight (KG)</label>
                <input type="number" value={tare} onChange={e => setTare(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <span className="pb-2 text-muted-foreground font-bold text-center">=</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-primary uppercase tracking-wide">Net Certified Weight</label>
                <div className="h-10 flex items-center rounded-md border-2 border-primary bg-primary/5 px-3">
                  <span className="text-lg font-black text-primary">{net.toLocaleString()} kg</span>
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Live result verified against weighbridge stability window · ±2 kg</p>
          </div>

          <Separator />

          {/* Quality telemetry */}
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3">Quality inspection telemetry</h2>
            <div className="space-y-2.5">
              <QualityField label="Moisture Content" value={moisture} onChange={setMoisture} max={13.0} />
              <QualityField label="Foreign Matter"   value={foreign}  onChange={setForeign}  max={2.0} />
              <QualityField label="Broken Grains"    value={broken}   onChange={setBroken}   max={4.0} />
            </div>
            {/* Pest presence */}
            <div className="mt-3 flex items-center justify-between rounded-md border border-border px-4 py-2.5">
              <span className="text-sm text-foreground">Pest Presence</span>
              <div className="flex items-center gap-3">
                <Toggle checked={pest} onChange={setPest} label="Pest presence" />
                {!pest && grade && (
                  <Badge variant="success" className="text-xs">
                    AUTOMATED GRADE &nbsp; {grade}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <Select
            label="Destination Silo / Bin"
            value={silo}
            onChange={e => setSilo(e.target.value)}
            options={SILOS}
            hint="Remaining capacity 418.6 t · aeration available"
          />
        </div>

        {/* Right panel */}
        <div className="lg:w-[340px] xl:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-muted/30 p-4 md:p-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Automated Grade</CardTitle>
              {withinLimits && <Badge variant="success" className="text-xs">● Within limits</Badge>}
            </CardHeader>
            <CardContent>
              <p className={cn("text-4xl font-black", withinLimits ? "text-primary" : "text-critical")}>
                {grade ?? "Fail"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                MC, foreign matter, and broken-grain thresholds satisfy {grade ?? "no"} intake policy.
              </p>
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">80mm thermal scale ticket</span>
              <Badge variant="online" className="text-[10px]">LIVE PREVIEW</Badge>
            </div>
            <ScaleTicket commodity={commodity} gross={grossNum} tare={tareNum} net={net}
              moisture={moistureNum} foreign={foreignNum} broken={brokenNum}
              receiptHash={receiptHash} />
          </div>
        </div>
      </div>

      {/* CTA footer */}
      <div className="border-t border-border bg-card px-4 md:px-6 py-3 flex items-center gap-4">
        <span className="text-xs text-muted-foreground hidden sm:block">
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">CTRL</kbd>
          {" + "}
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">ENTER</kbd>
        </span>
        <div className="flex items-center gap-3 ml-auto">
          {recordError && <span className="text-xs text-critical">{recordError}</span>}
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {receiptHash ? "Saved to registry" : "Saved locally · pending sync"}
            </span>
          )}
          <Button size="lg" onClick={handleRecord} className="font-bold">
            <Printer className="h-4 w-4" />
            Record Consignment &amp; Print QR Tag
          </Button>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:block">Saves locally while offline</span>
      </div>
    </div>
  );
}
