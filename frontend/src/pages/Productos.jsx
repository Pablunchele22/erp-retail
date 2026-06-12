import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export default function Productos() {
    const qc = useQueryClient();
    const [buscar, setBuscar] = useState('');
    const [modal, setModal] = useState(null); // null | 'nuevo' | producto

    const { data, isLoading } = useQuery({
        queryKey: ['productos', buscar],
        queryFn: () => api.get('/productos', { params: { buscar, limit: 100 } }).then(r => r.data),
    });

    const { data: cats } = useQuery({ queryKey: ['categorias'], queryFn: () => api.get('/productos').then(() => []) });

    const crear = useMutation({
        mutationFn: body => api.post('/productos', body),
        onSuccess: () => { qc.invalidateQueries(['productos']); setModal(null); },
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#f1f5f9' }}>Productos</h2>
                <button onClick={() => setModal('nuevo')} style={btnStyle}>+ Nuevo producto</button>
            </div>

            <input
                placeholder="Buscar por nombre o SKU…"
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                style={{ ...inputStyle, width: '320px', marginBottom: '1rem' }}
            />

            {isLoading ? <p style={{ color: '#94a3b8' }}>Cargando…</p> : (
                <div style={{ background: '#1e293b', borderRadius: '0.75rem', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#0f172a' }}>
                                {['SKU', 'Nombre', 'Categoría', 'Stock', 'Precio venta', 'Mín.'].map(h => (
                                    <th key={h} style={thStyle}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data?.data?.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #0f172a' }}>
                                    <td style={tdStyle}><code style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{p.sku}</code></td>
                                    <td style={tdStyle}>{p.nombre}</td>
                                    <td style={tdStyle}>{p.categoria || '-'}</td>
                                    <td style={{ ...tdStyle, color: p.stock_total <= p.stock_minimo ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{p.stock_total}</td>
                                    <td style={tdStyle}>${Number(p.precio_venta).toLocaleString('es-UY')}</td>
                                    <td style={tdStyle}>{p.stock_minimo}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data?.data?.length === 0 && <p style={{ color: '#64748b', padding: '1rem' }}>Sin resultados</p>}
                </div>
            )}

            {modal === 'nuevo' && <ProductoModal onClose={() => setModal(null)} onSave={crear.mutate} loading={crear.isPending} />}
        </div>
    );
}

function ProductoModal({ onClose, onSave, loading }) {
    const [f, setF] = useState({ sku: '', nombre: '', precio_venta: '', precio_costo: '', stock_minimo: 0, unidad: 'unidad' });
    const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

    return (
        <div style={overlay}>
            <div style={modalCard}>
                <h3 style={{ color: '#f1f5f9', margin: '0 0 1rem' }}>Nuevo producto</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <input style={inputStyle} placeholder="SKU *" value={f.sku} onChange={set('sku')} />
                    <input style={inputStyle} placeholder="Nombre *" value={f.nombre} onChange={set('nombre')} />
                    <input style={inputStyle} placeholder="Precio venta *" type="number" value={f.precio_venta} onChange={set('precio_venta')} />
                    <input style={inputStyle} placeholder="Precio costo" type="number" value={f.precio_costo} onChange={set('precio_costo')} />
                    <input style={inputStyle} placeholder="Stock mínimo" type="number" value={f.stock_minimo} onChange={set('stock_minimo')} />
                    <input style={inputStyle} placeholder="Unidad (unidad/kg/lt)" value={f.unidad} onChange={set('unidad')} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button onClick={onClose} style={btnSecondary}>Cancelar</button>
                    <button onClick={() => onSave(f)} disabled={loading} style={btnStyle}>{loading ? 'Guardando…' : 'Guardar'}</button>
                </div>
            </div>
        </div>
    );
}

const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 };
const tdStyle = { padding: '0.75rem 1rem', color: '#e2e8f0', fontSize: '0.875rem' };
const inputStyle = { padding: '0.6rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' };
const btnStyle = { padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#3b82f6', color: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' };
const btnSecondary = { ...btnStyle, background: '#334155' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modalCard = { background: '#1e293b', borderRadius: '1rem', padding: '2rem', width: '520px', maxWidth: '90vw' };
