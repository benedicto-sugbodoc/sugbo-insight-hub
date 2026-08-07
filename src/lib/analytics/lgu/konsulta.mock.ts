/**
 * Mock data for the Konsulta / PhilHealth OPD Analytics Dashboard
 * (Type B — Dashboard 11). FHIR alignment: Coverage (PhilHealth Konsulta
 * enrollment), Encounter (type=Konsulta), Claim/eKAS, ChargeItem.
 */
import { BHC_LIST, seededRange } from "./shared.mock";
import { CalendarDay } from "@/components/analytics/lgu-shared";

export interface BhcVolume {
  bhc: string;
  current: number;
  priorMonth: number;
  priorYear: number;
}

export interface DenialReason {
  code: string;
  reason: string;
  count: number;
  action: string;
}

export interface FlowStageLike {
  id: string;
  label: string;
  value: number;
}

export interface KonsultaData {
  tenant: string;
  period: string;
  cutoffDay: number;
  volumeByBhc: BhcVolume[];
  calendarDays: CalendarDay[];
  denialReasons: DenialReason[];
  enrollmentFunnel: FlowStageLike[];
  revenueByBhc: {
    bhc: string;
    ekasValue: number;
    oopValue: number;
    visits: number;
    ekasSubmitted: number;
  }[];
}

function buildCalendar(): CalendarDay[] {
  const year = 2026;
  const monthIndex = 7; // August (0-based)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cutoff = 25;
  return Array.from({ length: daysInMonth }, (_, i) => {
    const date = i + 1;
    const weekday = new Date(year, monthIndex, date).getDay();
    const isPast = date <= 7; // "today" mocked as Aug 7
    const submitted = isPast ? Math.round(seededRange(i, 180, 640, 100)) : 0;
    const pending = isPast ? Math.round(seededRange(i, 0, 40, 101)) : 0;
    return { date, weekday, submitted, pending, isCutoff: date === cutoff, isPast };
  });
}

export function getKonsultaData(): KonsultaData {
  const volumeByBhc: BhcVolume[] = BHC_LIST.map((bhc, i) => ({
    bhc,
    current: Math.round(seededRange(i, 640, 1620, 110)),
    priorMonth: Math.round(seededRange(i, 600, 1520, 111)),
    priorYear: Math.round(seededRange(i, 520, 1400, 112)),
  })).sort((a, b) => b.current - a.current);

  return {
    tenant: "Cebu City Health Office",
    period: "August 2026 (MTD)",
    cutoffDay: 25,
    volumeByBhc,
    calendarDays: buildCalendar(),
    denialReasons: [
      {
        code: "KD-101",
        reason: "No CSF on file",
        count: 42,
        action: "Collect and upload Consultation Summary Form",
      },
      {
        code: "KD-204",
        reason: "Patient not enrolled at this KP",
        count: 28,
        action: "Re-verify PhilHealth Konsulta Package enrollment",
      },
      {
        code: "KD-118",
        reason: "Duplicate visit same month at another KP",
        count: 19,
        action: "Coordinate with other KP, retain original claim",
      },
      {
        code: "KD-330",
        reason: "Physician PAN expired",
        count: 14,
        action: "Renew practitioner accreditation number",
      },
      {
        code: "KD-402",
        reason: "Missing required lab attachment",
        count: 11,
        action: "Attach lab result before refiling",
      },
    ],
    enrollmentFunnel: [
      { id: "estimated", label: "PhilHealth members in catchment (est.)", value: 210_000 },
      { id: "enrolled", label: "Enrolled at this KP", value: 148_000 },
      { id: "visited", label: "Had ≥1 Konsulta visit this year", value: 86_400 },
      { id: "screened", label: "Had recommended annual screening", value: 52_200 },
      { id: "referred", label: "Referred and referral completed", value: 18_600 },
    ],
    revenueByBhc: BHC_LIST.map((bhc, i) => ({
      bhc,
      ekasValue: Math.round(seededRange(i, 420_000, 980_000, 113)),
      oopValue: Math.round(seededRange(i, 40_000, 180_000, 114)),
      visits: Math.round(seededRange(i, 640, 1620, 110)),
      ekasSubmitted: Math.round(seededRange(i, 480, 1400, 115)),
    })),
  };
}

export function fetchKonsultaData(): Promise<KonsultaData> {
  return new Promise((resolve) => setTimeout(() => resolve(getKonsultaData()), 500));
}
