import { formatDate } from "../utils/format.js";
import { StatusChip } from "./StatusChip.jsx";

export function ActivityRail({ health, chatsCount, skillsCount, worktreesCount }) {
  const healthTone = health?.ok ? "online" : "warning";
  const healthLabel = health?.ok ? "Backend online" : "Backend pending";
  const homeLabel = health?.gigacodeHomeExists ? ".gigacode linked" : ".gigacode missing";

  return (
    <footer className="activity-rail">
      <div className="activity-rail-status">
        <StatusChip tone={healthTone} label={healthLabel} />
        <StatusChip tone={health?.gigacodeHomeExists ? "online" : "neutral"} label={homeLabel} />
      </div>
      <div className="activity-rail-meta">
        <span>{chatsCount} chats</span>
        <span>{skillsCount} skills</span>
        <span>{worktreesCount} worktrees</span>
        <span>{formatDate(new Date().toISOString())}</span>
      </div>
    </footer>
  );
}
