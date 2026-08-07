/**
 * Mock data for the TB-DOTS Program Dashboard (Type B — Dashboard 10).
 * FHIR alignment: Condition (ICD-10 A15-A19), ServiceRequest (sputum,
 * GeneXpert, CXR), MedicationRequest (DOTS regimen), CarePlan (treatment
 * phase / outcome per WHO definitions).
 */
import { BARANGAYS, seededRange, patientId } from "./shared.mock";

const months24 = Array.from({ length: 24 }, (_, i) => {
  const date = new Date(2024, 8 + i, 1); // Sep 2024 .. Aug 2026
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
});

export interface TbTrendPoint {
  month: string;
  bacConfirmed: number;
  clinicallyDiagnosed: number;
  rate: number;
}

export interface CascadeStage {
  id: string;
  label: string;
  value: number;
}

export interface DrTbCase {
  id: string;
  barangay: string;
  type: "MDR" | "XDR" | "Pre-XDR";
  startDate: string;
  phase: string;
  nextReview: string;
  status: "On track" | "Delayed" | "Interrupted";
}

export interface TbData {
  tenant: string;
  period: string;
  trend: TbTrendPoint[];
  nationalTarget: number;
  cascade: CascadeStage[];
  whoTargetSuccess: number;
  outcomes: { outcome: string; count: number; color: string }[];
  cohortTrend: { month: string; successRate: number }[];
  drTbCases: DrTbCase[];
  drTbByBarangay: { id: string; name: string; count: number }[];
}

function buildTrend(): TbTrendPoint[] {
  return months24.map((month, i) => {
    const bacConfirmed = Math.round(seededRange(i, 60, 96, 90));
    const clinicallyDiagnosed = Math.round(seededRange(i, 24, 48, 91));
    const rate = Math.round(((bacConfirmed + clinicallyDiagnosed) / 480_000) * 100_000 * 10) / 10;
    return { month, bacConfirmed, clinicallyDiagnosed, rate };
  });
}

export function getTbData(): TbData {
  return {
    tenant: "Cebu City Health Office",
    period: "August 2026 (MTD)",
    trend: buildTrend(),
    nationalTarget: 34,
    cascade: [
      { id: "estimated", label: "Estimated TB burden (WHO incidence)", value: 2_180 },
      { id: "suspects", label: "TB suspects identified (cough ≥2 weeks)", value: 1_460 },
      { id: "tested", label: "Diagnostic tests requested", value: 1_120 },
      { id: "diagnosed", label: "Bacteriologically/clinically diagnosed", value: 842 },
      { id: "initiated", label: "Treatment initiated", value: 796 },
      { id: "completed", label: "Treatment completed or cured", value: 704 },
      { id: "success", label: "Treatment success rate", value: 704 },
    ],
    whoTargetSuccess: 90,
    outcomes: [
      { outcome: "Cured", count: 412, color: "#1A7A3C" },
      { outcome: "Treatment Completed", count: 292, color: "#4454C3" },
      { outcome: "Treatment Failed", count: 24, color: "#C0392B" },
      { outcome: "Lost to Follow-up", count: 46, color: "#E67E22" },
      { outcome: "Died", count: 18, color: "#8B0000" },
      { outcome: "Not Evaluated", count: 12, color: "#8A8F98" },
    ],
    cohortTrend: Array.from({ length: 12 }, (_, i) => ({
      month: months24[12 + i] ?? `M${i}`,
      successRate: Math.round(seededRange(i, 82, 92, 92) * 10) / 10,
    })),
    drTbCases: Array.from({ length: 12 }, (_, i) => {
      const b = BARANGAYS[i % BARANGAYS.length]!;
      const types: DrTbCase["type"][] = ["MDR", "MDR", "Pre-XDR", "XDR"];
      const statuses: DrTbCase["status"][] = ["On track", "On track", "Delayed", "Interrupted"];
      return {
        id: patientId(i + 200),
        barangay: b.name,
        type: types[i % types.length]!,
        startDate: `2026-${String(1 + (i % 8)).padStart(2, "0")}-${String(4 + (i % 20)).padStart(2, "0")}`,
        phase: i % 3 === 0 ? "Intensive" : "Continuation",
        nextReview: `2026-${String(8 + (i % 4)).padStart(2, "0")}-${String(5 + (i % 20)).padStart(2, "0")}`,
        status: statuses[i % statuses.length]!,
      };
    }),
    drTbByBarangay: BARANGAYS.map((b, i) => ({
      id: b.id,
      name: b.name,
      count: Math.round(seededRange(i, 0, 4, 93)),
    })),
  };
}

export function fetchTbData(): Promise<TbData> {
  return new Promise((resolve) => setTimeout(() => resolve(getTbData()), 500));
}
