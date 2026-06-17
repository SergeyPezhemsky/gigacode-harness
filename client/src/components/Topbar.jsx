import { tabs } from "../constants.js";

export function Topbar({ activeTab, onRefresh }) {
  return (
    <header className="topbar">
      <div>
        <h1>{tabs.find((tab) => tab.value === activeTab)?.label}</h1>
        <p>Локальная панель для сессий GigaCode, навыков и изолированных git worktree.</p>
      </div>
      <button onClick={onRefresh}>Обновить</button>
    </header>
  );
}
