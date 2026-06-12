import { useQuery } from '@tanstack/react-query';
import api from '../api';

function Stat({ label, value, sub, color = '#3b82f6' }) {
    return (
        <div style={{ background: '#1e293b', borderRadius: '0.75rem', padding: '1.25rem 1.5rem', borderLeft: `4px solid ${color}` }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.4rem' }}>{label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
            {sub && <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>{sub}</div>}
        </div>
    );
}

export default function Dashboard() {
    const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard').then(r => r.data) });

    if (isLoading) return <p style={{ color: '#94a3b8' }}>Cargando…</p>;

    const fmt = n => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(n);

    return (
        <div>
            <h2 style={{ margin: '0 0 1.5rem', color: '#f1f5f9' }}>Dashboard</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <Stat label="Ventas hoy" value={fmt(data.ventas_hoy.total)} sub={`${data.ventas_hoy.cantidad} operaciones`} color="#22c55e" />
                <Stat label="Ventas este mes" value={fmt(data.ventas_mes.total)} sub={`${data.ventas_mes.cantidad} operaciones`} color="#3b82f6" />
                <Stat label="Alertas pendientes" value={data.alertas_pendientes} color="#f59e0b" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <section>
                    <h3 style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Últimas ventas</h3>
                    <div style={{ background: '#1e293b', borderRadius: '0.75rem', overflow: 'hidden' }}>
                        {data.ultimas_ventas.length === 0 && <p style={{ color: '#64748b', padding: '1rem' }}>Sin ventas aún</p>}
                        {data.ultimas_ventas.map(v => (
                            <div key={v.numero} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #0f172a' }}>
                                <div>
                                    <div style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>{v.numero}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{v.cliente || 'Consumidor final'}</div>
                                </div>
                                <div style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(v.total)}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h3 style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Stock bajo mínimo</h3>
                    <div style={{ background: '#1e293b', borderRadius: '0.75rem', overflow: 'hidden' }}>
                        {data.productos_bajo_stock.length === 0 && <p style={{ color: '#64748b', padding: '1rem' }}>Todo en orden ✓</p>}
                        {data.productos_bajo_stock.map(p => (
                            <div key={p.sku} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #0f172a' }}>
                                <div>
                                    <div style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>{p.nombre}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{p.sku}</div>
                                </div>
                                <div style={{ color: '#ef4444', fontWeight: 600 }}>{p.stock_actual} / {p.stock_minimo}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {data.proximos_vencimientos.length > 0 && (
                    <section style={{ gridColumn: '1 / -1' }}>
                        <h3 style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Próximos vencimientos (30 días)</h3>
                        <div style={{ background: '#1e293b', borderRadius: '0.75rem', overflow: 'hidden' }}>
                            {data.proximos_vencimientos.map((v, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #0f172a' }}>
                                    <div style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>{v.producto_nombre} {v.numero_lote && `· Lote ${v.numero_lote}`}</div>
                                    <div style={{ color: '#f59e0b' }}>{new Date(v.fecha_vencimiento).toLocaleDateString('es-UY')} · {v.cantidad} unidades</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
