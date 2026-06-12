import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

const ROLES = ['admin', 'vendedor', 'deposito', 'compras'];
const rolColor = { admin: '#a855f7', vendedor: '#3b82f6', deposito: '#f59e0b', compras: '#22c55e' };

export default function Usuarios() {
    const qc = useQueryClient();
    const [modal, setModal] = useState(null); // null | 'nuevo' | usuario

    const { data: usuarios, isLoading } = useQuery({
        queryKey: ['usuarios'],
        queryFn: () => api.get('/usuarios').then(r => r.data),
    });

    const toggleActivo = useMutation({
        mutationFn: u => api.put(`/usuarios/${u.id}`, { activo: !u.activo }),
        onSuccess: () => qc.invalidateQueries(['usuarios']),
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#f1f5f9' }}>Usuarios</h2>
                <button onClick={() => setModal('nuevo')} style={btnStyle}>+ Nuevo usuario</button>
            </div>

            {isLoading ? <p style={{ color: '#94a3b8' }}>Cargando…</p> : (
                <div style={{ background: '#1e293b', borderRadius: '0.75rem', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#0f172a' }}>
                                {['Nombre', 'Email', 'Rol', 'Estado', 'Creado', ''].map(h => (
                                    <th key={h} style={thStyle}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {usuarios?.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid #0f172a' }}>
                                    <td style={tdStyle}>{u.nombre}</td>
                                    <td style={{ ...tdStyle, color: '#94a3b8' }}>{u.email}</td>
                                    <td style={tdStyle}>
                                        <span style={{ background: (rolColor[u.rol] || '#64748b') + '22', color: rolColor[u.rol] || '#64748b', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {u.rol}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{ color: u.activo ? '#22c55e' : '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>
                                            {u.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#64748b', fontSize: '0.8rem' }}>
                                        {new Date(u.creado_en).toLocaleDateString('es-UY')}
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <button onClick={() => setModal(u)} style={{ ...btnStyle, fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: '#334155' }}>
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => toggleActivo.mutate(u)}
                                                style={{ ...btnStyle, fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: u.activo ? '#7f1d1d' : '#166534' }}
                                            >
                                                {u.activo ? 'Desactivar' : 'Activar'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {usuarios?.length === 0 && <p style={{ color: '#64748b', padding: '1rem' }}>Sin usuarios</p>}
                </div>
            )}

            {modal && (
                <UsuarioModal
                    usuario={modal === 'nuevo' ? null : modal}
                    onClose={() => setModal(null)}
                    onSuccess={() => { setModal(null); qc.invalidateQueries(['usuarios']); }}
                />
            )}
        </div>
    );
}

function UsuarioModal({ usuario, onClose, onSuccess }) {
    const esNuevo = !usuario;
    const [f, setF] = useState({
        nombre: usuario?.nombre || '',
        email: usuario?.email || '',
        rol: usuario?.rol || 'vendedor',
        password: '',
    });
    const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

    const guardar = useMutation({
        mutationFn: body => esNuevo
            ? api.post('/usuarios', body)
            : api.put(`/usuarios/${usuario.id}`, body),
        onSuccess,
    });

    const handleSubmit = () => {
        const body = { nombre: f.nombre, rol: f.rol };
        if (esNuevo) { body.email = f.email; body.password = f.password; }
        else if (f.password) { body.password = f.password; }
        guardar.mutate(body);
    };

    return (
        <div style={overlay}>
            <div style={modalCard}>
                <h3 style={{ color: '#f1f5f9', margin: '0 0 1.25rem' }}>
                    {esNuevo ? 'Nuevo usuario' : `Editar — ${usuario.nombre}`}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <input style={inputStyle} placeholder="Nombre completo *" value={f.nombre} onChange={set('nombre')} />
                    {esNuevo && (
                        <input style={inputStyle} type="email" placeholder="Email *" value={f.email} onChange={set('email')} />
                    )}
                    <select style={inputStyle} value={f.rol} onChange={set('rol')}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input
                        style={inputStyle}
                        type="password"
                        placeholder={esNuevo ? 'Contraseña *' : 'Nueva contraseña (dejar vacío para no cambiar)'}
                        value={f.password}
                        onChange={set('password')}
                    />
                </div>
                {guardar.isError && (
                    <p style={{ color: '#ef4444', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                        {guardar.error?.response?.data?.error || 'Error al guardar'}
                    </p>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                    <button onClick={onClose} style={btnSecondary}>Cancelar</button>
                    <button onClick={handleSubmit} disabled={guardar.isPending} style={btnStyle}>
                        {guardar.isPending ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 };
const tdStyle = { padding: '0.75rem 1rem', color: '#e2e8f0', fontSize: '0.875rem' };
const inputStyle = { padding: '0.6rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' };
const btnStyle = { padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#3b82f6', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' };
const btnSecondary = { ...btnStyle, background: '#334155' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modalCard = { background: '#1e293b', borderRadius: '1rem', padding: '2rem', width: '440px', maxWidth: '90vw' };
