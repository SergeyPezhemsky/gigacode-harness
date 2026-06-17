import { api } from "../api.js";
import { scopeLabels } from "../constants.js";
import { EmptyState } from "../components/EmptyState.jsx";

export function SkillsView({ repoPath, setRepoPath, skills, setSkills, selectedSkill, setSelectedSkill, skillContent, setSkillContent, setError }) {
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

  async function refreshSkillsForProject() {
    setError("");
    try {
      const data = await api(`/api/skills?projectPath=${encodeURIComponent(repoPath)}`);
      setSkills(data.skills);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="split">
      <div className="list-pane">
        <div className="inline-form">
          <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} placeholder="Путь к проекту для .gigacode/skills" />
          <button onClick={refreshSkillsForProject}>Загрузить</button>
        </div>
        {skills.length ? (
          skills.map((skill) => (
            <button
              key={skill.path}
              className={selectedSkill?.path === skill.path ? "list-item selected" : "list-item"}
              onClick={() => openSkill(skill)}
            >
              <strong>{skill.name}</strong>
              <span>{skill.description}</span>
              <small>{scopeLabels[skill.scope] || skill.scope}</small>
            </button>
          ))
        ) : (
          <EmptyState title="Навыки не найдены" detail="Личные навыки ожидаются в ~/.gigacode/skills." />
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
