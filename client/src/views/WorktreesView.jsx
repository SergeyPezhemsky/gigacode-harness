import { useState } from "react";
import { api } from "../api.js";

export function WorktreesView({ repoPath, setRepoPath, worktrees, setWorktrees, setError }) {
  const [loading, setLoading] = useState("");
  const [worktreeForm, setWorktreeForm] = useState({ path: "", branch: "", base: "HEAD" });

  async function refreshWorktrees() {
    setLoading("worktrees");
    setError("");
    try {
      const data = await api(`/api/worktrees?repoPath=${encodeURIComponent(repoPath)}`);
      setWorktrees(data.worktrees);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function createWorktree(event) {
    event.preventDefault();
    setLoading("create-worktree");
    setError("");
    try {
      const data = await api("/api/worktrees", {
        method: "POST",
        body: JSON.stringify({ repoPath, ...worktreeForm })
      });
      setWorktrees(data.worktrees);
      setWorktreeForm({ path: "", branch: "", base: "HEAD" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  return (
    <section className="worktree-layout">
      <div className="toolbar">
        <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} placeholder="Путь к репозиторию" />
        <button onClick={refreshWorktrees} disabled={loading === "worktrees"}>
          Показать
        </button>
      </div>
      <form className="create-form" onSubmit={createWorktree}>
        <input value={worktreeForm.path} onChange={(event) => setWorktreeForm({ ...worktreeForm, path: event.target.value })} placeholder="Путь нового worktree" />
        <input value={worktreeForm.branch} onChange={(event) => setWorktreeForm({ ...worktreeForm, branch: event.target.value })} placeholder="Новая ветка" />
        <input value={worktreeForm.base} onChange={(event) => setWorktreeForm({ ...worktreeForm, base: event.target.value })} placeholder="Базовый ref" />
        <button disabled={loading === "create-worktree"}>Создать</button>
      </form>
      <div className="table">
        {worktrees.map((worktree) => (
          <div key={worktree.path} className="row">
            <strong>{worktree.branch || "без ветки"}</strong>
            <span>{worktree.path}</span>
            <small>{worktree.HEAD}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
