import { useMemo, useState } from "react";
import { api } from "../api.js";
import { scopeLabels } from "../constants.js";
import { EmptyState } from "../components/EmptyState.jsx";

export function SkillsView({
  projects,
  repoPath,
  setRepoPath,
  skills,
  setSkills,
  selectedSkill,
  setSelectedSkill,
  skillContent,
  setSkillContent,
  setError
}) {
  const [busySkill, setBusySkill] = useState("");
  const gigacodeProjects = useMemo(() => projects.filter((project) => project.hasGigacode), [projects]);

  async function openSkill(skill) {
    setSelectedSkill(skill);
    setError("");
    try {
      const data = await api(`/api/skills/file?path=${encodeURIComponent(skill.path)}`);
      setSkillContent(data.content);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshSkillsForProject(pathValue = repoPath) {
    setError("");
    try {
      const data = await api(`/api/skills?projectPath=${encodeURIComponent(pathValue)}`);
      setSkills(data.skills);
      if (selectedSkill) {
        const nextSelected = data.skills.find((skill) => skill.dirName === selectedSkill.dirName);
        if (nextSelected) {
          setSelectedSkill(nextSelected);
          const content = await api(`/api/skills/file?path=${encodeURIComponent(nextSelected.path)}`);
          setSkillContent(content.content);
        } else {
          setSelectedSkill(null);
          setSkillContent("");
        }
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function selectProject(projectPath) {
    setRepoPath(projectPath);
    await refreshSkillsForProject(projectPath);
  }

  async function toggleSkill(skill, checked) {
    if (!repoPath) {
      setError("Выберите проект с .gigacode");
      return;
    }

    setBusySkill(skill.dirName);
    setError("");
    try {
      const data = await api("/api/skills/toggle", {
        method: "POST",
        body: JSON.stringify({
          projectPath: repoPath,
          skillName: skill.dirName,
          enabled: checked
        })
      });
      setSkills(data.skills);
      const nextSelected = data.skills.find((item) => item.dirName === skill.dirName);
      if (selectedSkill?.dirName === skill.dirName) {
        if (nextSelected) {
          await openSkill(nextSelected);
        } else {
          setSelectedSkill(null);
          setSkillContent("");
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusySkill("");
    }
  }

  return (
    <section className="split">
      <div className="list-pane">
        <div className="skill-project-picker">
          <select value={repoPath} onChange={(event) => selectProject(event.target.value)}>
            <option value="">Библиотека без проекта</option>
            {gigacodeProjects.map((project) => (
              <option key={project.id} value={project.path}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="inline-form">
            <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} placeholder="Путь к проекту с .gigacode" />
            <button onClick={() => refreshSkillsForProject()}>Загрузить</button>
          </div>
        </div>

        {skills.length ? (
          skills.map((skill) => (
            <button
              key={`${skill.dirName}-${skill.projectSkillPath || skill.path}`}
              className={selectedSkill?.path === skill.path ? "list-item skill-list-item selected" : "list-item skill-list-item"}
              onClick={() => openSkill(skill)}
            >
              <label className="skill-toggle" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={Boolean(skill.installed)}
                  disabled={!skill.canToggle || busySkill === skill.dirName}
                  onChange={(event) => toggleSkill(skill, event.target.checked)}
                />
                <span>{skill.installed ? "Включен" : "Выключен"}</span>
              </label>
              <strong>{skill.name}</strong>
              <span>{skill.description}</span>
              <small>{scopeLabels[skill.scope] || skill.scope}</small>
            </button>
          ))
        ) : (
          <EmptyState title="Навыки не найдены" detail="Библиотека ожидается в ~/.gigacode/skills." />
        )}
      </div>
      <div className="detail-pane">
        {selectedSkill ? (
          <>
            <div className="detail-header">
              <strong>{selectedSkill.name}</strong>
              <small>{selectedSkill.path}</small>
            </div>
            <pre className="skill-body">{skillContent}</pre>
          </>
        ) : (
          <EmptyState title="Выберите навык" detail="Здесь появится полный SKILL.md." />
        )}
      </div>
    </section>
  );
}
