export type Projection = Record<string, unknown>;

export type RouteDraft = {
  id: string;
  path: string;
  externalEndpoint: string;
  servicePort: number;
};

export type NormalizedRoute = {
  path: string;
  externalEndpoint: string;
  servicePort: number;
};

export type BuildDraft = {
  buildId: string;
  hostname: string;
  routes: NormalizedRoute[];
};

export const initialRoutes: RouteDraft[] = [
  { id: "route-root", path: "/", externalEndpoint: "", servicePort: 80 },
];

export function normalizeRoutes(items: RouteDraft[]): NormalizedRoute[] {
  const seen = new Set<string>();
  const routes: NormalizedRoute[] = [];

  for (const item of items) {
    const rawPath = item.path.trim();
    if (!rawPath) {
      continue;
    }

    const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      routes.push({
        path: normalized,
        externalEndpoint: item.externalEndpoint.trim(),
        servicePort: Number(item.servicePort)
      });
    }
  }

  return routes;
}

export function buildPlanPayload(hostname: string, routes: RouteDraft[]) {
  return {
    hostname: hostname.trim(),
    backendType: "l7-http-both",
    backendRefType: "EXTERNAL",
    routes: normalizeRoutes(routes).map((route) => ({
      path: route.path,
      externalEndpoint: route.externalEndpoint,
      servicePort: route.servicePort
    }))
  };
}

const buildStorageKey = "luna-edge-panel:endpoint-builds";

export function saveBuildDraft(draft: BuildDraft) {
  const builds = loadBuildDraftMap();
  builds[draft.buildId] = draft;
  window.localStorage.setItem(buildStorageKey, JSON.stringify(builds));
}

export function loadBuildDraft(buildId: string): BuildDraft | null {
  return loadBuildDraftMap()[buildId] ?? null;
}

function loadBuildDraftMap(): Record<string, BuildDraft> {
  try {
    const raw = window.localStorage.getItem(buildStorageKey);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, BuildDraft>;
  } catch {
    return {};
  }
}

export function projectionToRoutes(projection: Projection): RouteDraft[] {
  const candidates = [
    (projection as { http_routes?: unknown[] }).http_routes,
    (projection as { httpRoutes?: unknown[] }).httpRoutes,
    (projection as { HTTPRoutes?: unknown[] }).HTTPRoutes
  ].find(Array.isArray);

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return initialRoutes;
  }

  const routes = candidates
    .map((item, index) => {
      const route = item as {
        path?: string;
        Path?: string;
        backend_ref?: { arbitrary_endpoint?: string; port?: number };
        backendRef?: { arbitraryEndpoint?: string; port?: number };
        backend_ref_id?: string;
      };
      const backendRef = route.backend_ref ?? route.backendRef;
      const path = String(route.path ?? route.Path ?? "").trim();
      if (!path) {
        return null;
      }
      return {
        id: `route-${index + 1}`,
        path,
        externalEndpoint: String(backendRef?.arbitrary_endpoint ?? backendRef?.arbitraryEndpoint ?? ""),
        servicePort: Number(backendRef?.port ?? 80)
      } satisfies RouteDraft;
    })
    .filter(Boolean) as RouteDraft[];

  return routes.length === 0 ? initialRoutes : routes;
}
