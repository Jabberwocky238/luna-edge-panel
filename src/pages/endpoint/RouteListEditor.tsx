import type { RouteDraft } from "./shared";

type RouteListEditorProps = {
  routes: RouteDraft[];
  onChange: (routes: RouteDraft[]) => void;
};

export function RouteListEditor({ routes, onChange }: RouteListEditorProps) {
  function updateRoute(id: string, patch: Partial<RouteDraft>) {
    onChange(routes.map((route) => (route.id === id ? { ...route, ...patch } : route)));
  }

  function addRoute() {
    onChange([...routes, { id: `route-${Date.now()}`, path: "", externalEndpoint: "", servicePort: 80 }]);
  }

  function removeRoute(id: string) {
    onChange(routes.length === 1 ? routes : routes.filter((route) => route.id !== id));
  }

  return (
    <section className="rounded-[28px] border border-black/10 bg-white/75 p-5 shadow-[0_18px_60px_rgba(17,24,39,0.08)] backdrop-blur">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-dark)]">Routing</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Path Prefix 到 Target</h3>
        </div>
        <button
          type="button"
          onClick={addRoute}
          className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white"
        >
          新增路由
        </button>
      </div>

      <div className="grid gap-3">
        {routes.map((route, index) => (
          <div
            key={route.id}
            className="grid gap-3 rounded-3xl border border-black/10 bg-white/70 p-4 md:grid-cols-[1.1fr_1.2fr_160px_120px]"
          >
            <label className="grid gap-2">
              <span className="text-sm text-[var(--color-muted)]">Path Prefix</span>
              <input
                value={route.path}
                onChange={(e) => updateRoute(route.id, { path: e.target.value })}
                placeholder={index === 0 ? "/" : "/api/v1"}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-[var(--color-muted)]">External Target</span>
              <input
                value={route.externalEndpoint}
                onChange={(e) => updateRoute(route.id, { externalEndpoint: e.target.value })}
                placeholder="upstream.example.net"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-[var(--color-muted)]">Port</span>
              <input
                type="number"
                value={route.servicePort}
                onChange={(e) => updateRoute(route.id, { servicePort: Number(e.target.value) })}
                placeholder="80"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
              />
            </label>
            <div className="grid gap-2 self-end">
              <span className="text-xs text-[var(--color-muted)]">#{index + 1}</span>
              <button
                type="button"
                onClick={() => removeRoute(route.id)}
                disabled={routes.length === 1}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm disabled:opacity-50"
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
