import { createFileRoute } from "@tanstack/react-router";
import { MedicalDirectorDashboard } from "@/components/analytics/dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SugboDoc Analytics — Executive Overview" },
      { name: "description", content: "Executive overview for the Medical Director of Cebu City Medical Center." },
      { property: "og:title", content: "SugboDoc Analytics — Executive Overview" },
      { property: "og:description", content: "Executive overview for the Medical Director of Cebu City Medical Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <MedicalDirectorDashboard />;
}
