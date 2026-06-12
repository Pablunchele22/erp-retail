import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, audit } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth(), async (req, res) => {
    const { desde, hasta, cliente_id, estado, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    let params = [];
    let i = 1;

    if (desde)      { where.push(`v.creado_en >= $${i++}`); params.push(desde); }
    if (hasta)      { where.push(`v.creado_en <= $${i++}`); params.push(hasta); }
    if (cliente_id) { where.push(`v.cliente_id = $${i++}`); params.push(cliente_id); }
    if (estado)     { where.push(`v.estado = $${i++}`);     params.push(estado); }

    const { rows } = await pool.query(`
        SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS vendedor
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN usuarios u ON u.id = v.usuario_id
        WHERE ${where.join(' AND ')}
        ORDER BY v.creado_en DESC
        LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
    );
    const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM ventas v WHERE ${where.join(' AND ')}`, params
    );
    res.json({ data: rows, total: parseInt(count) });
});

router.get('/:id', requireAuth(), async (req, res) => {
    const { rows: [venta] } = await pool.query(`
        SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS vendedor
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN usuarios u ON u.id = v.usuario_id
        WHERE v.id = $1`, [req.params.id]
    );
    if (!venta) return res.status(404).json({ error: 'No encontrada' });

    const { rows: items } = await pool.query(`
        SELECT vi.*, p.nombre AS producto_nombre, p.sku,
               l.numero_lote, v.atributos AS variante_atributos
        FROM ventas_items vi
        JOIN productos p ON p.id = vi.producto_id
        LEFT JOIN lotes l ON l.id = vi.lote_id
        LEFT JOIN variantes v ON v.id = vi.variante_id
        WHERE vi.venta_id = $1`, [req.params.id]
    );
    res.json({ ...venta, items });
});

// Crear venta con FIFO automático
router.post('/', requireAuth('admin', 'vendedor'), async (req, res) => {
    const { cliente_id, items, descuento = 0, medio_pago, notas } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'Sin items' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Crear cabecera de venta
        const { rows: [venta] } = await client.query(`
            INSERT INTO ventas(cliente_id, descuento, medio_pago, notas, usuario_id, numero)
            VALUES ($1, $2, $3, $4, $5, '')
            RETURNING *`,
            [cliente_id, descuento, medio_pago, notas, req.user.id]
        );

        let subtotal = 0;
        const ventaItems = [];

        for (const item of items) {
            let restante = item.cantidad;

            // FIFO: tomar lotes ordenados por fecha_ingreso ASC
            const { rows: lotes } = await client.query(`
                SELECT id, cantidad FROM lotes
                WHERE producto_id = $1
                  AND ($2::uuid IS NULL OR variante_id = $2)
                  AND activo = TRUE AND cantidad > 0
                ORDER BY fecha_ingreso ASC`,
                [item.producto_id, item.variante_id || null]
            );

            for (const lote of lotes) {
                if (restante <= 0) break;
                const usar = Math.min(restante, lote.cantidad);

                await client.query('UPDATE lotes SET cantidad = cantidad - $1 WHERE id = $2', [usar, lote.id]);

                const { rows: [vi] } = await client.query(`
                    INSERT INTO ventas_items(venta_id, producto_id, variante_id, lote_id,
                                             cantidad, precio_unitario, descuento_pct)
                    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                    [venta.id, item.producto_id, item.variante_id || null, lote.id,
                     usar, item.precio_unitario, item.descuento_pct || 0]
                );

                await client.query(`
                    INSERT INTO movimientos_inventario(lote_id, producto_id, variante_id,
                                                        tipo, cantidad, referencia_id, referencia_tipo, usuario_id)
                    VALUES ($1,$2,$3,'salida',$4,$5,'venta',$6)`,
                    [lote.id, item.producto_id, item.variante_id || null, usar, venta.id, req.user.id]
                );

                subtotal += parseFloat(vi.subtotal);
                ventaItems.push(vi);
                restante -= usar;
            }

            if (restante > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Stock insuficiente para producto ${item.producto_id}` });
            }
        }

        const impuestos = 0;
        const total = subtotal - descuento + impuestos;

        const { rows: [ventaFinal] } = await client.query(`
            UPDATE ventas SET subtotal=$1, impuestos=$2, total=$3, estado='completada'
            WHERE id=$4 RETURNING *`,
            [subtotal, impuestos, total, venta.id]
        );

        await client.query('COMMIT');
        await audit(req, 'ventas', ventaFinal.id, null, ventaFinal);
        res.status(201).json({ ...ventaFinal, items: ventaItems });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        res.status(500).json({ error: 'Error al crear venta' });
    } finally {
        client.release();
    }
});

router.patch('/:id/anular', requireAuth('admin'), async (req, res) => {
    const { rows: [venta] } = await pool.query('SELECT * FROM ventas WHERE id = $1', [req.params.id]);
    if (!venta) return res.status(404).json({ error: 'No encontrada' });
    if (venta.estado === 'anulada') return res.status(400).json({ error: 'Ya anulada' });

    const { rows } = await pool.query(
        "UPDATE ventas SET estado='anulada' WHERE id=$1 RETURNING *", [req.params.id]
    );
    await audit(req, 'ventas', req.params.id, venta, rows[0]);
    res.json(rows[0]);
});

export default router;
