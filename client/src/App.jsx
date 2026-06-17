import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { Sidebar } from "./components/Sidebar.jsx";
import { Topbar } from "./components/Topbar.jsx";
import { ChatsView } from "./views/ChatsView.jsx";
import { SkillsView } from "./views/SkillsView.jsx";
import { WorktreesView } from "./views/WorktreesView.jsx";
import { RunView } from "./views/RunView.jsx";

export function App() {
  const [activeTab, setActiveTab] = useState("chats");
  const [health, setHealth] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [skills, setSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [skillContent, setSkillContent] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [worktrees, setWorktrees] = useState([]);
  const [error, setError] = useState("");

  const stats = useMemo(
    () => [
      { label: "Чаты", value: chats.length },
      { label: "Навыки", value: skills.length },
      { label: "Ворк-три", value: worktrees.length }
    ],
    [chats.length, skills.length, worktrees.length]
  );

  useEffect(() => {
    refreshBase();
  }, []);

  async function refreshBase() {
    setError("");
    try {
      const [healthData, chatsData, skillsData] = await Promise.all([
        api("/api/health"),
        api("/api/chats"),
        api("/api/skills")
      ]);
      setHealth(healthData);
      setChats(chatsData.chats);
      setSkills(skillsData.skills);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar activeTab={activeTab} health={health} stats={stats} onTabChange={setActiveTab} />

      <section className="workspace">
        <Topbar activeTab={activeTab} onRefresh={refreshBase} />
        {error ? <div className="alert">{error}</div> : null}

        {activeTab === "chats" ? (
          <ChatsView
            chats={chats}
            selectedChat={selectedChat}
            setSelectedChat={setSelectedChat}
            chatMessages={chatMessages}
            setChatMessages={setChatMessages}
            refreshBase={refreshBase}
            setError={setError}
          />
        ) : null}

        {activeTab === "skills" ? (
          <SkillsView
            repoPath={repoPath}
            setRepoPath={setRepoPath}
            skills={skills}
            setSkills={setSkills}
            selectedSkill={selectedSkill}
            setSelectedSkill={setSelectedSkill}
            skillContent={skillContent}
            setSkillContent={setSkillContent}
            setError={setError}
          />
        ) : null}

        {activeTab === "worktrees" ? (
          <WorktreesView
            repoPath={repoPath}
            setRepoPath={setRepoPath}
            worktrees={worktrees}
            setWorktrees={setWorktrees}
            setError={setError}
          />
        ) : null}

        {activeTab === "run" ? <RunView setError={setError} /> : null}
      </section>
    </main>
  );
}
