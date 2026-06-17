import { tabs } from "../constants.js";
import { MetricTile } from "./MetricTile.jsx";
import { StatusChip } from "./StatusChip.jsx";

export function Topbar({ activeTab, health, stats, onRefresh }) {
  const activeLabel = tabs.find((tab) => tab.value === activeTab)?.label;

  return (
    <header className="topbar">
      <div className="topbar-copy">
        <div className="topbar-kicker">
          <StatusChip tone={health?.ok ? "online" : "warning"} label={health?.ok ? "Harness online" : "Harness pending"} />
          <span>Glass cockpit interface</span>
        </div>
        <h1>{activeLabel}</h1>
        <p>Локальная панель для сессий GigaCode, навыков и изолированных git worktree.</p>
      </div>
      <div className="topbar-panel">
        <div className="topbar-metrics">
          {stats.map((item) => (
            <MetricTile key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
        <button onClick={onRefresh}>Обновить</button>
      </div>
    </header>
  );
}
