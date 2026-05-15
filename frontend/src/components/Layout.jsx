import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container">
          <Link className="navbar-brand" to="/">
            Team Task Manager
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#nav"
            aria-controls="nav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="nav">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <NavLink className="nav-link" to="/" end>
                  Dashboard
                </NavLink>
              </li>
            </ul>
            <div className="d-flex align-items-center gap-3 text-white small">
              <span className="d-none d-sm-inline">{user?.name}</span>
              <button type="button" className="btn btn-outline-light btn-sm" onClick={logout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="py-4">{children}</main>
    </>
  );
}
