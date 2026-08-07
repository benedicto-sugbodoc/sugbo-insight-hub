import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { CohortBuilder, type CohortField } from "@/components/analytics/cohort-builder";
import { ChartSkeletonBlock } from "@/components/analytics/shared";
import { BARANGAYS } from "@/lib/analytics/lgu/shared.mock";
import { fetchCommunityPatients, type CommunityPatient } from "@/lib/analytics/lgu/cohort.mock";
import type { ReportColumn } from "@/components/reports/types";

export const Route = createFileRoute("/lgu/analytics/cohorts")({
  head: () => ({
    meta: [
      { title: "Cohort Builder — SugboDoc LGU Analytics" },
      {
        name: "description",
        content:
          "Build community health cohorts by barangay, demographics and disease/programme status for outreach and surveillance.",
      },
    ],
  }),
  component: LguCohortsPage,
});

const diagnosisOptions = [
  { label: "J00 · Acute nasopharyngitis", value: "J00" },
  { label: "I10 · Essential hypertension", value: "I10" },
  { label: "E11.9 · Type 2 diabetes mellitus", value: "E11.9" },
  { label: "A09 · Diarrhea and gastroenteritis", value: "A09" },
  { label: "A90 · Dengue fever", value: "A90" },
  { label: "A15.0 · Pulmonary tuberculosis", value: "A15.0" },
  { label: "Z34.9 · Normal pregnancy supervision", value: "Z34.9" },
  { label: "M79.1 · Myalgia", value: "M79.1" },
];

const fields: CohortField<CommunityPatient>[] = [
  {
    key: "barangayId",
    label: "Barangay",
    type: "select",
    group: "Location",
    options: BARANGAYS.map((b) => ({ label: b.name, value: b.id })),
    getValue: (r) => r.barangayId,
  },
  {
    key: "age",
    label: "Age",
    type: "range",
    group: "Demographics",
    min: 0,
    max: 90,
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
    options: diagnosisOptions,
    getValue: (r) => r.diagnosisCode,
  },
  {
    key: "hypertensive",
    label: "Known hypertensive",
    type: "boolean",
    group: "Programme status",
    getValue: (r) => r.hypertensive,
  },
  {
    key: "diabetic",
    label: "Known diabetic",
    type: "boolean",
    group: "Programme status",
    getValue: (r) => r.diabetic,
  },
  {
    key: "tbCase",
    label: "Active TB case (DOTS)",
    type: "boolean",
    group: "Programme status",
    getValue: (r) => r.tbCase,
  },
  {
    key: "dengueCase",
    label: "Dengue case",
    type: "boolean",
    group: "Programme status",
    getValue: (r) => r.dengueCase,
  },
  {
    key: "pregnant",
    label: "Currently pregnant",
    type: "boolean",
    group: "Programme status",
    getValue: (r) => r.pregnant,
  },
  {
    key: "fullyImmunized",
    label: "Fully immunized (age-appropriate)",
    type: "boolean",
    group: "Programme status",
    getValue: (r) => r.fullyImmunized,
  },
];

const resultColumns: ReportColumn<CommunityPatient>[] = [
  { key: "patientId", header: "Patient ID" },
  { key: "name", header: "Name" },
  { key: "age", header: "Age", align: "right" },
  { key: "gender", header: "Gender" },
  { key: "barangayName", header: "Barangay" },
  {
    key: "diagnosisCode",
    header: "Diagnosis",
    render: (r) => `${r.diagnosisCode} · ${r.diagnosisDesc}`,
  },
  { key: "lastVisitDate", header: "Last visit" },
];

const exportColumns = [
  { header: "Patient ID", get: (r: CommunityPatient) => r.patientId },
  { header: "Name", get: (r: CommunityPatient) => r.name },
  { header: "Age", get: (r: CommunityPatient) => String(r.age) },
  { header: "Gender", get: (r: CommunityPatient) => r.gender },
  { header: "Barangay", get: (r: CommunityPatient) => r.barangayName },
  { header: "ICD-10", get: (r: CommunityPatient) => r.diagnosisCode },
  { header: "Diagnosis", get: (r: CommunityPatient) => r.diagnosisDesc },
  { header: "Last visit", get: (r: CommunityPatient) => r.lastVisitDate },
];

function LguCohortsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["lgu-analytics", "cohorts"],
    queryFn: fetchCommunityPatients,
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
    <CohortBuilder<CommunityPatient>
      title="Community Cohort Builder"
      description="Combine barangay, demographic and programme-status filters to build outreach and surveillance cohorts."
      fields={fields}
      rows={data}
      getId={(r) => r.patientId}
      resultColumns={resultColumns}
      breakdownFieldKeys={["barangayId", "gender"]}
      exportColumns={exportColumns}
      storageKey="lgu"
      consentText="I confirm this patient-level extract is for an approved public health programme, surveillance, or outreach purpose, and will be handled per the Data Privacy Act (RA 10173) and DOH data sharing guidelines."
    />
  );
}
