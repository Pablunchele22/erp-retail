import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export default function Inventario() {
    const qc = useQueryClient();
    const [tab, setTab] = useState('stock');
    const [modal, setModal] = useState(false);

    const stock = useQuery({ queryKey: ['stock'], queryFn: () => api.get('/inventario/stock').then(r => r.data), enabled: tab === 'stock' });
    const alertas = useQuery({ queryKey: ['alertas'], queryFn: () => api.get('/inventario/alertas').then(r => r.data), enabled: tab === 'alertas' });
    const movs = useQuery({ queryKey: ['movimientos'], queryFn: () => api.get('/inventario/movimientos').then(r => r.data), enabled: tab === 'movimientos' });
    const vencs = useQuery({ queryKey: ['vencimientos'], queryFn: () => api.get('/inventario/vencimientos').then(r => r.data), enabled: tab === 'vencimientos' });

    const resolverAlerta = useMutation({
        mutationFn: id => api.patch(`/inventario/alertas/${id}/resolver`),
        onSuccess: () => qc.invalidateQueries(['alertas']),
    });

    const tabStyle = active => ({
        padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: active ? 600 : 400,
        background: active ? '#3b82f6' : '#1e293b', color: active ? '#fff' : '#94a3b8',
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, color: '#f1f5f9' }}>Inventario</h2>
                <button onClick={() => setModal(true)} style={btnStyle}>+ Ingreso / Ajuste</button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {[['stock','Stock'],['alertas','Alertas'],['movimientos','Movimientos'],['vencimientos','Vencimientos']].map(([k,l]) => (
                    <button key={k} onClick={() => setTab(k)} style={tabStyle(tab === k)}>{l}</button>
                ))}
            </div>

            {tab === 'stock' && (
                stock.isLoading ? <p style={{ color: '#94a3b8' }}>Cargando…</p> :
                <Table cols={['SKU','Nombre','Categoría','Stock','Mínimo','Próx. vto.']} rows={stock.data?.map(p => [
                    <code style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{p.sku}</code>,
                    p.nombre, p.categoria || '-',
                    <span style={{ color: p.stock_total <= p.stock_minimo ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{p.stock_total}</span>,
                    p.stock_minimo,
                    p.proximo_vencimiento ? new Date(p.proximo_vencimiento).toLocaleDateString('es-UY') : '-',
                ])} />
            )}

            {tab === 'alertas' && (
                alertas.isLoading ? <p style={{ color: '#94a3b8' }}>Cargando…</p> :
                <Table cols={['Tipo','Producto','Mensaje','']} rows={alertas.data?.map(a => [
                    <span style={{ color: a.tipo.includes('stock') ? '#ef4444' : '#f59e0b', fontWeight: 600, fontSize: '0.8rem' }}>{a.tipo.replace('_',' ')}</span>,
                    a.producto_nombre,
                    a.mensaje,
                    <button onClick={() => resolverAlerta.mutate(a.id)} style={{ ...btnStyle, fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: '#166534' }}>Resolver</button>,
                ])} />
            )}

            {tab === 'movimientos' && (
                movs.isLoading ? <p style={{ color: '#94a3b8' }}>Cargando…</p> :
                <Table cols={['Producto','Tipo','Cantidad','Referencia','Usuario','Fecha']} rows={movs.data?.data?.map(m => [
                    m.producto_nombre,
                    <span style={{ color: m.tipo === 'entrada' ? '#22c55e' : m.tipo === 'salida' ? '#ef4444' : '#f59e0b', fontWeight: 600, fontSize: '0.8rem' }}>{m.tipo}</span>,
                    m.cantidad, m.referencia_tipo || '-', m.usuario_nombre || '-',
                    new Date(m.creado_en).toLocaleDateString('es-UY'),
                ])} />
            )}

            {tab === 'vencimientos' && (
                vencs.isLoading ? <p style={{ color: '#94a3b8' }}>Cargando…</p> :
                <Table cols={['Producto','Lote','Cantidad','Vence','Días']} rows={vencs.data?.map(v => [
                    v.producto_nombre, v.numero_lote || '-', v.cantidad,
                    new Date(v.fecha_vencimiento).toLocaleDateString('es-UY'),
                    <span style={{ color: v.dias_restantes <= 7 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{v.dias_restantes}d</span>,
                ])} />
            )}

            {modal && <AjusteModal onClose={() => setModal(false)} onSuccess={() => { setModal(false); qc.invalidateQueries(['stock']); qc.invalidateQueries(['movimientos']); }} />}
        </div>
    );
}

function Table({ cols, rows = [] }) {
    return (
        <div style={{ background: '#1e293b', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#0f172a' }}>{cols.map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #0f172a' }}>
                            {row.map((cell, j) => <td key={j} style={tdStyle}>{cell}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length === 0 && <p style={{ color: '#64748b', padding: '1rem' }}>Sin datos</p>}
        </div>
    );
}

function AjusteModal({ onClose, onSuccess }) {
    const [f, setF] = useState({ producto_id: '', cantidad: '', tipo: 'entrada', notas: '', costo_unitario: '' });
    const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

    const { data: prods } = useQuery({ queryKey: ['productos-lista'], queryFn: () => api.get('/productos', { params: { limit: 200 } }).then(r => r.data.data) });

    const ajuste = useMutation({ mutationFn: body => api.post('/inventario/lotes', body), onSuccess });

    return (
        <div style={overlay}>
            <div style={modalCard}>
                <h3 style={{ color: '#f1f5f9', margin: '0 0 1rem' }}>Ingreso / Ajuste de stock</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <select value={f.producto_id} onChange={set('producto_id')} style={inputStyle}>
                        <option value="">— Seleccionar producto —</option>
                        {prods?.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.sku})</option>)}
                    </select>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <input style={inputStyle} type="number" placeholder="Cantidad *" value={f.cantidad} onChange={set('cantidad')} />
                        <input style={inputStyle} type="number" placeholder="Costo unitario" value={f.costo_unitario} onChange={set('costo_unitario')} />
                        <input style={inputStyle} placeholder="Número de lote" value={f.numero_lote || ''} onChange={set('numero_lote')} />
                        <input style={inputStyle} type="date" placeholder="Fecha vencimiento" value={f.fecha_vencimiento || ''} onChange={set('fecha_vencimiento')} />
                    </div>
                    <input style={inputStyle} placeholder="Notas" value={f.notas} onChange={set('notas')} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button onClick={onClose} style={btnSecondary}>Cancelar</button>
                    <button onClick={() => ajuste.mutate(f)} disabled={ajuste.isPending} style={btnStyle}>{ajuste.isPending ? 'Guardando…' : 'Guardar'}</button>
                </div>
                {ajuste.isError && <p style={{ color: '#ef4444', marginTop: '0.5rem', fontSize: '0.85rem' }}>{ajuste.error?.response?.data?.error || 'Error'}</p>}
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
const modalCard = { background: '#1e293b', borderRadius: '1rem', padding: '2rem', width: '520px', maxWidth: '90vw' };
