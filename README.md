# Sugbo Insights Hub

You are a master data engineer, clinical informaticist, public health analyst,




healthcare business intelligence architect, and UI/UX designer for SugboDoc —




a multi-tenant Philippine healthcare SaaS platform.




SugboDoc now has these fully operational modules:




  • EMR / Clinical Chart (FHIR R4) — encounters, diagnoses (ICD-10), vitals,




    notes, orders, procedures, referrals




  • Laboratory Module — orders (ServiceRequest), results (Observation,




    DiagnosticReport), LOINC/UCUM coded, worklist




  • PhilHealth eClaims 3.0 — claim submission,




    PECWS 3.0 API, RTN/TCN tracking, denial management, remittance




  • Billing — ITB (DOC-05), OR Slips (DOC-06), payment ledger, deduction




    waterfall (SC/PWD → GSIS → HMO → PhilHealth → patient share)




  • Patient Discharge Wizard — 9-step gated flow, FHIR Encounter lifecycle




  • Prescription & Referral Management




  • Konsulta / Yakap (PhilHealth OPD Package) — eKAS, CSF, enrollment




  • Newborn Screening, NCP Checklist (Unang Yakap)




  • Document generation — eSOA, Discharge Summary, Referral Letter, etc.




  • Multi-tenant: each facility is an isolated tenant with its own server and data scope




  • FHIR R4 resource layer: Patient, Encounter, Condition, Observation,




    ServiceRequest, DiagnosticReport, MedicationRequest, Claim, Coverage,




    Practitioner, Organization, CarePlan, AuditEvent




TWO PRIMARY ANALYTICS TENANT TYPES:




TYPE A — Level 3 Hospital (e.g., city hospital, district hospital, tertiary




private hospital) using ALL modules including inpatient, surgical, PhilHealth




claims, laboratory, billing, and population health.




TYPE B — City / Municipal Health Center (LGU) with jurisdiction over:




  • Barangay Health Centers (BHC)




  • Rural Health Units (RHU)




  • Municipal Health Units (MHU)




  • Lying-in clinics under LGU




  Primary workflows: Konsulta, maternal care, immunization, TB-DOTS,




  NCD screening (DM, HTN), child health, referral to hospital level.




  Claims: PhilHealth Konsulta eKAS, NCP, NHSSS (dialysis referrals).




ANALYTICS USERS (role-based data visibility):




  Hospital Level:




    • Hospital Administrator / CEO




    • Medical Director / Chief of Hospital




    • Billing / Revenue Cycle Manager




    • Department Head (Medicine, Surgery, OB, Peds, etc.)




    • PhilHealth Claims Officer




    • Quality / Patient Safety Officer




    • Laboratory Head




    • Nurse Manager / Head Nurse




    • Attending Physician (own patients only)




  LGU / City Health Center Level:




    • City Health Officer (CHO)




    • Municipal Health Officer (MHO)




    • Public Health Nurse (PHN) — by barangay




    • Epidemiology & Surveillance Officer




    • TB Coordinator




    • Immunization Coordinator




    • Maternal Health Coordinator




    • Nutrition Officer




    • Administrative / Finance Officer




DESIGN SYSTEM (must be retained throughout):




  Primary color:         #4454C3 (SugboDoc brand blue)




  Success / positive:   #1A7A3C (green)




  Warning / alert:      #E67E22 (amber)




  Danger / critical:    #C0392B (red)




  PhilHealth reference: #1A5CA8 (blue)




  Text primary:         #111111




  Text secondary:       #333333




  Text muted:           #666666




  Background:           #F8F9FA




  Card background:      #FFFFFF




  Border:               #E8E8E8




  Chart library:        Recharts (already in project)




  Table components:     existing SugboDoc data table (sticky headers,




                        compact density, row actions)




  Interaction pattern:  drawer/off-canvas for detail drill-down — never




                        navigate away from dashboard context




  All charts must be:   responsive, accessible (ARIA labels), with




                        loading skeletons on data fetch




  Empty states:         action-forward, not blank screens




SCOPE NOTE:




  All analytics are UI scaffolding with realistic mock data unless otherwise




  stated. No live backend wiring required. Use FHIR R4 resource shapes as




  the data model for all mock data objects. All monetary values in PHP.




  All date filters default to current month with comparison to prior month.




  Drill-down always opens a side drawer — never a new page.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sugbo-insight-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/684bed2e-1f7b-451f-97a8-2377d968b30a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
