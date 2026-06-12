import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const links = [
    { to: '/dashboard',  label: '📊 Dashboard' },
    { to: '/productos',  label: '📦 Productos' },
    { to: '/ventas',     label: '🛒 Ventas' },
    { to: '/inventario', label: '🏭 Inventario' },
    { to: '/compras',    label: '📋 Compras' },
    { to: '/usuarios',   label: '👥 Usuarios' },
];

export default function Layout() {
    const { user, logout } = useAuth();
    return (
        <div style={styles.shell}>
            <nav style={styles.nav}>
                <div style={styles.brand}>ERP Retail</div>
                {links.map(l => (
                    <NavLink key={l.to} to={l.to} style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}>
                        {l.label}
                    </NavLink>
                ))}
                <div style={styles.spacer} />
                <div style={styles.userInfo}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{user?.nombre}</span>
                    <button onClick={logout} style={styles.logout}>Salir</button>
                </div>
            </nav>
            <main style={styles.main}>
                <Outlet />
            </main>
        </div>
    );
}

const styles = {
    shell: { display: 'flex', minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' },
    nav: { width: '220px', background: '#1e293b', display: 'flex', flexDirection: 'column', padding: '1rem 0', flexShrink: 0 },
    brand: { color: '#3b82f6', fontWeight: 700, fontSize: '1.1rem', padding: '0 1rem 1.5rem' },
    link: { padding: '0.65rem 1rem', color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', borderLeft: '3px solid transparent', transition: 'all .15s' },
    active: { color: '#f1f5f9', background: '#0f172a', borderLeftColor: '#3b82f6' },
    spacer: { flex: 1 },
    userInfo: { padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' },
    logout: { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '0.4rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' },
    main: { flex: 1, padding: '2rem', overflowY: 'auto' },
};
