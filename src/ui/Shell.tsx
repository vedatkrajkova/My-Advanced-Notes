import { NavLink, Outlet } from 'react-router-dom';
import { SyncIndicator } from './SyncIndicator';

function NavItems() {
  return (
    <>
      <NavLink to="/notes" className="nav__link">
        <span className="nav__icon" aria-hidden="true">✎</span> Shënime
      </NavLink>
      <NavLink to="/tasks" className="nav__link">
        <span className="nav__icon" aria-hidden="true">✓</span> Detyra
      </NavLink>
    </>
  );
}

export function Shell() {
  return (
    <div className="shell">
      <header className="topbar">
        <nav className="nav nav--top" aria-label="Seksionet">
          <NavItems />
        </nav>
        <span className="topbar__title">Shënime dhe detyra</span>
        <SyncIndicator />
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="nav nav--bottom" aria-label="Seksionet">
        <NavItems />
      </nav>
    </div>
  );
}
