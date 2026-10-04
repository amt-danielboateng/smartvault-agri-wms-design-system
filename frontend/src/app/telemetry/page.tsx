"use client";
import { useState, useEffect } from "react";
import { RefreshCw, AlertTriangle, Warehouse, Activity, Cpu, Zap, Wind } from "lucide-react";
import { Badge, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useTelemetry } from "@/lib/useTelemetry";
import { TELEMETRY_REFRESH_SECONDS } from "@/lib/useTelemetry";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

/* ── Seed data (shown when API unavailable) ──────────────────────────── */
type AerationState = "Active" | "Idle";
type SiloStatus    = "normal" | "critical";

interface SiloSeed {
  id: string; commodity: string;
  tempC: number; rh: number; aeration: AerationState;
  fillPct: number; status: SiloStatus;
}

const SILO_SEEDS: SiloSeed[] = [
  { id:"A-01", commodity:"Yellow Maize", tempC:25.1, rh:62, aeration:"Active", fillPct:82, status:"normal" },
  { id:"A-02", commodity:"Soybeans",     tempC:24.4, rh:58, aeration:"Idle",   fillPct:68, status:"normal" },
  { id:"A-03", commodity:"Yellow Maize", tempC:31.8, rh:74, aeration:"Active", fillPct:91, status:"critical" },
  { id:"A-04", commodity:"Yellow Maize", tempC:26.2, rh:63, aeration:"Active", fillPct:57, status:"normal" },
  { id:"A-05", commodity:"Paddy Rice",   tempC:25.7, rh:61, aeration:"Idle",   fillPct:76, status:"normal" },
  { id:"A-06", commodity:"Sorghum",      tempC:24.9, rh:56, aeration:"Idle",   fillPct:44, status:"normal" },
  { id:"B-01", commodity:"White Maize",  tempC:26.8, rh:64, aeration:"Active", fillPct:87, status:"normal" },
  { id:"B-02", commodity:"Soybeans",     tempC:25.3, rh:59, aeration:"Idle",   fillPct:71, status:"normal" },
  { id:"B-03", commodity:"Sorghum",      tempC:24.7, rh:57, aeration:"Idle",   fillPct:63, status:"normal" },
  { id:"B-04", commodity:"Paddy Rice",   tempC:26.4, rh:65, aeration:"Active", fillPct:79, status:"normal" },
  { id:"B-05", commodity:"Yellow Maize", tempC:25.8, rh:68, aeration:"Idle",   fillPct:52, status:"normal" },
  { id:"B-06", commodity:"White Maize",  tempC:26.1, rh:62, aeration:"Active", fillPct:64, status:"normal" },
  { id:"SILO-KMS-01", commodity:"Maize (White Dent)", tempC:27.5, rh:63, aeration:"Active", fillPct:68, status:"normal" },
  { id:"SILO-KMS-02", commodity:"Soya Bean",          tempC:26.7, rh:62, aeration:"Idle",   fillPct:61, status:"normal" },
  { id:"SILO-SUY-01", commodity:"Cowpea",              tempC:27.7, rh:66, aeration:"Active", fillPct:74, status:"normal" },
  { id:"SILO-TAM-01", commodity:"Paddy Rice",          tempC:29.8, rh:68, aeration:"Active", fillPct:79, status:"normal" },
  { id:"SILO-TEK-01", commodity:"Maize (White Dent)", tempC:27.0, rh:64, aeration:"Idle",   fillPct:56, status:"normal" },
];

const SILO_IDS = SILO_SEEDS.map(s => s.id);

/* ── Sub-components ──────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, alert }: {
  label: string; value: string; sub?: string; icon: React.ElementType; alert?: boolean;
}) {
  return (
    <Card className={cn("flex-1 min-w-0", alert && "border-critical/50 bg-critical/5")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-2xl font-black leading-none", alert ? "text-critical" : "text-foreground")}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn("rounded-md p-2 shrink-0", alert ? "bg-critical/10" : "bg-muted")}>
            <Icon className={cn("h-4 w-4", alert ? "text-critical" : "text-muted-foreground")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FillBar({ pct, status }: { pct: number; status: SiloStatus }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>FILL LEVEL</span><span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all",
            status === "critical" ? "bg-critical" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SiloCard({ silo, liveTemp, liveRh, selected, onClick }: {
  silo: SiloSeed; liveTemp?: number; liveRh?: number;
  selected: boolean; onClick: () => void;
}) {
  const tempC = liveTemp ?? silo.tempC;
  const rh    = liveRh   ?? silo.rh;
  const isCritical = tempC > 30 || rh > 75;

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-all w-full",
        isCritical
          ? "border-critical bg-critical/5"
          : selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <div>
          <p className="text-xs font-bold text-foreground">SILO {silo.id}</p>
          <p className="text-[10px] text-muted-foreground">{silo.commodity}</p>
        </div>
        {isCritical
          ? <Badge variant="critical" className="text-[10px]"><AlertTriangle className="h-2.5 w-2.5" /> Spoilage Risk</Badge>
          : <Badge variant="success"  className="text-[10px]">● Normal</Badge>}
      </div>

      {isCritical && (
        <p className="text-[10px] font-semibold text-critical mb-2">
          ⚠ {tempC.toFixed(1)}°C — Spoilage Risk
        </p>
      )}

      <div className="grid grid-cols-3 gap-1 text-[10px]">
        <div>
          <p className="text-muted-foreground">CORE TEMP</p>
          <p className={cn("font-bold text-sm", isCritical ? "text-critical" : "text-foreground")}>
            {tempC.toFixed(1)}°C
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">RH</p>
          <p className="font-bold text-sm text-foreground">{rh.toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-muted-foreground">AERATION</p>
          <p className={cn("font-bold text-sm",
            silo.aeration === "Active" ? "text-primary" : "text-muted-foreground"
          )}>
            {silo.aeration}
          </p>
        </div>
      </div>
      <FillBar pct={silo.fillPct} status={isCritical ? "critical" : "normal"} />
    </button>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function TelemetryPage() {
  const { readings, profile, selectedSilo, setSelectedSilo, error } = useTelemetry(SILO_IDS);
  const [tick, setTick] = useState(0);

  // Countdown display for auto-refresh
  useEffect(() => {
    const t = setInterval(() => setTick(s => (s + 1) % TELEMETRY_REFRESH_SECONDS), 1000);
    return () => clearInterval(t);
  }, []);

  // Build chart data: use live profile if available, else generate from seed
  const chartData = profile.length > 0
    ? profile.map(r => ({
        time: new Date(r.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        core: r.temperature_c,
        dew:  r.humidity_percent * 0.24, // approximate dew-point
      }))
    : Array.from({ length: 25 }, (_, i) => ({
        time: `${String(i).padStart(2, "0")}:00`,
        core: 27 + Math.sin(i / 4) * 3 + (i > 14 ? (i - 14) * 0.35 : 0),
        dew:  18 + Math.sin(i / 6) * 2,
      }));

  const anomalies = SILO_SEEDS.filter(s => {
    const r = readings[s.id];
    return r ? (r.temperature_c > 30 || r.humidity_percent > 75) : s.status === "critical";
  });

  const selectedSeed = SILO_SEEDS.find(s => s.id === selectedSilo)!;
  const selectedReading = readings[selectedSilo];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">
            Screen B · Live Telemetry
          </p>
          <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight">
            Silo Telemetry &amp; Spoilage Anomaly Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Spatial inventory and microclimate intelligence across active storage assets.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {error && (
            <Badge variant="warning" className="text-xs">Offline · seed data</Badge>
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Auto-refresh · {TELEMETRY_REFRESH_SECONDS - tick}s
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Stored Tonnage"          value="8,482.6 t" sub="+311.4 t this week"  icon={Warehouse} />
        <KpiCard label="Active Silo Capacity"          value="71.2%"     sub="3,436 t available"   icon={Activity} />
        <KpiCard label="Sensor Fleet Health"           value="98.6%"     sub="283 / 287 reporting" icon={Cpu} />
        <KpiCard
          label="Active Microclimate Anomalies"
          value={String(anomalies.length)}
          sub={anomalies.length > 0 ? `${anomalies[0].id} · response due` : "All silos nominal"}
          icon={Zap}
          alert={anomalies.length > 0}
        />
      </div>

      {/* Silo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {SILO_SEEDS.map(s => (
          <SiloCard
            key={s.id}
            silo={s}
            liveTemp={readings[s.id]?.temperature_c}
            liveRh={readings[s.id]?.humidity_percent}
            selected={selectedSilo === s.id}
            onClick={() => setSelectedSilo(s.id)}
          />
        ))}
      </div>

      {/* Bottom row: chart + anomaly panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* 24-hour thermal profile */}
        <Card>
          <CardHeader>
            <CardTitle>24-hour thermal profile</CardTitle>
            <span className="text-xs text-muted-foreground">
              Silo {selectedSilo} · WAT · 15-minute sampling
            </span>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-critical rounded" /> Grain core
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-primary rounded" /> Ambient dew-point
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.floor(chartData.length / 6)} />
                <YAxis tick={{ fontSize: 10 }} domain={[14, 36]} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  formatter={(v: number, name: string) => [
                    `${v.toFixed(1)}°C`, name === "core" ? "Core" : "Dew-point",
                  ]}
                />
                <ReferenceLine y={30} stroke="hsl(var(--color-warning))" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="core" stroke="hsl(var(--color-critical))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="dew"  stroke="hsl(var(--color-primary))"  strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-warning flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Aeration guidance: run fans through 18:30; outside dew-point remains below grain core threshold.
            </p>
          </CardContent>
        </Card>

        {/* Active anomaly panel */}
        {anomalies.length > 0 ? (
          <Card className="border-critical/40 bg-critical/5">
            <CardHeader>
              <CardTitle className="text-critical">Active anomaly</CardTitle>
              <Badge variant="critical" className="text-xs">{anomalies.length} critical</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-base font-black text-foreground">
                  SILO {anomalies[0].id} · NORTH CORE
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Temperature rose 3.7°C in 94 minutes while RH crossed the spoilage envelope.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-critical/10 p-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">CORE TEMP</p>
                  <p className="text-xl font-black text-critical">
                    {(readings[anomalies[0].id]?.temperature_c ?? anomalies[0].tempC).toFixed(1)}°C
                  </p>
                </div>
                <div className="rounded-md bg-warning/10 p-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">RH</p>
                  <p className="text-xl font-black text-warning">
                    {(readings[anomalies[0].id]?.humidity_percent ?? anomalies[0].rh).toFixed(0)}%
                  </p>
                </div>
              </div>
              <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 flex items-center gap-2">
                <Wind className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-primary">
                  Aeration active · dispatch inspection
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
              <div className="rounded-full bg-success/10 p-3">
                <Zap className="h-5 w-5 text-success" />
              </div>
              <p className="text-sm font-semibold text-foreground">All silos nominal</p>
              <p className="text-xs text-muted-foreground">No spoilage anomalies detected.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
