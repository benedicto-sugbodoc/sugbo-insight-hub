import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SugboDoc — Hospital Operations & Analytics" },
      {
        name: "description",
        content:
          "SugboDoc: multi-tenant Philippine healthcare platform for hospital operations, PhilHealth claims and clinical analytics.",
      },
      { name: "author", content: "SugboDoc" },
      { property: "og:title", content: "SugboDoc — Hospital Operations & Analytics" },
      {
        property: "og:description",
        content:
          "Hospital operations, PhilHealth claims and clinical analytics for Philippine facilities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],

    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const primaryNav = [
  { label: "Dashboard", to: "/" as const },
  { label: "Patients", to: null },
  { label: "Encounters", to: null },
  { label: "Billing", to: null },
  { label: "Claims", to: null },
  { label: "Laboratory", to: null },
  { label: "Settings", to: null },
  { label: "Analytics", to: "/analytics" as const },
];

function AppNav() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-2">
        <span className="text-sm font-semibold tracking-tight text-brand">SugboDoc</span>
        <nav className="flex flex-wrap items-center gap-1">
          {primaryNav.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-md px-2.5 py-1.5 text-sm text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
                activeProps={{
                  className: "rounded-md px-2.5 py-1.5 text-sm font-medium text-brand bg-brand/10",
                }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                className="cursor-not-allowed rounded-md px-2.5 py-1.5 text-sm text-text-muted/70"
                title="Module not part of this analytics scaffold"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}

/** Sections that ship their own sub-nav (with a way back to Dashboard built in) —
 *  showing the global AppNav above it as well is redundant, so it's hidden here. */
function hasOwnSubNav(pathname: string): boolean {
  return pathname.startsWith("/analytics") || pathname.startsWith("/lgu/analytics");
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <QueryClientProvider client={queryClient}>
      {!hasOwnSubNav(pathname) ? <AppNav /> : null}
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
