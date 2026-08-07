import { createFileRoute, redirect } from "@tanstack/react-router";

// The old standalone "Medical Director" landing page duplicated the
// Executive Analytics dashboard almost exactly, so the app no longer
// ships a separate homepage — "/" forwards straight into Analytics.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/analytics/executive" });
  },
});
