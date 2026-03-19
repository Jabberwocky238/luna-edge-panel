import type { ReactNode } from "react";
import { useState } from "react";

type JsonValue = Record<string, unknown> | unknown[] | null;

type PlanForm = {
  masterUrl: string;
  hostname: string;
  backendType: string;
  backendRefType: string;
  serviceNamespace: string;
  serviceName: string;
  externalEndpoint: string;
  servicePort: number;
  enableDns: boolean;
  dnsRecordType: string;
  dnsRoutingClass: string;
  dnsTtlSeconds: number;
  dnsValuesJson: string;
  dnsRoutingKey: string;
  routesText: string;
};

const initialForm: PlanForm = {
  masterUrl: "http://127.0.0.1:8080",
  hostname: "",
  backendType: "l7-http-both",
  backendRefType: "SVC",
  serviceNamespace: "default",
  serviceName: "",
  externalEndpoint: "",
  servicePort: 80,
  enableDns: false,
  dnsRecordType: "A",
  dnsRoutingClass: "first",
  dnsTtlSeconds: 60,
  dnsValuesJson: "[\"1.2.3.4\"]",
  dnsRoutingKey: "",
  routesText: "/"
};

async function postJSON<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(body.error || "request failed");
  }
  return body;
}

function formatJSON(value: JsonValue): string {
  return JSON.stringify(value, null, 2);
}

export function App() {
  const [form, setForm] = useState(initialForm);
  const [domainResult, setDomainResult] = useState("");
  const [dnsResult, setDNSResult] = useState("");
  const [planResult, setPlanResult] = useState("");
  const [applyResult, setApplyResult] = useState("");
  const [error, setError] = useState("");

  const routes = form.routesText
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => ({ path }));

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
    routes
  };

  async function run<T>(action: () => Promise<T>, setter: (value: string) => void) {
    setError("");
    try {
      const result = await action();
      setter(formatJSON(result as JsonValue));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Luna Edge / lnctl</p>
        <h1>轻量控制面板</h1>
        <p className="lede">当前页直接驱动 Go 后端，后端再调用 lnctl 查询和提交到 Luna Edge master。</p>
      </section>

      <section className="panel">
        <div className="grid two">
          <Field label="Master URL">
            <input value={form.masterUrl} onChange={(e) => setForm({ ...form, masterUrl: e.target.value })} />
          </Field>
          <Field label="Hostname">
            <input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="app.example.com" />
          </Field>
        </div>
        <div className="actions">
          <button
            onClick={() =>
              run(() => postJSON("/api/query/domain", { masterUrl: form.masterUrl, hostname: form.hostname }), setDomainResult)
            }
          >
            查询域名投影
          </button>
          <button
            onClick={() =>
              run(
                () => postJSON("/api/query/dns", { masterUrl: form.masterUrl, hostname: form.hostname, recordType: form.dnsRecordType }),
                setDNSResult
              )
            }
          >
            查询 DNS
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>创建 / 更新 L7 Plan</h2>
        <div className="grid three">
          <Field label="Backend Type">
            <select value={form.backendType} onChange={(e) => setForm({ ...form, backendType: e.target.value })}>
              <option value="l7-http">l7-http</option>
              <option value="l7-https">l7-https</option>
              <option value="l7-http-both">l7-http-both</option>
            </select>
          </Field>
          <Field label="Backend Ref Type">
            <select value={form.backendRefType} onChange={(e) => setForm({ ...form, backendRefType: e.target.value })}>
              <option value="SVC">SVC</option>
              <option value="EXTERNAL">EXTERNAL</option>
            </select>
          </Field>
          <Field label="Service Port">
            <input type="number" value={form.servicePort} onChange={(e) => setForm({ ...form, servicePort: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="grid two">
          <Field label="Service Namespace">
            <input value={form.serviceNamespace} onChange={(e) => setForm({ ...form, serviceNamespace: e.target.value })} />
          </Field>
          <Field label="Service Name">
            <input value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} />
          </Field>
        </div>
        <div className="grid one">
          <Field label="External Endpoint">
            <input
              value={form.externalEndpoint}
              onChange={(e) => setForm({ ...form, externalEndpoint: e.target.value })}
              placeholder="api.example.net"
            />
          </Field>
        </div>
        <div className="grid one">
          <Field label="Routes">
            <textarea value={form.routesText} onChange={(e) => setForm({ ...form, routesText: e.target.value })} rows={3} />
          </Field>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={form.enableDns} onChange={(e) => setForm({ ...form, enableDns: e.target.checked })} />
          <span>同时写入 DNS 记录</span>
        </label>
        <div className="grid four">
          <Field label="Record Type">
            <select value={form.dnsRecordType} onChange={(e) => setForm({ ...form, dnsRecordType: e.target.value })}>
              <option value="A">A</option>
              <option value="AAAA">AAAA</option>
              <option value="CNAME">CNAME</option>
            </select>
          </Field>
          <Field label="Routing Class">
            <select value={form.dnsRoutingClass} onChange={(e) => setForm({ ...form, dnsRoutingClass: e.target.value })}>
              <option value="first">first</option>
              <option value="geo">geo</option>
              <option value="lb">lb</option>
            </select>
          </Field>
          <Field label="TTL">
            <input type="number" value={form.dnsTtlSeconds} onChange={(e) => setForm({ ...form, dnsTtlSeconds: Number(e.target.value) })} />
          </Field>
          <Field label="Routing Key">
            <input value={form.dnsRoutingKey} onChange={(e) => setForm({ ...form, dnsRoutingKey: e.target.value })} />
          </Field>
        </div>
        <div className="grid one">
          <Field label="Values JSON">
            <textarea value={form.dnsValuesJson} onChange={(e) => setForm({ ...form, dnsValuesJson: e.target.value })} rows={3} />
          </Field>
        </div>
        <div className="actions">
          <button onClick={() => run(() => postJSON("/api/plan/preview", planPayload), setPlanResult)}>预览 Plan</button>
          <button className="primary" onClick={() => run(() => postJSON("/api/plan/apply", planPayload), setApplyResult)}>
            提交 Plan
          </button>
        </div>
      </section>

      {error ? <section className="panel error">{error}</section> : null}
      <Result title="Domain Projection" body={domainResult} />
      <Result title="DNS Records" body={dnsResult} />
      <Result title="Plan Preview" body={planResult} />
      <Result title="Apply Result" body={applyResult} />
    </main>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label>
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

function Result(props: { title: string; body: string }) {
  if (!props.body) {
    return null;
  }
  return (
    <section className="panel result">
      <h2>{props.title}</h2>
      <pre>{props.body}</pre>
    </section>
  );
}
