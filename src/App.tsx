import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { DNSPage } from "./pages/DNSPage";
import { EndpointPage } from "./pages/EndpointPage";

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="eyebrow">Luna Edge / lnctl</p>
          <h1>Control Surface</h1>
          <p className="sidebar-copy">面向 DNS 记录与 Endpoint 投影的最小控制面。默认先看 DNS，再进入更重的 Endpoint 配置流程。</p>
        </div>

        <nav className="nav-stack">
          <NavLink to="/dns" className={({ isActive }) => (isActive ? "nav-card active" : "nav-card")}>
            <strong>DNS</strong>
            <span>按域名拉取并筛选 DNS records</span>
          </NavLink>
          <NavLink to="/endpoint" className={({ isActive }) => (isActive ? "nav-card active" : "nav-card")}>
            <strong>Endpoint</strong>
            <span>查询投影、配置后端、预览并提交 plan</span>
          </NavLink>
        </nav>
      </aside>

      <main className="content-shell">
        <Routes>
          <Route path="/" element={<Navigate to="/dns" replace />} />
          <Route path="/dns" element={<DNSPage />} />
          <Route path="/endpoint/*" element={<EndpointPage />} />
        </Routes>
      </main>
    </div>
  );
}
