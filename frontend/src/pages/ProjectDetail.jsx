import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusBadge(status) {
  const map = { todo: 'secondary', in_progress: 'warning', done: 'success' };
  const color = map[status] || 'secondary';
  const label = status.replace('_', ' ');
  return <span className={`badge bg-${color} status-pill text-capitalize`}>{label}</span>;
}

function priorityBadge(priority) {
  const map = { low: 'info', medium: 'warning', high: 'danger' };
  const color = map[priority] || 'secondary';
  return <span className={`badge bg-${color} text-capitalize`}>{priority || 'medium'}</span>;
}

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('member');

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');

  const loadProject = async () => {
    const p = await api(`/api/projects/${projectId}`);
    setProject(p);
  };

  const loadTasks = async () => {
    const t = await api(`/api/projects/${projectId}/tasks`);
    setTasks(t);
  };

  const loadAll = async () => {
    setError('');
    setLoading(true);
    try {
      await Promise.all([loadProject(), loadTasks()]);
    } catch (e) {
      setError(e.message || 'Could not load project.');
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [projectId]);

  const isAdmin = project?.myRole === 'admin';

  const memberOptions = useMemo(() => {
    if (!project) return [];
    const owner = project.owner;
    const list = [{ id: owner._id, label: `${owner.name} (owner)` }];
    for (const m of project.members || []) {
      const u = m.user;
      list.push({ id: u._id, label: `${u.name} (${m.role})` });
    }
    return list;
  }, [project]);

  // Tasks-per-user breakdown
  const tasksPerUser = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!t.assignedTo) continue;
      const uid = t.assignedTo._id;
      const name = t.assignedTo.name;
      if (!map[uid]) map[uid] = { name, total: 0, todo: 0, in_progress: 0, done: 0 };
      map[uid].total += 1;
      if (map[uid][t.status] !== undefined) map[uid][t.status] += 1;
    }
    return Object.values(map);
  }, [tasks]);

  const addMember = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/api/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: memberEmail, role: memberRole }),
      });
      setMemberEmail('');
      setMemberRole('member');
      await loadProject();
    } catch (err) {
      setError(err.message || 'Could not add member.');
    }
  };

  const removeMember = async (userId) => {
    if (!window.confirm('Remove this member from the project?')) return;
    setError('');
    try {
      await api(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
      await loadProject();
      await loadTasks();
    } catch (err) {
      setError(err.message || 'Could not remove member.');
    }
  };

  const changeMemberRole = async (userId, role) => {
    setError('');
    try {
      await api(`/api/projects/${projectId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await loadProject();
    } catch (err) {
      setError(err.message || 'Could not update role.');
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const body = {
        title: taskTitle,
        description: taskDesc,
        dueDate: taskDue || null,
        assignedTo: taskAssignee || null,
        priority: taskPriority,
      };
      await api(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setTaskTitle('');
      setTaskDesc('');
      setTaskDue('');
      setTaskAssignee('');
      setTaskPriority('medium');
      await loadTasks();
    } catch (err) {
      setError(err.message || 'Could not create task.');
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    setError('');
    try {
      await api(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadTasks();
    } catch (err) {
      setError(err.message || 'Could not update task.');
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    setError('');
    try {
      await api(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' });
      await loadTasks();
    } catch (err) {
      setError(err.message || 'Could not delete task.');
    }
  };

  const deleteProject = async () => {
    if (!window.confirm('Delete this project and all of its tasks?')) return;
    setError('');
    try {
      await api(`/api/projects/${projectId}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Could not delete project.');
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

  if (!project) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">{error || 'Project not found.'}</div>
        <Link to="/" className="btn btn-outline-primary">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="mb-3">
        <Link to="/" className="small text-decoration-none">
          ← Dashboard
        </Link>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">{project.name}</h1>
          <p className="text-muted mb-0">{project.description || 'No description.'}</p>
          <div className="mt-2">
            <span className="badge bg-light text-dark border">Your role: {isAdmin ? 'Admin' : 'Member'}</span>
          </div>
        </div>
        {isAdmin ? (
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={deleteProject}>
            Delete project
          </button>
        ) : null}
      </div>

      {error ? <div className="alert alert-warning">{error}</div> : null}

      <div className="row g-4">
        {/* Left column: Team + New Task form + Tasks per member */}
        <div className="col-lg-5">
          {/* Team panel */}
          <div className="card">
            <div className="card-body">
              <h2 className="h5 card-title">Team</h2>
              <p className="small text-muted">Owner: {project.owner?.name}</p>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      {isAdmin ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {project.members?.map((m) => (
                      <tr key={m.user._id}>
                        <td>
                          <div className="fw-medium">{m.user.name}</div>
                          <div className="small text-muted">{m.user.email}</div>
                        </td>
                        <td>
                          {isAdmin ? (
                            <select
                              className="form-select form-select-sm"
                              value={m.role}
                              onChange={(e) => changeMemberRole(m.user._id, e.target.value)}
                              aria-label={`Role for ${m.user.name}`}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className="text-capitalize">{m.role}</span>
                          )}
                        </td>
                        {isAdmin ? (
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-link btn-sm text-danger p-0"
                              onClick={() => removeMember(m.user._id)}
                            >
                              Remove
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isAdmin ? (
                <form className="mt-3 pt-3 border-top" onSubmit={addMember}>
                  <h3 className="h6">Add member</h3>
                  <div className="row g-2">
                    <div className="col-md-7">
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        placeholder="Email (user must be registered)"
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-5">
                      <select
                        className="form-select form-select-sm"
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value)}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm mt-2">
                    Invite
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          {/* New task form — admins only */}
          {isAdmin ? (
            <div className="card mt-4">
              <div className="card-body">
                <h2 className="h5 card-title">New task</h2>
                <form onSubmit={createTask}>
                  <div className="mb-2">
                    <label className="form-label small mb-0" htmlFor="tTitle">Title</label>
                    <input
                      id="tTitle"
                      className="form-control form-control-sm"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      required
                      maxLength={300}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small mb-0" htmlFor="tDesc">Description</label>
                    <textarea
                      id="tDesc"
                      className="form-control form-control-sm"
                      rows={2}
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      maxLength={5000}
                    />
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small mb-0" htmlFor="tDue">Due date</label>
                      <input
                        id="tDue"
                        type="date"
                        className="form-control form-control-sm"
                        value={taskDue}
                        onChange={(e) => setTaskDue(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small mb-0" htmlFor="tPriority">Priority</label>
                      <select
                        id="tPriority"
                        className="form-select form-select-sm"
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value)}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small mb-0" htmlFor="tAssign">Assign to</label>
                    <select
                      id="tAssign"
                      className="form-select form-select-sm"
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {memberOptions.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm mt-2">
                    Create task
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {/* Tasks per member breakdown */}
          {tasksPerUser.length > 0 ? (
            <div className="card mt-4">
              <div className="card-body">
                <h2 className="h5 card-title">Tasks per member</h2>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th className="text-center">Total</th>
                        <th className="text-center">To Do</th>
                        <th className="text-center">In Progress</th>
                        <th className="text-center">Done</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksPerUser.map((u) => (
                        <tr key={u.name}>
                          <td className="fw-medium">{u.name}</td>
                          <td className="text-center">{u.total}</td>
                          <td className="text-center">{u.todo}</td>
                          <td className="text-center">{u.in_progress}</td>
                          <td className="text-center text-success fw-semibold">{u.done}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right column: Tasks table */}
        <div className="col-lg-7">
          <div className="card">
            <div className="card-body">
              <h2 className="h5 card-title">Tasks</h2>
              {tasks.length === 0 ? (
                <p className="text-muted small mb-0">No tasks yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Priority</th>
                        <th>Assignee</th>
                        <th>Due</th>
                        <th>Status</th>
                        {isAdmin ? <th /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t) => {
                        const assigneeId = t.assignedTo?._id;
                        const canStatus =
                          isAdmin || (assigneeId && String(assigneeId) === String(user.id));
                        return (
                          <tr key={t._id}>
                            <td>
                              <div className="fw-medium">{t.title}</div>
                              {t.description ? (
                                <div className="small text-muted">{t.description}</div>
                              ) : null}
                            </td>
                            <td>{priorityBadge(t.priority)}</td>
                            <td className="small">{t.assignedTo?.name || '—'}</td>
                            <td className="small">{formatDate(t.dueDate)}</td>
                            <td>
                              {canStatus ? (
                                <select
                                  className="form-select form-select-sm"
                                  value={t.status}
                                  onChange={(e) => updateTaskStatus(t._id, e.target.value)}
                                  aria-label={`Status for ${t.title}`}
                                >
                                  <option value="todo">Todo</option>
                                  <option value="in_progress">In progress</option>
                                  <option value="done">Done</option>
                                </select>
                              ) : (
                                statusBadge(t.status)
                              )}
                            </td>
                            {isAdmin ? (
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm text-danger p-0"
                                  onClick={() => deleteTask(t._id)}
                                >
                                  Delete
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {isAdmin && tasks.length > 0 ? (
                <p className="small text-muted mb-0 mt-2">
                  Admins can create, assign, and delete tasks. Members may change status only on tasks assigned to them.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
