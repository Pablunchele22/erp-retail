import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(form.email, form.password);
            navigate('/dashboard');
        } catch {
            setError('Credenciales incorrectas');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={styles.bg}>
            <form onSubmit={handleSubmit} style={styles.card}>
                <h1 style={styles.title}>ERP Retail</h1>
                <p style={styles.sub}>Iniciá sesión para continuar</p>
                {error && <div style={styles.error}>{error}</div>}
                <input
                    style={styles.input}
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                />
                <input
                    style={styles.input}
                    type="password"
                    placeholder="Contraseña"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                />
                <button style={styles.btn} type="submit" disabled={loading}>
                    {loading ? 'Ingresando…' : 'Ingresar'}
                </button>
            </form>
        </div>
    );
}

const styles = {
    bg: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' },
    card: { background: '#1e293b', padding: '2.5rem', borderRadius: '1rem', width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '1rem' },
    title: { color: '#f1f5f9', margin: 0, fontSize: '1.8rem', fontWeight: 700 },
    sub: { color: '#94a3b8', margin: 0, fontSize: '0.9rem' },
    error: { background: '#7f1d1d', color: '#fca5a5', padding: '0.6rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem' },
    input: { padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: '1rem', outline: 'none' },
    btn: { padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: '#3b82f6', color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' },
};
