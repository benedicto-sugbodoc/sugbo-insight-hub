import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lgu/analytics/")({
  beforeLoad: () => {
    throw redirect({ to: "/lgu/analytics/executive" });
  },
});
