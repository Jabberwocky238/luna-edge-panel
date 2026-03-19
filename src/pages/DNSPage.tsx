import { useMemo, useState } from "react";
import { formatJSON, postJSON } from "../api";

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

export function DNSPage() {
  const [masterUrl, setMasterUrl] = useState("http://127.0.0.1:8080");
  const [hostname, setHostname] = useState("");
  const [recordType, setRecordType] = useState("A");
  const [onlyEnabled, setOnlyEnabled] = useState(true);
  const [routingClassFilter, setRoutingClassFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [rawResult, setRawResult] = useState("");
  const [error, setError] = useState("");

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (onlyEnabled && !record.enabled) {
        return false;
      }
      if (routingClassFilter !== "all" && record.routing_class !== routingClassFilter) {
        return false;
      }
      if (!searchText.trim()) {
        return true;
      }
      const haystack = [record.id, record.fqdn, record.values_json, record.routing_key].join(" ").toLowerCase();
      return haystack.includes(searchText.trim().toLowerCase());
    });
  }, [onlyEnabled, records, routingClassFilter, searchText]);

  async function handleQuery() {
    setError("");
    try {
      const result = await postJSON<DNSRecord[]>("/api/query/dns", {
        masterUrl,
        hostname,
        recordType
      });
      setRecords(result);
      setRawResult(formatJSON(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">DNS Workspace</p>
          <h2>域名输入后直接返回相关 DNSRecord</h2>
          <p className="lede">
            这个页面只负责 DNS。顶部输入域名和记录类型，下面的结果区支持按 routing class、启用状态和自由文本继续过滤。
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar-grid dns-search">
          <label className="field">
            <span>Master URL</span>
            <input value={masterUrl} onChange={(e) => setMasterUrl(e.target.value)} />
          </label>
          <label className="field">
            <span>Hostname / FQDN</span>
            <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="app.example.com" />
          </label>
          <label className="field">
            <span>Record Type</span>
            <select value={recordType} onChange={(e) => setRecordType(e.target.value)}>
              <option value="A">A</option>
              <option value="AAAA">AAAA</option>
              <option value="CNAME">CNAME</option>
              <option value="TXT">TXT</option>
            </select>
          </label>
          <div className="action-slot">
            <button className="primary" onClick={handleQuery}>
              查询 DNS
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Filters</p>
            <h3>结果过滤</h3>
          </div>
          <p className="meta-copy">当前结果 {filteredRecords.length} / {records.length}</p>
        </div>

        <div className="toolbar-grid filters-grid">
          <label className="field">
            <span>Routing Class</span>
            <select value={routingClassFilter} onChange={(e) => setRoutingClassFilter(e.target.value)}>
              <option value="all">all</option>
              <option value="first">first</option>
              <option value="geo">geo</option>
              <option value="lb">lb</option>
            </select>
          </label>
          <label className="field">
            <span>Search</span>
            <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="id / value / routing key" />
          </label>
          <label className="toggle-card">
            <input type="checkbox" checked={onlyEnabled} onChange={(e) => setOnlyEnabled(e.target.checked)} />
            <span>只看 enabled</span>
          </label>
        </div>
      </section>

      {error ? <section className="panel error">{error}</section> : null}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Records</p>
            <h3>DNS Records</h3>
          </div>
        </div>

        <div className="record-list">
          {filteredRecords.length === 0 ? (
            <div className="empty-state">没有可展示的 DNSRecord。</div>
          ) : (
            filteredRecords.map((record) => (
              <article key={record.id} className="record-card">
                <div className="record-header">
                  <strong>{record.fqdn}</strong>
                  <span className="pill">{record.record_type}</span>
                </div>
                <div className="record-meta">
                  <span>ID: {record.id}</span>
                  <span>routing: {record.routing_class}</span>
                  <span>ttl: {record.ttl_seconds}</span>
                  <span>{record.enabled ? "enabled" : "disabled"}</span>
                </div>
                <pre>{record.values_json}</pre>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel result">
        <div className="panel-head">
          <div>
            <p className="section-kicker">Raw</p>
            <h3>原始响应</h3>
          </div>
        </div>
        <pre>{rawResult || "尚未查询。"}</pre>
      </section>
    </div>
  );
}
