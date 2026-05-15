import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

function statusBadge(status) {
  const map = {
    todo: 'secondary',
    in_progress: 'warning',
    done: 'success',
  };
  const color = map[status] || 'secondary';
  const label = status.replace('_', ' ');
  return <span className={`badge bg-${color} status-pill text-capitalize`}>{label}</span>;
}

function aggregateTasks(taskLists) {
  const all = taskLists.flat();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const counts = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;

  for (const t of all) {
    if (counts[t.status] !== undefined) counts[t.status] += 1;
    if (t.status !== 'done' && t.dueDate) {
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      if (d < now) overdue += 1;
    }
  }

  return { total: all.length, counts, overdue };
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [tasksByProject, setTasksByProject] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const list = await api('/api/projects');
      setProjects(list);
      const entries = await Promise.all(
        list.map(async (p) => {
          const tasks = await api(`/api/projects/${p._id}/tasks`);
          return [p._id, tasks];
        })
      );
      const map = {};
      for (const [id, tasks] of entries) map[id] = tasks;
      setTasksByProject(map);
    } catch (e) {
      setError(e.message || 'Could not load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const lists = Object.values(tasksByProject);
    return aggregateTasks(lists);
  }, [tasksByProject]);

  const createProject = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err.message || 'Could not create project.');
    }
  };

  if (loading) {
    return (
      <div className="container text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h3 mb-1">Dashboard</h1>
          <p className="text-muted mb-0">Your projects and task health at a glance.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          New project
        </button>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="card p-3 h-100">
            <div className="text-muted small">Total tasks</div>
            <div className="fs-3 fw-semibold">{summary.total}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card p-3 h-100 border-start border-warning border-4">
            <div className="text-muted small">In progress</div>
            <div className="fs-3 fw-semibold">{summary.counts.in_progress}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card p-3 h-100 border-start border-success border-4">
            <div className="text-muted small">Done</div>
            <div className="fs-3 fw-semibold">{summary.counts.done}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card p-3 h-100 border-start border-danger border-4">
            <div className="text-muted small">Overdue (not done)</div>
            <div className="fs-3 fw-semibold text-danger">{summary.overdue}</div>
          </div>
        </div>
      </div>

      <h2 className="h5 mb-3">Projects</h2>
      {projects.length === 0 ? (
        <div className="card p-4 text-center text-muted">No projects yet. Create one to get started.</div>
      ) : (
        <div className="row g-3">
          {projects.map((p) => {
            const tasks = tasksByProject[p._id] || [];
            const local = aggregateTasks([tasks]);
            return (
              <div className="col-md-6 col-xl-4" key={p._id}>
                <div className="card h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <h3 className="h5 card-title mb-1">
                          <Link to={`/projects/${p._id}`} className="text-decoration-none text-body">
                            {p.name}
                          </Link>
                        </h3>
                        <span className="badge bg-light text-dark border">
                          Role: {p.myRole === 'admin' ? 'Admin' : 'Member'}
                        </span>
                      </div>
                    </div>
                    {p.description ? <p className="card-text small text-muted mt-2 flex-grow-1">{p.description}</p> : <div className="flex-grow-1" />}
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      {statusBadge('todo')} <span className="small">{local.counts.todo}</span>
                      {statusBadge('in_progress')} <span className="small">{local.counts.in_progress}</span>
                      {statusBadge('done')} <span className="small">{local.counts.done}</span>
                    </div>
                    {local.overdue > 0 ? (
                      <div className="text-danger small mt-2">{local.overdue} overdue in this project</div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate ? (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={createProject}>
                <div className="modal-header">
                  <h5 className="modal-title">New project</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowCreate(false)} />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label" htmlFor="projName">
                      Name
                    </label>
                    <input
                      id="projName"
                      className="form-control"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      maxLength={200}
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label" htmlFor="projDesc">
                      Description
                    </label>
                    <textarea
                      id="projDesc"
                      className="form-control"
                      rows={3}
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      maxLength={5000}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreate(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
