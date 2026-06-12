import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

const fmt = n => `$${Number(n).toLocaleString('es-UY', { maximumFractionDigits: 0 })}`;
const estadoColor = { borrador: '#94a3b8', enviada: '#3b82f6', recibida_parcial: '#f59e0b', recibida: '#22c55e', cancelada: '#ef4444' };

export default function Compras() {
    const qc = useQueryClient();
    const [modal, setModal] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['compras'],
        queryFn: () => api.get('/compras', { params: { limit: 50 } }).then(r => r.data),
    });

    const cambiarEstado = useMutation({
        mutationFn: ({ id, estado }) => api.patch(`/compras/${id}/estado`, { estado }),
        onSuccess: () => qc.invalidateQueries(['compras']),
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#f1f5f9' }}>Órdenes de compra</h2>
                <button onClick={() => setModal(true)} style={btnStyle}>+ Nueva OC</button>
            </div>

            {isLoading ? <p style={{ color: '#94a3b8' }}>Cargando…</p> : (
                <div style={{ background: '#1e293b', borderRadius: '0.75rem', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#0f172a' }}>
                                {['Número', 'Proveedor', 'Total', 'Estado', 'Emisión', 'Acciones'].map(h => (
                                    <th key={h} style={thStyle}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data?.map(oc => (
                                <tr key={oc.id} style={{ borderBottom: '1px solid #0f172a' }}>
                                    <td style={tdStyle}><code style={{ color: '#94a3b8' }}>{oc.numero}</code></td>
                                    <td style={tdStyle}>{oc.proveedor_nombre}</td>
                                    <td style={{ ...tdStyle, fontWeight: 600 }}>{fmt(oc.total)}</td>
                                    <td style={tdStyle}>
                                        <span style={{ background: (estadoColor[oc.estado] || '#94a3b8') + '22', color: estadoColor[oc.estado] || '#94a3b8', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {oc.estado.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#64748b', fontSize: '0.8rem' }}>{new Date(oc.fecha_emision).toLocaleDateString('es-UY')}</td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            {oc.estado === 'borrador' && (
                                                <button onClick={() => cambiarEstado.mutate({ id: oc.id, estado: 'enviada' })} style={{ ...btnStyle, fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: '#1d4ed8' }}>Enviar</button>
                                            )}
                                            {oc.estado === 'enviada' && (
                                                <button onClick={() => cambiarEstado.mutate({ id: oc.id, estado: 'recibida' })} style={{ ...btnStyle, fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: '#166534' }}>Marcar recibida</button>
                                            )}
                                            {['borrador', 'enviada'].includes(oc.estado) && (
                                                <button onClick={() => { if (confirm('¿Cancelar OC?')) cambiarEstado.mutate({ id: oc.id, estado: 'cancelada' }); }} style={{ ...btnStyle, fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: '#7f1d1d' }}>Cancelar</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {(!data || data.length === 0) && <p style={{ color: '#64748b', padding: '1rem' }}>Sin órdenes aún</p>}
                </div>
            )}

            {modal && <NuevaOCModal onClose={() => setModal(false)} onSuccess={() => { setModal(false); qc.invalidateQueries(['compras']); }} />}
        </div>
    );
}

function NuevaOCModal({ onClose, onSuccess }) {
    const [proveedor_id, setProveedorId] = useState('');
    const [fecha_esperada, setFecha] = useState('');
    const [notas, setNotas] = useState('');
    const [items, setItems] = useState([{ producto_id: '', cantidad: 1, precio_unitario: '' }]);

    const { data: provs } = useQuery({ queryKey: ['proveedores-lista'], queryFn: () => api.get('/compras/proveedores/lista').then(r => r.data) });
    const { data: prods } = useQuery({ queryKey: ['productos-lista'], queryFn: () => api.get('/productos', { params: { limit: 200 } }).then(r => r.data.data) });

    const crear = useMutation({ mutationFn: body => api.post('/compras', body), onSuccess });

    const setItem = (i, k, v) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
    const total = items.reduce((s, it) => s + (it.cantidad * (it.precio_unitario || 0)), 0);

    return (
        <div style={overlay}>
            <div style={{ ...modalCard, width: '640px' }}>
                <h3 style={{ color: '#f1f5f9', margin: '0 0 1rem' }}>Nueva orden de compra</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    <select value={proveedor_id} onChange={e => setProveedorId(e.target.value)} style={inputStyle}>
                        <option value="">— Proveedor —</option>
                        {provs?.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <input type="date" value={fecha_esperada} onChange={e => setFecha(e.target.value)} style={inputStyle} placeholder="Fecha esperada" />
                    <input placeholder="Notas" value={notas} onChange={e => setNotas(e.target.value)} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
                </div>

                {items.map((it, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 120px 30px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <select value={it.producto_id} onChange={e => setItem(i, 'producto_id', e.target.value)} style={inputStyle}>
                            <option value="">— Producto —</option>
                            {prods?.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                        <input type="number" placeholder="Cant." min={1} value={it.cantidad} onChange={e => setItem(i, 'cantidad', +e.target.value)} style={inputStyle} />
                        <input type="number" placeholder="Precio" value={it.precio_unitario} onChange={e => setItem(i, 'precio_unitario', +e.target.value)} style={inputStyle} />
                        <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} style={{ ...btnStyle, background: '#7f1d1d', padding: '0.4rem' }}>✕</button>
                    </div>
                ))}

                <button onClick={() => setItems(p => [...p, { producto_id: '', cantidad: 1, precio_unitario: '' }])} style={{ ...btnSecondary, fontSize: '0.8rem', marginBottom: '1rem' }}>+ Ítem</button>

                <div style={{ color: '#3b82f6', fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Total: {fmt(total)}</div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={btnSecondary}>Cancelar</button>
                    <button onClick={() => crear.mutate({ proveedor_id, fecha_esperada, notas, items })} disabled={crear.isPending} style={btnStyle}>
                        {crear.isPending ? 'Guardando…' : 'Crear OC'}
                    </button>
                </div>
                {crear.isError && <p style={{ color: '#ef4444', marginTop: '0.5rem', fontSize: '0.85rem' }}>{crear.error?.response?.data?.error || 'Error'}</p>}
            </div>
        </div>
    );
}

const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 };
const tdStyle = { padding: '0.75rem 1rem', color: '#e2e8f0', fontSize: '0.875rem' };
const inputStyle = { padding: '0.6rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: '0.875rem', outline: 'none', width: '100%', boxSizing: 'border-box' };
const btnStyle = { padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#3b82f6', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' };
const btnSecondary = { ...btnStyle, background: '#334155' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modalCard = { background: '#1e293b', borderRadius: '1rem', padding: '2rem', maxWidth: '90vw', overflowY: 'auto', maxHeight: '90vh' };
