import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { CohortBuilder, type CohortField } from "@/components/analytics/cohort-builder";
import { ChartSkeletonBlock } from "@/components/analytics/shared";
import {
  cohortAdmissionTypes,
  cohortDepartments,
  cohortDiagnoses,
  cohortPayers,
  fetchCohortPatients,
  type CohortPatient,
} from "@/lib/analytics/cohort.mock";
import type { ReportColumn } from "@/components/reports/types";

export const Route = createFileRoute("/analytics/cohorts")({
  head: () => ({
    meta: [
      { title: "Cohort Builder — SugboDoc Analytics" },
      {
        name: "description",
        content:
          "Build ad-hoc patient cohorts by demographics, diagnosis, department and payer for quality improvement and research.",
      },
    ],
  }),
  component: CohortsPage,
});

const fields: CohortField<CohortPatient>[] = [
  {
    key: "age",
    label: "Age",
    type: "range",
    group: "Demographics",
    min: 0,
    max: 95,
    unit: "yrs",
    getValue: (r) => r.age,
  },
  {
    key: "gender",
    label: "Gender",
    type: "select",
    group: "Demographics",
    options: [
      { label: "Female", value: "female" },
      { label: "Male", value: "male" },
    ],
    getValue: (r) => r.gender,
  },
  {
    key: "diagnosisCode",
    label: "Diagnosis (ICD-10)",
    type: "select",
    group: "Clinical",
    options: cohortDiagnoses.map(([code, desc]) => ({ label: `${code} · ${desc}`, value: code })),
    getValue: (r) => r.diagnosisCode,
  },
  {
    key: "labAbnormalFlag",
    label: "Abnormal lab result on file",
    type: "boolean",
    group: "Clinical",
    getValue: (r) => r.labAbnormalFlag,
  },
  {
    key: "readmitted30d",
    label: "Readmitted within 30 days",
    type: "boolean",
    group: "Clinical",
    getValue: (r) => r.readmitted30d,
  },
  {
    key: "department",
    label: "Department",
    type: "select",
    group: "Encounter",
    options: cohortDepartments.map((d) => ({ label: d, value: d })),
    getValue: (r) => r.department,
  },
  {
    key: "admissionType",
    label: "Admission type",
    type: "select",
    group: "Encounter",
    options: cohortAdmissionTypes.map((a) => ({ label: a, value: a })),
    getValue: (r) => r.admissionType,
  },
  {
    key: "payer",
    label: "Payer",
    type: "select",
    group: "Encounter",
    options: cohortPayers.map((p) => ({ label: p, value: p })),
    getValue: (r) => r.payer,
  },
];

const resultColumns: ReportColumn<CohortPatient>[] = [
  { key: "patientId", header: "Patient ID" },
  { key: "name", header: "Name" },
  { key: "age", header: "Age", align: "right" },
  { key: "gender", header: "Gender" },
  { key: "department", header: "Department" },
  {
    key: "diagnosisCode",
    header: "Diagnosis",
    render: (r) => `${r.diagnosisCode} · ${r.diagnosisDesc}`,
  },
  { key: "payer", header: "Payer" },
  { key: "lastEncounterDate", header: "Last encounter" },
];

const exportColumns = [
  { header: "Patient ID", get: (r: CohortPatient) => r.patientId },
  { header: "Name", get: (r: CohortPatient) => r.name },
  { header: "Age", get: (r: CohortPatient) => String(r.age) },
  { header: "Gender", get: (r: CohortPatient) => r.gender },
  { header: "Department", get: (r: CohortPatient) => r.department },
  { header: "ICD-10", get: (r: CohortPatient) => r.diagnosisCode },
  { header: "Diagnosis", get: (r: CohortPatient) => r.diagnosisDesc },
  { header: "Payer", get: (r: CohortPatient) => r.payer },
  { header: "Last encounter", get: (r: CohortPatient) => r.lastEncounterDate },
];

function CohortsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "cohorts"],
    queryFn: fetchCohortPatients,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <ChartSkeletonBlock className="h-24" />
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <ChartSkeletonBlock className="h-[500px]" />
          <ChartSkeletonBlock className="h-[500px]" />
        </div>
      </div>
    );
  }

  return (
    <CohortBuilder<CohortPatient>
      title="Cohort Builder"
      description="Combine demographic, clinical and encounter filters to build ad-hoc patient cohorts for QI or research."
      fields={fields}
      rows={data}
      getId={(r) => r.patientId}
      resultColumns={resultColumns}
      breakdownFieldKeys={["gender", "department"]}
      exportColumns={exportColumns}
      storageKey="hospital"
      consentText="I confirm this patient-level extract is for an approved quality improvement, research, or clinical audit purpose, and will be handled per the Data Privacy Act (RA 10173) and hospital data governance policy."
    />
  );
}
