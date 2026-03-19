import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { postJSON } from "../api";
import { RouteListEditor } from "./endpoint/RouteListEditor";
import {
  buildPlanPayload,
  initialRoutes,
  loadBuildDraft,
  normalizeRoutes,
  projectionToRoutes,
  saveBuildDraft,
  type Projection,
  type RouteDraft
} from "./endpoint/shared";

export function EndpointPage() {
  const [searchParams] = useSearchParams();
  const buildId = searchParams.get("build")?.trim() || "default";
  const [hostname, setHostname] = useState("");
  const [routes, setRoutes] = useState<RouteDraft[]>(initialRoutes);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const normalizedRoutes = useMemo(() => normalizeRoutes(routes), [routes]);

  useEffect(() => {
    const draft = loadBuildDraft(buildId);
    if (!draft) {
      setHostname("");
      setRoutes(initialRoutes);
      return;
    }
    setHostname(draft.hostname);
    setRoutes(
      draft.routes.length === 0
        ? initialRoutes
        : draft.routes.map((route, index) => ({
            id: `route-${index + 1}`,
            path: route.path,
            externalEndpoint: route.externalEndpoint,
            servicePort: route.servicePort
          }))
    );
  }, [buildId]);

  useEffect(() => {
    saveBuildDraft({
      buildId,
      hostname: hostname.trim(),
      routes: normalizedRoutes
    });
  }, [buildId, hostname, normalizedRoutes]);

  async function handleQuery() {
    setError("");
    setStatus("");
    try {
      const response = await postJSON<Projection>("/api/query/domain", {
        hostname: hostname.trim()
      });
      setRoutes(projectionToRoutes(response));
      setStatus("已按当前域名回填转发表。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleApply() {
    setError("");
    setStatus("");
    try {
      await postJSON("/api/plan/apply", buildPlanPayload(hostname, routes));
      setStatus("已提交。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Endpoint Workspace</p>
          <h2>域名与转发表</h2>
          <p className="lede">前端只暴露域名和域名对应的转发表。点击“确定”后端自动 build 并 apply。</p>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar-grid endpoint-build-head">
          <label className="field">
            <span>Hostname</span>
            <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="app.example.com" />
          </label>
          <div className="action-bar">
            <button type="button" onClick={handleQuery}>
              读取当前配置
            </button>
            <button className="primary" type="button" onClick={handleApply}>
              确定
            </button>
          </div>
        </div>
      </section>

      <RouteListEditor routes={routes} onChange={setRoutes} />

      {error ? <section className="panel error">{error}</section> : null}
      {status ? <section className="panel">{status}</section> : null}

      <section className="panel action-bar">
        <button className="primary" type="button" onClick={handleApply}>
          确定
        </button>
      </section>
    </div>
  );
}
