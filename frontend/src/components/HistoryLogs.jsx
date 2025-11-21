import { useEffect, useMemo, useState, useCallback } from "react";

const API = process.env.REACT_APP_BACKEND_PORT || "http://localhost:5000";

function fmt(v, f = "-") {
  return v == null || v === "" ? f : String(v);
}
function tsToLocal(isoOrEpoch) {
  if (!isoOrEpoch) return "-";
  if (typeof isoOrEpoch === "number") return new Date(isoOrEpoch * 1000).toLocaleString();
  return new Date(isoOrEpoch).toLocaleString();
}

export default function HistoryLogs() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Filters
  const [filters, setFilters] = useState({
    from_ts: "",
    to_ts: "",
    action: "",
    emp_id: "",
    resource_type: "",
    resource_id: "",
    serial_no: "",
    qr_id: "",
    result: "", // success | failure
  });

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.from_ts) p.set("from_ts", String(Math.floor(new Date(filters.from_ts).getTime()/1000)));
    if (filters.to_ts) p.set("to_ts", String(Math.floor(new Date(filters.to_ts).getTime()/1000)));
    if (filters.action) p.set("action", filters.action);
    if (filters.emp_id) p.set("emp_id", filters.emp_id);
    if (filters.resource_type) p.set("resource_type", filters.resource_type);
    if (filters.resource_id) p.set("resource_id", filters.resource_id);
    if (filters.serial_no) p.set("serial_no", filters.serial_no);
    if (filters.qr_id) p.set("qr_id", filters.qr_id);
    if (filters.result) p.set("result", filters.result);
    p.set("page", String(page));
    p.set("size", String(size));
    return p.toString();
  }, [filters, page, size]);

  const fetchLogs = useCallback(async (signal) => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${API}/api/audit?${qs}`, { credentials: "include", signal });
      if (!res.ok) throw new Error("load");
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number.isFinite(data.total) ? data.total : 0);
    } catch (e) {
      if (e.name !== "AbortError") setErr("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchLogs(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">History Logs</h2>
          <div className="text-sm text-gray-600">{total} total</div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
          <input type="date" className="border rounded px-3 py-2" value={filters.from_ts}
            onChange={(e) => { setPage(1); setFilters(f => ({...f, from_ts: e.target.value})); }} />
          <input type="date" className="border rounded px-3 py-2" value={filters.to_ts}
            onChange={(e) => { setPage(1); setFilters(f => ({...f, to_ts: e.target.value})); }} />
          <input className="border rounded px-3 py-2" placeholder="Action (e.g., asset.update)"
            value={filters.action} onChange={(e)=>{ setPage(1); setFilters(f=>({...f, action: e.target.value})); }} />
          <input className="border rounded px-3 py-2" placeholder="Actor emp_id"
            value={filters.emp_id} onChange={(e)=>{ setPage(1); setFilters(f=>({...f, emp_id: e.target.value})); }} />
          <select className="border rounded px-3 py-2" value={filters.result}
            onChange={(e)=>{ setPage(1); setFilters(f=>({...f, result: e.target.value})); }}>
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
          <select className="border rounded px-3 py-2" value={filters.resource_type}
            onChange={(e)=>{ setPage(1); setFilters(f=>({...f, resource_type: e.target.value})); }}>
            <option value="">Any resource</option>
            <option value="Asset">Asset</option>
            <option value="QR">QR</option>
            <option value="User">User</option>
            <option value="Config">Config</option>
          </select>

          <input className="border rounded px-3 py-2" placeholder="Serial No"
            value={filters.serial_no} onChange={(e)=>{ setPage(1); setFilters(f=>({...f, serial_no: e.target.value})); }} />
          <input className="border rounded px-3 py-2" placeholder="QR ID"
            value={filters.qr_id} onChange={(e)=>{ setPage(1); setFilters(f=>({...f, qr_id: e.target.value})); }} />
          <input className="border rounded px-3 py-2 md:col-span-2" placeholder="Resource ID"
            value={filters.resource_id} onChange={(e)=>{ setPage(1); setFilters(f=>({...f, resource_id: e.target.value})); }} />
          <select className="border rounded px-3 py-2" value={size}
            onChange={(e)=>{ setPage(1); setSize(Number(e.target.value)); }}>
            {[10,25,50,100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button className="border rounded px-3 py-2"
            onClick={()=>{ setFilters({ from_ts:"", to_ts:"", action:"", emp_id:"", resource_type:"", resource_id:"", serial_no:"", qr_id:"", result:"" }); setPage(1); }}>
            Reset
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : err ? (
          <div className="text-red-600">{err}</div>
        ) : items.length === 0 ? (
          <div className="text-gray-600">No log entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e._id} className="border-b">
                    <td className="px-3 py-2 whitespace-nowrap">{tsToLocal(e.ts_iso || e.ts)}</td>
                    <td className="px-3 py-2">{fmt(e.actor?.emp_id)}</td>
                    <td className="px-3 py-2">{fmt(e.actor?.role)}</td>
                    <td className="px-3 py-2">{fmt(e.action)}</td>
                    <td className="px-3 py-2">
                      {fmt(e.resource?.type)}{" "}
                      {e.resource?.serial_no != null && `(S:${e.resource.serial_no})`}{" "}
                      {e.resource?.qr_id && `(QR:${e.resource.qr_id})`}
                    </td>
                    <td className="px-3 py-2">
                      {e.result?.ok ? <span className="text-emerald-700">Success</span> : <span className="text-rose-700">Failure</span>}
                      <DetailsButton entryId={e._id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pager */}
        <div className="flex items-center justify-end gap-2 mt-3">
          <button className="px-3 py-2 border rounded" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>Prev</button>
          <div className="text-sm">Page {page} / {totalPages}</div>
          <button className="px-3 py-2 border rounded" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}>Next</button>
        </div>
      </div>
    </div>
  );
}

function DetailsButton({ entryId }) {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/audit/${entryId}`, { credentials: "include" });
      if (r.ok) setEntry(await r.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="ml-2 px-2 py-1 text-xs border rounded hover:bg-gray-50"
        onClick={() => { setOpen(true); if (!entry) load(); }}
      >
        Details
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow max-w-3xl w-full">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <div className="font-semibold">Log details</div>
              <button className="text-gray-600" onClick={()=>setOpen(false)}>✕</button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto text-xs">
              {loading ? "Loading…" : (
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(entry, null, 2)}</pre>
              )}
            </div>
            <div className="px-4 py-2 border-t flex justify-end">
              <button className="px-3 py-1.5 border rounded hover:bg-gray-50" onClick={()=>setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
