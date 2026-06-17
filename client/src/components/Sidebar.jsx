import { tabs } from "../constants.js";

export function Sidebar({ activeTab, health, stats, onTabChange }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className={health?.ok ? "status-dot online" : "status-dot"} />
        <div>
          <strong>GigaCode Harness</strong>
          <small>{health?.gigacodeHomeExists ? health.gigacodeHome : ".gigacode не найден"}</small>
        </div>
      </div>

      <nav>
        {tabs.map((tab) => (
          <button key={tab.value} className={activeTab === tab.value ? "active" : ""} onClick={() => onTabChange(tab.value)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="stat-list">
        {stats.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}
