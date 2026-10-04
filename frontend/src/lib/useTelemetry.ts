"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/auth";

export interface SiloReading {
  silo_id:          string;
  temperature_c:    number;
  humidity_percent: number;
  time:             string;
}

export const TELEMETRY_REFRESH_SECONDS = 15;
const POLL_MS = TELEMETRY_REFRESH_SECONDS * 1_000;

export function useTelemetry(siloIds: string[]) {
  const [readings, setReadings] = useState<Record<string, SiloReading>>({});
  const [profile,  setProfile]  = useState<SiloReading[]>([]);
  const [selectedSilo, setSelectedSilo] = useState<string>(siloIds[0] ?? "");
  const [error, setError] = useState(false);

  const fetchLatest = useCallback(async () => {
    try {
      const results = await Promise.all(
        siloIds.map(id =>
          apiFetch(`/api/telemetry/readings/?silo_id=${id}&limit=1&_=${Date.now()}`, { cache: "no-store" })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );
      const map: Record<string, SiloReading> = {};
      results.forEach((res, i) => {
        const rows = Array.isArray(res) ? res : res?.results ?? [];
        if (rows[0]) map[siloIds[i]] = rows[0];
      });
      if (Object.keys(map).length > 0) {
        setReadings(map);
        setError(false);
      }
    } catch {
      setError(true);
    }
  }, [siloIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfile = useCallback(async (siloId: string) => {
    try {
      const res = await apiFetch(`/api/telemetry/readings/?silo_id=${siloId}&limit=96&_=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setProfile(Array.isArray(data) ? data : data.results ?? []);
      }
    } catch {
      // keep existing profile
    }
  }, []);

  useEffect(() => {
    fetchLatest();
    const t = setInterval(fetchLatest, POLL_MS);
    return () => clearInterval(t);
  }, [fetchLatest]);

  useEffect(() => {
    if (selectedSilo) fetchProfile(selectedSilo);
  }, [selectedSilo, fetchProfile]);

  return { readings, profile, selectedSilo, setSelectedSilo, error };
}
