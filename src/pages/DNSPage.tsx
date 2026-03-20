import { useState } from "react";
import { postJSON } from "../api";

const DNS_RECORD_TYPE_SUGGESTIONS = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "NS",
  "SOA",
  "SRV",
  "TXT",
] as const;

type DNSRecord = {
  id: string;
  fqdn: string;
  record_type: string;
  routing_class: string;
  ttl_seconds: number;
  values_json: string;
  routing_key: string;
  enabled: boolean;
};

type DNSValueDraft = {
  id: string;
  value: string;
};

type DNSRecordDraft = {
  id: string;
  existingRecordID?: string;
  fqdn: string;
  recordType: string;
  routingClass: string;
  routingKey: string;
  ttlSeconds: number;
  enabled: boolean;
  values: DNSValueDraft[];
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

function normalizeRecordType(value: string): string {
  return value.trim().toUpperCase();
}

function toDraft(record?: DNSRecord, hostname?: string): DNSRecordDraft {
  if (!record) {
    return {
      id: `dns-record-${Date.now()}`,
      fqdn: hostname?.trim() || "",
      recordType: "A",
      routingClass: "first",
      routingKey: "",
      ttlSeconds: 60,
      enabled: true,
      values: [{ id: "dns-value-1", value: "" }]
    };
  }

  return {
    id: `dns-record-${record.id}`,
    existingRecordID: record.id,
    fqdn: record.fqdn,
    recordType: record.record_type,
    routingClass: record.routing_class,
    routingKey: record.routing_key,
    ttlSeconds: record.ttl_seconds,
    enabled: record.enabled,
    values: parseValues(record.values_json)
  };
}

export function DNSPage() {
  const [hostname, setHostname] = useState("");
  const [records, setRecords] = useState<DNSRecordDraft[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  function validateHostname(): string | null {
    return hostname.trim() ? null : "hostname is required";
  }

  function validateRecords(): string | null {
    if (records.length === 0) {
      return "at least one dns record is required";
    }
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (!record.fqdn.trim()) {
        return `record #${index + 1}: fqdn is required`;
      }
      if (!record.recordType.trim()) {
        return `record #${index + 1}: record type is required`;
      }
      if (!Number.isFinite(record.ttlSeconds) || record.ttlSeconds <= 0) {
        return `record #${index + 1}: ttl must be greater than 0`;
      }
      const values = record.values.map((item) => item.value.trim()).filter(Boolean);
      if (values.length === 0) {
        return `record #${index + 1}: at least one value is required`;
      }
    }
    return null;
  }

  async function handleQuery() {
    setError("");
    setStatus("");
    const hostnameError = validateHostname();
    if (hostnameError) {
      setError(hostnameError);
      return;
    }
    try {
      const result = await postJSON<DNSRecord[]>("/api/query/dns", { hostname: hostname.trim() });
      setRecords(result.map((record) => toDraft(record)));
      setStatus("已读取当前 DNS 条目。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleConfirm() {
    setError("");
    setStatus("");
    const hostnameError = validateHostname();
    if (hostnameError) {
      setError(hostnameError);
      return;
    }
    const recordsError = validateRecords();
    if (recordsError) {
      setError(recordsError);
      return;
    }
    try {
      await postJSON("/api/dns/apply", {
        hostname: hostname.trim(),
        records: records.map((record) => ({
          existingRecordId: record.existingRecordID ?? "",
          fqdn: record.fqdn.trim(),
          recordType: normalizeRecordType(record.recordType),
          routingClass: record.routingClass,
          routingKey: record.routingKey.trim(),
          ttlSeconds: record.ttlSeconds,
          enabled: record.enabled,
          values: record.values.map((item) => item.value.trim()).filter(Boolean)
        }))
      });
      setStatus("已提交。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function addRecord() {
    setRecords((current) => [...current, toDraft(undefined, hostname)]);
  }

  function removeRecord(id: string) {
    setRecords((current) => current.filter((record) => record.id !== id));
  }

  function updateRecord(id: string, patch: Partial<DNSRecordDraft>) {
    setRecords((current) => current.map((record) => (record.id === id ? { ...record, ...patch } : record)));
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

  function updateValue(recordID: string, valueID: string, value: string) {
    setRecords((current) =>
      current.map((record) =>
        record.id === recordID
          ? { ...record, values: record.values.map((item) => (item.id === valueID ? { ...item, value } : item)) }
          : record
      )
    );
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[32px] border border-black/10 bg-[linear-gradient(135deg,rgba(250,239,219,0.98),rgba(250,248,242,0.88))] p-7 shadow-[0_18px_60px_rgba(17,24,39,0.08)]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-dark)]">Luna Edge / DNS</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-6xl">当前域名的 DNS 条目</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--color-muted)]">
            读取当前域名的 DNS 条目，直接修改已有记录，或者新增新的条目后统一提交。
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
          </div>
        </div>
      </section>

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

      <section className="rounded-[28px] border border-black/10 bg-white/75 p-5 shadow-[0_18px_60px_rgba(17,24,39,0.08)] backdrop-blur">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-dark)]">Current</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">当前域名条目</h3>
          </div>
          <button
            type="button"
            onClick={addRecord}
            className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white"
          >
            新增记录
          </button>
        </div>

        <div className="grid gap-4">
          {records.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/10 bg-white/50 p-6 text-sm text-[var(--color-muted)]">
              还没有查询结果，或者当前域名下没有条目。你也可以直接新增记录。
            </div>
          ) : (
            records.map((record, index) => (
              <article key={record.id} className="grid gap-4 rounded-3xl border border-black/10 bg-white/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-dark)]">Record #{index + 1}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{record.fqdn || "未填写 FQDN"}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRecord(record.id)}
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                  >
                    删除记录
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <label className="grid gap-2">
                    <span className="text-sm text-[var(--color-muted)]">FQDN</span>
                    <input
                      value={record.fqdn}
                      onChange={(e) => updateRecord(record.id, { fqdn: e.target.value })}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-[var(--color-muted)]">Record Type</span>
                    <input
                      value={record.recordType}
                      onChange={(e) => updateRecord(record.id, { recordType: normalizeRecordType(e.target.value) })}
                      list="dns-record-type-suggestions"
                      placeholder="A / AAAA / CNAME / TXT / ..."
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-[var(--color-muted)]">TTL</span>
                    <input
                      type="number"
                      value={record.ttlSeconds}
                      onChange={(e) => updateRecord(record.id, { ttlSeconds: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      checked={record.enabled}
                      onChange={(e) => updateRecord(record.id, { enabled: e.target.checked })}
                    />
                    <span className="text-sm text-[var(--color-ink)]">enabled</span>
                  </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-dark)]">Values</p>
                    <h3 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">记录值</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => addValue(record.id)}
                    className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[var(--color-ink)]"
                  >
                    增加值
                  </button>
                </div>

                <div className="grid gap-3">
                  {record.values.map((item, valueIndex) => (
                    <div key={item.id} className="grid gap-3 rounded-3xl border border-black/10 bg-white/70 p-4 md:grid-cols-[minmax(0,1fr)_120px]">
                      <label className="grid gap-2">
                        <span className="text-sm text-[var(--color-muted)]">Value</span>
                        <input
                          value={item.value}
                          onChange={(e) => updateValue(record.id, item.id, e.target.value)}
                          placeholder={record.recordType === "CNAME" ? "ns1.app238.com" : "1.2.3.4"}
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none"
                        />
                      </label>
                      <div className="grid gap-2 self-end">
                        <span className="text-xs text-[var(--color-muted)]">#{valueIndex + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeValue(record.id, item.id)}
                          disabled={record.values.length === 1}
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm disabled:opacity-50"
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

      <datalist id="dns-record-type-suggestions">
        {DNS_RECORD_TYPE_SUGGESTIONS.map((recordType) => (
          <option key={recordType} value={recordType} />
        ))}
      </datalist>

      <section className="flex justify-end">
        <button
          className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white"
          type="button"
          onClick={handleConfirm}
        >
          确定
        </button>
      </section>
    </div>
  );
}
