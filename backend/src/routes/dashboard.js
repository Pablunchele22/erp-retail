import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth(), async (req, res) => {
    const [
        { rows: [ventas_hoy] },
        { rows: [ventas_mes] },
        { rows: [alertas] },
        { rows: productos_bajo_stock },
        { rows: ultimas_ventas },
        { rows: proximos_venc }
    ] = await Promise.all([
        pool.query(`
            SELECT COUNT(*) AS cantidad, COALESCE(SUM(total),0) AS total
            FROM ventas WHERE estado='completada' AND creado_en::date = CURRENT_DATE`),
        pool.query(`
            SELECT COUNT(*) AS cantidad, COALESCE(SUM(total),0) AS total
            FROM ventas WHERE estado='completada'
            AND DATE_TRUNC('month', creado_en) = DATE_TRUNC('month', NOW())`),
        pool.query(`SELECT COUNT(*) AS total FROM alertas WHERE resuelta=FALSE`),
        pool.query(`
            SELECT p.sku, p.nombre, p.stock_minimo, COALESCE(SUM(l.cantidad),0) AS stock_actual
            FROM productos p LEFT JOIN lotes l ON l.producto_id=p.id AND l.activo=TRUE
            WHERE p.activo=TRUE GROUP BY p.id, p.sku, p.nombre, p.stock_minimo
            HAVING COALESCE(SUM(l.cantidad),0) <= p.stock_minimo
            ORDER BY COALESCE(SUM(l.cantidad),0) ASC LIMIT 5`),
        pool.query(`
            SELECT v.numero, v.total, v.creado_en, c.nombre AS cliente
            FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id
            WHERE v.estado='completada' ORDER BY v.creado_en DESC LIMIT 5`),
        pool.query(`
            SELECT l.fecha_vencimiento, l.numero_lote, l.cantidad,
                   p.nombre AS producto_nombre, p.sku
            FROM lotes l JOIN productos p ON p.id=l.producto_id
            WHERE l.activo=TRUE AND l.cantidad > 0
              AND l.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
            ORDER BY l.fecha_vencimiento ASC LIMIT 10`)
    ]);

    res.json({
        ventas_hoy,
        ventas_mes,
        alertas_pendientes: parseInt(alertas.total),
        productos_bajo_stock,
        ultimas_ventas,
        proximos_vencimientos: proximos_venc
    });
});

export default router;
