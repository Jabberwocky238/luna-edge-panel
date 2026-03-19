import { useMemo, useState } from "react";
import { formatJSON, postJSON } from "../api";

type Projection = Record<string, unknown>;

type EndpointForm = {
  masterUrl: string;
  hostname: string;
  backendType: string;
  backendRefType: string;
  serviceNamespace: string;
  serviceName: string;
  externalEndpoint: string;
  servicePort: number;
  routeMode: string;
  routeRoot: boolean;
  routeApi: boolean;
  routeAdmin: boolean;
  customRoutes: string;
  enableDns: boolean;
  dnsRecordType: string;
  dnsRoutingClass: string;
  dnsTtlSeconds: number;
  dnsValuesJson: string;
  dnsRoutingKey: string;
};

const initialForm: EndpointForm = {
  masterUrl: "http://127.0.0.1:8080",
  hostname: "",
  backendType: "l7-http-both",
  backendRefType: "SVC",
  serviceNamespace: "luna-edge",
  serviceName: "nginx-gateway",
  externalEndpoint: "",
  servicePort: 80,
  routeMode: "multi",
  routeRoot: true,
  routeApi: false,
  routeAdmin: false,
  customRoutes: "",
  enableDns: false,
  dnsRecordType: "A",
  dnsRoutingClass: "first",
  dnsTtlSeconds: 60,
  dnsValuesJson: "[\"1.2.3.4\"]",
  dnsRoutingKey: ""
};

export function EndpointPage() {
  const [form, setForm] = useState(initialForm);
  const [projection, setProjection] = useState("");
  const [planPreview, setPlanPreview] = useState("");
  const [applyResult, setApplyResult] = useState("");
  const [error, setError] = useState("");

  const routes = useMemo(() => {
    const result: string[] = [];
    if (form.routeRoot) result.push("/");
    if (form.routeApi) result.push("/api");
    if (form.routeAdmin) result.push("/admin");
    const custom = form.customRoutes
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    for (const item of custom) {
      if (!result.includes(item)) {
        result.push(item);
      }
    }
    return form.routeMode === "single" ? result.slice(0, 1) : result;
  }, [form.customRoutes, form.routeAdmin, form.routeApi, form.routeMode, form.routeRoot]);

  const planPayload = {
    masterUrl: form.masterUrl,
    hostname: form.hostname,
    backendType: form.backendType,
    backendRefType: form.backendRefType,
    serviceNamespace: form.serviceNamespace,
    serviceName: form.serviceName,
    externalEndpoint: form.externalEndpoint,
    servicePort: Number(form.servicePort),
    enableDns: form.enableDns,
    dnsRecordType: form.dnsRecordType,
    dnsRoutingClass: form.dnsRoutingClass,
    dnsTtlSeconds: Number(form.dnsTtlSeconds),
    dnsValuesJson: form.dnsValuesJson,
    dnsRoutingKey: form.dnsRoutingKey,
    routes: routes.map((path) => ({ path }))
  };

  async function handleProjectionQuery() {
    setError("");
    try {
      const result = await postJSON<Projection>("/api/query/domain", {
        masterUrl: form.masterUrl,
        hostname: form.hostname
      });
      setProjection(formatJSON(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handlePlanPreview() {
    setError("");
    try {
      const result = await postJSON<Projection>("/api/plan/preview", planPayload);
      setPlanPreview(formatJSON(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleApply() {
    setError("");
    try {
      const result = await postJSON<Projection>("/api/plan/apply", planPayload);
      setApplyResult(formatJSON(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Endpoint Workspace</p>
          <h2>查询投影，再生成更完整的 Endpoint Plan</h2>
          <p className="lede">
            这个页面分开处理投影查询、后端接入、路由策略、DNS 同步和提交结果。先输入域名查当前 projection，再决定改什么。
          </p>
        </div>
      </section>

      <section className="panel sticky-top-panel">
        <div className="toolbar-grid endpoint-search">
          <label className="field">
            <span>Master URL</span>
            <input value={form.masterUrl} onChange={(e) => setForm({ ...form, masterUrl: e.target.value })} />
          </label>
          <label className="field">
            <span>Hostname</span>
            <input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="nginx-lnctl.cluster-1.app238.com" />
          </label>
          <div className="action-slot">
            <button className="primary" onClick={handleProjectionQuery}>
              查询 Endpoint
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Target</p>
            <h3>后端接入</h3>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Backend Type</span>
            <select value={form.backendType} onChange={(e) => setForm({ ...form, backendType: e.target.value })}>
              <option value="l7-http">l7-http</option>
              <option value="l7-https">l7-https</option>
              <option value="l7-http-both">l7-http-both</option>
            </select>
          </label>
          <label className="field">
            <span>Backend Ref Type</span>
            <select value={form.backendRefType} onChange={(e) => setForm({ ...form, backendRefType: e.target.value })}>
              <option value="SVC">SVC</option>
              <option value="EXTERNAL">EXTERNAL</option>
            </select>
          </label>
          <label className="field">
            <span>Service Port</span>
            <input type="number" value={form.servicePort} onChange={(e) => setForm({ ...form, servicePort: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>Service Namespace</span>
            <input value={form.serviceNamespace} onChange={(e) => setForm({ ...form, serviceNamespace: e.target.value })} />
          </label>
          <label className="field">
            <span>Service Name</span>
            <input value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} />
          </label>
          <label className="field">
            <span>External Endpoint</span>
            <input value={form.externalEndpoint} onChange={(e) => setForm({ ...form, externalEndpoint: e.target.value })} placeholder="nginx-ingress.cluster-1.app238.com" />
          </label>
        </div>
      </section>

      <section className="panel split-panel">
        <div>
          <div className="panel-head">
            <div>
              <p className="section-kicker">Routing</p>
              <h3>路由策略</h3>
            </div>
          </div>
          <div className="form-grid compact">
            <label className="field">
              <span>Route Mode</span>
              <select value={form.routeMode} onChange={(e) => setForm({ ...form, routeMode: e.target.value })}>
                <option value="single">single primary route</option>
                <option value="multi">multi route set</option>
              </select>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={form.routeRoot} onChange={(e) => setForm({ ...form, routeRoot: e.target.checked })} />
              <span>Include `/`</span>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={form.routeApi} onChange={(e) => setForm({ ...form, routeApi: e.target.checked })} />
              <span>Include `/api`</span>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={form.routeAdmin} onChange={(e) => setForm({ ...form, routeAdmin: e.target.checked })} />
              <span>Include `/admin`</span>
            </label>
          </div>
          <label className="field">
            <span>Custom Routes</span>
            <textarea value={form.customRoutes} onChange={(e) => setForm({ ...form, customRoutes: e.target.value })} rows={5} placeholder={"/internal\n/status"} />
          </label>
        </div>

        <div className="route-summary">
          <p className="section-kicker">Resolved Routes</p>
          <h3>最终将写入的路径</h3>
          <div className="chip-wrap">
            {routes.length === 0 ? <span className="empty-state">没有 route，plan 会失败。</span> : routes.map((route) => <span key={route} className="chip">{route}</span>)}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="section-kicker">DNS Sync</p>
            <h3>DNS 联动配置</h3>
          </div>
        </div>

        <div className="toolbar-grid dns-sync-grid">
          <label className="toggle-card">
            <input type="checkbox" checked={form.enableDns} onChange={(e) => setForm({ ...form, enableDns: e.target.checked })} />
            <span>提交 plan 时同步写 DNS</span>
          </label>
          <label className="field">
            <span>Record Type</span>
            <select value={form.dnsRecordType} onChange={(e) => setForm({ ...form, dnsRecordType: e.target.value })}>
              <option value="A">A</option>
              <option value="AAAA">AAAA</option>
              <option value="CNAME">CNAME</option>
            </select>
          </label>
          <label className="field">
            <span>Routing Class</span>
            <select value={form.dnsRoutingClass} onChange={(e) => setForm({ ...form, dnsRoutingClass: e.target.value })}>
              <option value="first">first</option>
              <option value="geo">geo</option>
              <option value="lb">lb</option>
            </select>
          </label>
          <label className="field">
            <span>TTL</span>
            <input type="number" value={form.dnsTtlSeconds} onChange={(e) => setForm({ ...form, dnsTtlSeconds: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>Routing Key</span>
            <input value={form.dnsRoutingKey} onChange={(e) => setForm({ ...form, dnsRoutingKey: e.target.value })} />
          </label>
        </div>

        <label className="field">
          <span>Values JSON</span>
          <textarea value={form.dnsValuesJson} onChange={(e) => setForm({ ...form, dnsValuesJson: e.target.value })} rows={4} />
        </label>
      </section>

      <section className="panel action-bar">
        <button onClick={handlePlanPreview}>预览 Plan</button>
        <button className="primary" onClick={handleApply}>
          提交 Plan
        </button>
      </section>

      {error ? <section className="panel error">{error}</section> : null}

      <section className="panel result">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Projection</p>
            <h3>当前 Endpoint 投影</h3>
          </div>
        </div>
        <pre>{projection || "尚未查询。"}</pre>
      </section>

      <section className="panel result">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Preview</p>
            <h3>Plan 预览</h3>
          </div>
        </div>
        <pre>{planPreview || "尚未预览。"}</pre>
      </section>

      <section className="panel result">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Apply</p>
            <h3>提交结果</h3>
          </div>
        </div>
        <pre>{applyResult || "尚未提交。"}</pre>
      </section>
    </div>
  );
}
