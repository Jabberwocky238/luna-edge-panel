import { useState } from "react";
import { postJSON } from "../api";

type DNSRecord = {
  id: string;
  fqdn: string;
  record_type: string;
  routing_class: string;
  ttl_seconds: number;
  values_json: string;
  routing_key: string;
  enabled: boolean;
  deleted?: boolean;
};

type DNSValueDraft = {
  id: string;
  value: string;
};

type DNSRecordDraft = {
  id: string;
  fqdn: string;
  recordType: string;
  routingClass: string;
  ttlSeconds: number;
  routingKey: string;
  enabled: boolean;
  values: DNSValueDraft[];
  existingRecordID?: string;
};

function parseValues(valuesJSON: string): DNSValueDraft[] {
  try {
    const values = JSON.parse(valuesJSON) as string[];
    if (!Array.isArray(values) || values.length === 0) {
      return [{ id: "dns-value-1", value: "" }];
    }
    return values.map((value, index) => ({ id: `dns-value-${index + 1}`, value: String(value) }));
  } catch {
    return [{ id: "dns-value-1", value: "" }];
  }
}

function toDraft(record?: DNSRecord, hostname?: string, recordType = "A"): DNSRecordDraft {
  if (!record) {
    return {
      id: `dns-record-${Date.now()}`,
      fqdn: hostname?.trim() || "",
      recordType,
      routingClass: "first",
      ttlSeconds: 60,
      routingKey: "",
      enabled: true,
      values: [{ id: "dns-value-1", value: "" }]
    };
  }

  return {
    id: `dns-record-${record.id}`,
    fqdn: record.fqdn,
    recordType: record.record_type,
    routingClass: record.routing_class,
    ttlSeconds: record.ttl_seconds,
    routingKey: record.routing_key,
    enabled: record.enabled,
    values: parseValues(record.values_json),
    existingRecordID: record.id
  };
}

export function DNSPage() {
  const [hostname, setHostname] = useState("");
  const [records, setRecords] = useState<DNSRecordDraft[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function handleQuery() {
    setError("");
    setStatus("");
    try {
      const result = await postJSON<DNSRecord[]>("/api/query/dns", {
        hostname
      });
      setRecords(result.map((record) => toDraft(record)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function updateRecord(id: string, patch: Partial<DNSRecordDraft>) {
    setRecords((current) => current.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  }

  function addRecord() {
    setRecords((current) => [...current, toDraft(undefined, hostname)]);
  }

  function removeRecord(id: string) {
    setRecords((current) => current.filter((record) => record.id !== id));
  }

  function addValue(recordID: string) {
    setRecords((current) =>
      current.map((record) =>
        record.id === recordID
          ? { ...record, values: [...record.values, { id: `dns-value-${Date.now()}`, value: "" }] }
          : record
      )
    );
  }

  async function handleConfirm() {
    setError("");
    setStatus("");
    try {
      await postJSON("/api/dns/apply", {
        hostname: hostname.trim(),
        records: records.map((record) => ({
          existingRecordId: record.existingRecordID ?? "",
          fqdn: record.fqdn.trim(),
          recordType: record.recordType,
          routingClass: record.routingClass,
          ttlSeconds: record.ttlSeconds,
          routingKey: record.routingKey.trim(),
          enabled: record.enabled,
          values: record.values.map((item) => item.value.trim()).filter(Boolean)
        }))
      });
      setStatus("已提交。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function updateValue(recordID: string, valueID: string, value: string) {
    setRecords((current) =>
      current.map((record) =>
        record.id === recordID
          ? {
              ...record,
              values: record.values.map((item) => (item.id === valueID ? { ...item, value } : item))
            }
          : record
      )
    );
  }

  function removeValue(recordID: string, valueID: string) {
    setRecords((current) =>
      current.map((record) =>
        record.id === recordID
          ? {
              ...record,
              values: record.values.length === 1 ? record.values : record.values.filter((item) => item.id !== valueID)
            }
          : record
      )
    );
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">DNS Workspace</p>
          <h2>当前域名的 DNS 条目</h2>
          <p className="lede">先按域名查询，再直接在结果列表里修改已有条目，或者继续新增新的 DNS 条目。</p>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar-grid dns-search">
          <label className="field">
            <span>Hostname / FQDN</span>
            <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="app.example.com" />
          </label>
          <div className="action-slot">
            <button className="primary" onClick={handleQuery}>
              查询 DNS
            </button>
          </div>
        </div>
      </section>

      {error ? <section className="panel error">{error}</section> : null}
      {status ? <section className="panel">{status}</section> : null}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Current</p>
            <h3>当前域名条目</h3>
          </div>
          <button type="button" onClick={addRecord}>
            新增记录
          </button>
        </div>

        <div className="dns-record-editor-list">
          {records.length === 0 ? (
            <div className="empty-state">还没有查询结果，或者当前域名下没有条目。你也可以直接新增记录。</div>
          ) : (
            records.map((record, index) => (
              <article key={record.id} className="dns-record-editor">
                <div className="panel-head">
                  <div>
                    <p className="section-kicker">Record #{index + 1}</p>
                    <h3>{record.fqdn || "未填写 FQDN"}</h3>
                  </div>
                  <button type="button" onClick={() => removeRecord(record.id)}>
                    删除记录
                  </button>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>FQDN</span>
                    <input value={record.fqdn} onChange={(e) => updateRecord(record.id, { fqdn: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Record Type</span>
                    <select value={record.recordType} onChange={(e) => updateRecord(record.id, { recordType: e.target.value })}>
                      <option value="A">A</option>
                      <option value="AAAA">AAAA</option>
                      <option value="CNAME">CNAME</option>
                      <option value="TXT">TXT</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>TTL</span>
                    <input
                      type="number"
                      value={record.ttlSeconds}
                      onChange={(e) => updateRecord(record.id, { ttlSeconds: Number(e.target.value) })}
                    />
                  </label>
                  <label className="toggle-card">
                    <input
                      type="checkbox"
                      checked={record.enabled}
                      onChange={(e) => updateRecord(record.id, { enabled: e.target.checked })}
                    />
                    <span>enabled</span>
                  </label>
                </div>

                <div className="panel-head">
                  <div>
                    <p className="section-kicker">Values</p>
                    <h3>记录值</h3>
                  </div>
                  <button type="button" onClick={() => addValue(record.id)}>
                    增加值
                  </button>
                </div>

                <div className="dns-value-list">
                  {record.values.map((item, valueIndex) => (
                    <div key={item.id} className="dns-value-row">
                      <label className="field">
                        <span>Value</span>
                        <input
                          value={item.value}
                          onChange={(e) => updateValue(record.id, item.id, e.target.value)}
                          placeholder={record.recordType === "CNAME" ? "ns1.app238.com" : "1.2.3.4"}
                        />
                      </label>
                      <div className="row-actions">
                        <span className="row-index">#{valueIndex + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeValue(record.id, item.id)}
                          disabled={record.values.length === 1}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel action-bar">
        <button className="primary" type="button" onClick={handleConfirm}>
          确定
        </button>
      </section>
    </div>
  );
}
