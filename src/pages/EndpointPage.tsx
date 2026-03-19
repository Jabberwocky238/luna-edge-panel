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
    <div className="grid gap-5">
      <section className="rounded-[32px] border border-black/10 bg-[linear-gradient(135deg,rgba(250,239,219,0.98),rgba(250,248,242,0.88))] p-7 shadow-[0_18px_60px_rgba(17,24,39,0.08)]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-dark)]">Luna Edge / Endpoint</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-6xl">域名与转发表</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--color-muted)]">
            只保留域名和转发表。读取当前配置会直接回填列表，点击确定后端自动 build 并 apply。
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white/75 p-5 shadow-[0_18px_60px_rgba(17,24,39,0.08)] backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid gap-2">
            <span className="text-sm text-[var(--color-muted)]">Hostname</span>
            <input
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="app.example.com"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row lg:self-end">
            <button
              type="button"
              onClick={handleQuery}
              className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[var(--color-ink)]"
            >
              读取当前配置
            </button>
            <button
              className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white"
              type="button"
              onClick={handleApply}
            >
              确定
            </button>
          </div>
        </div>
      </section>

      <RouteListEditor routes={routes} onChange={setRoutes} />

      {error ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-[0_18px_60px_rgba(17,24,39,0.08)]">
          {error}
        </section>
      ) : null}
      {status ? (
        <section className="rounded-[28px] border border-black/10 bg-white/75 p-5 text-sm text-[var(--color-ink)] shadow-[0_18px_60px_rgba(17,24,39,0.08)]">
          {status}
        </section>
      ) : null}

      <section className="flex justify-end">
        <button
          className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white"
          type="button"
          onClick={handleApply}
        >
          确定
        </button>
      </section>
    </div>
  );
}
