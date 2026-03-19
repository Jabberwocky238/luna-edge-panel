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
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="section-kicker">Routing</p>
          <h3>Path Prefix 到 Target</h3>
        </div>
        <button type="button" onClick={addRoute}>
          新增路由
        </button>
      </div>

      <div className="route-list-editor">
        {routes.map((route, index) => (
          <div key={route.id} className="route-row">
            <label className="field">
              <span>Path Prefix</span>
              <input
                value={route.path}
                onChange={(e) => updateRoute(route.id, { path: e.target.value })}
                placeholder={index === 0 ? "/" : "/api/v1"}
              />
            </label>
            <label className="field">
              <span>External Target</span>
              <input
                value={route.externalEndpoint}
                onChange={(e) => updateRoute(route.id, { externalEndpoint: e.target.value })}
                placeholder="upstream.example.net"
              />
            </label>
            <label className="field">
              <span>Port</span>
              <input
                type="number"
                value={route.servicePort}
                onChange={(e) => updateRoute(route.id, { servicePort: Number(e.target.value) })}
                placeholder="80"
              />
            </label>
            <div className="row-actions">
              <span className="row-index">#{index + 1}</span>
              <button type="button" onClick={() => removeRoute(route.id)} disabled={routes.length === 1}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
