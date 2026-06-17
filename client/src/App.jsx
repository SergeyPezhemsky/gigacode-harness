import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { ActivityRail } from "./components/ActivityRail.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { Topbar } from "./components/Topbar.jsx";
import { ChatsView } from "./views/ChatsView.jsx";
import { SkillsView } from "./views/SkillsView.jsx";
import { WorktreesView } from "./views/WorktreesView.jsx";
import { RunView } from "./views/RunView.jsx";

export function App() {
  const [activeTab, setActiveTab] = useState("chats");
  const [health, setHealth] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
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
      { label: "Проекты", value: projects.length },
      { label: "Навыки", value: skills.length },
      { label: "Ворк-три", value: worktrees.length }
    ],
    [chats.length, projects.length, skills.length, worktrees.length]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects.find((project) => project.current) || projects[0] || null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    refreshBase();
  }, []);

  async function refreshBase() {
    setError("");
    try {
      const [healthData, chatsData, projectsData, skillsData] = await Promise.all([
        api("/api/health"),
        api("/api/chats"),
        api("/api/projects"),
        api("/api/skills")
      ]);
      setHealth(healthData);
      setChats(chatsData.chats);
      setProjects(projectsData.projects);
      setSelectedProjectId((current) => current || projectsData.projects.find((project) => project.current)?.id || projectsData.projects[0]?.id || "");
      setSkills(skillsData.skills);
      return { health: healthData, chats: chatsData.chats, projects: projectsData.projects, skills: skillsData.skills };
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  return (
    <main className="app-shell">
      <Sidebar activeTab={activeTab} health={health} stats={stats} onTabChange={setActiveTab} />

      <section className="workspace">
        <Topbar activeTab={activeTab} health={health} stats={stats} onRefresh={refreshBase} />
        {error ? <div className="alert">{error}</div> : null}

        {activeTab === "chats" ? (
          <ChatsView
            chats={chats}
            projects={projects}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
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
            projects={projects}
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

        <ActivityRail health={health} chatsCount={chats.length} skillsCount={skills.length} worktreesCount={worktrees.length} />
      </section>
    </main>
  );
}
