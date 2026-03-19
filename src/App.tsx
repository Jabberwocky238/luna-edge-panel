import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { DNSPage } from "./pages/DNSPage";
import { EndpointPage } from "./pages/EndpointPage";

export function App() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-5 rounded-[28px] border border-black/10 bg-white/70 p-3 shadow-[0_18px_60px_rgba(17,24,39,0.08)] backdrop-blur">
          <div className="flex flex-wrap gap-3">
            <NavLink
              to="/dns"
              className={({ isActive }) =>
                isActive
                  ? "inline-flex items-center justify-center rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white"
                  : "inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[var(--color-ink)]"
              }
            >
              DNS
            </NavLink>
            <NavLink
              to="/endpoint"
              className={({ isActive }) =>
                isActive
                  ? "inline-flex items-center justify-center rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white"
                  : "inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[var(--color-ink)]"
              }
            >
              Endpoint
            </NavLink>
          </div>
        </section>
        <Routes>
          <Route path="/" element={<Navigate to="/dns" replace />} />
          <Route path="/dns" element={<DNSPage />} />
          <Route path="/endpoint/*" element={<EndpointPage />} />
        </Routes>
      </main>
    </div>
  );
}
