import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

const fmt = n => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(n);

export default function Ventas() {
    const qc = useQueryClient();
    const [modal, setModal] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['ventas'],
        queryFn: () => api.get('/ventas', { params: { limit: 50 } }).then(r => r.data),
    });

    const anular = useMutation({
        mutationFn: id => api.patch(`/ventas/${id}/anular`),
        onSuccess: () => qc.invalidateQueries(['ventas']),
    });

    const estadoColor = { completada: '#22c55e', pendiente: '#f59e0b', anulada: '#ef4444', devolucion: '#a855f7' };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#f1f5f9' }}>Ventas</h2>
                <button onClick={() => setModal(true)} style={btnStyle}>+ Nueva venta</button>
            </div>

            {isLoading ? <p style={{ color: '#94a3b8' }}>Cargando…</p> : (
                <div style={{ background: '#1e293b', borderRadius: '0.75rem', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#0f172a' }}>
                                {['Número', 'Cliente', 'Total', 'Pago', 'Estado', 'Fecha', ''].map(h => (
                                    <th key={h} style={thStyle}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data?.data?.map(v => (
                                <tr key={v.id} style={{ borderBottom: '1px solid #0f172a' }}>
                                    <td style={tdStyle}><code style={{ color: '#94a3b8' }}>{v.numero}</code></td>
                                    <td style={tdStyle}>{v.cliente_nombre || 'Consumidor final'}</td>
                                    <td style={{ ...tdStyle, fontWeight: 600, color: '#22c55e' }}>{fmt(v.total)}</td>
                                    <td style={tdStyle}>{v.medio_pago || '-'}</td>
                                    <td style={tdStyle}>
                                        <span style={{ background: estadoColor[v.estado] + '22', color: estadoColor[v.estado], padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {v.estado}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#64748b', fontSize: '0.8rem' }}>{new Date(v.creado_en).toLocaleDateString('es-UY')}</td>
                                    <td style={tdStyle}>
                                        {v.estado === 'completada' && (
                                            <button onClick={() => { if (confirm('¿Anular venta?')) anular.mutate(v.id); }} style={{ ...btnStyle, background: '#7f1d1d', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                                                Anular
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data?.data?.length === 0 && <p style={{ color: '#64748b', padding: '1rem' }}>Sin ventas aún</p>}
                </div>
            )}

            {modal && <NuevaVentaModal onClose={() => setModal(false)} onSuccess={() => { setModal(false); qc.invalidateQueries(['ventas']); }} />}
        </div>
    );
}

function NuevaVentaModal({ onClose, onSuccess }) {
    const [items, setItems] = useState([{ producto_id: '', cantidad: 1, precio_unitario: '', descuento_pct: 0 }]);
    const [medio_pago, setMedioPago] = useState('efectivo');
    const [descuento, setDescuento] = useState(0);

    const { data: prods } = useQuery({ queryKey: ['productos-lista'], queryFn: () => api.get('/productos', { params: { limit: 200 } }).then(r => r.data.data) });

    const crear = useMutation({ mutationFn: body => api.post('/ventas', body), onSuccess });

    const addItem = () => setItems(p => [...p, { producto_id: '', cantidad: 1, precio_unitario: '', descuento_pct: 0 }]);
    const setItem = (i, k, v) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
    const pickProd = (i, pid) => {
        const p = prods?.find(x => x.id === pid);
        setItem(i, 'producto_id', pid);
        if (p) setItem(i, 'precio_unitario', p.precio_venta);
    };

    const subtotal = items.reduce((s, it) => s + (it.cantidad * it.precio_unitario * (1 - (it.descuento_pct || 0) / 100)), 0);

    return (
        <div style={overlay}>
            <div style={{ ...modalCard, width: '640px' }}>
                <h3 style={{ color: '#f1f5f9', margin: '0 0 1rem' }}>Nueva venta</h3>

                {items.map((it, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 120px 80px 30px', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <select value={it.producto_id} onChange={e => pickProd(i, e.target.value)} style={inputStyle}>
                            <option value="">— Producto —</option>
                            {prods?.map(p => <option key={p.id} value={p.id}>{p.nombre} (stock: {p.stock_total})</option>)}
                        </select>
                        <input type="number" placeholder="Cant." value={it.cantidad} min={1} onChange={e => setItem(i, 'cantidad', +e.target.value)} style={inputStyle} />
                        <input type="number" placeholder="Precio" value={it.precio_unitario} onChange={e => setItem(i, 'precio_unitario', +e.target.value)} style={inputStyle} />
                        <input type="number" placeholder="Dto%" value={it.descuento_pct} onChange={e => setItem(i, 'descuento_pct', +e.target.value)} style={inputStyle} />
                        <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} style={{ ...btnStyle, background: '#7f1d1d', padding: '0.4rem' }}>✕</button>
                    </div>
                ))}

                <button onClick={addItem} style={{ ...btnSecondary, marginBottom: '1rem', fontSize: '0.8rem' }}>+ Ítem</button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    <select value={medio_pago} onChange={e => setMedioPago(e.target.value)} style={inputStyle}>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="cuenta_corriente">Cuenta corriente</option>
                    </select>
                    <input type="number" placeholder="Descuento global" value={descuento} onChange={e => setDescuento(+e.target.value)} style={inputStyle} />
                </div>

                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}>
                    Total: ${(subtotal - descuento).toLocaleString('es-UY', { maximumFractionDigits: 0 })}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={btnSecondary}>Cancelar</button>
                    <button onClick={() => crear.mutate({ items, medio_pago, descuento })} disabled={crear.isPending} style={btnStyle}>
                        {crear.isPending ? 'Procesando…' : 'Confirmar venta'}
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
