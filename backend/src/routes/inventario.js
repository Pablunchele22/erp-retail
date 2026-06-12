import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, audit } from '../middleware/auth.js';

const router = Router();

// Ingresar lote / recepción de mercadería
router.post('/lotes', requireAuth('admin', 'deposito', 'compras'), async (req, res) => {
    const { producto_id, variante_id, numero_lote, cantidad, costo_unitario,
            fecha_vencimiento, ubicacion, orden_compra_id } = req.body;

    if (!producto_id || !cantidad) return res.status(400).json({ error: 'Campos requeridos' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: [lote] } = await client.query(`
            INSERT INTO lotes(producto_id, variante_id, numero_lote, cantidad,
                               costo_unitario, fecha_vencimiento, ubicacion)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [producto_id, variante_id || null, numero_lote,
             cantidad, costo_unitario, fecha_vencimiento || null, ubicacion]
        );

        await client.query(`
            INSERT INTO movimientos_inventario(lote_id, producto_id, variante_id,
                                               tipo, cantidad, referencia_id, referencia_tipo, usuario_id)
            VALUES ($1,$2,$3,'entrada',$4,$5,'orden_compra',$6)`,
            [lote.id, producto_id, variante_id || null, cantidad, orden_compra_id || null, req.user.id]
        );

        await client.query('COMMIT');
        await audit(req, 'lotes', lote.id, null, lote);
        res.status(201).json(lote);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al ingresar lote' });
    } finally {
        client.release();
    }
});

// Ajuste de inventario
router.post('/ajuste', requireAuth('admin', 'deposito'), async (req, res) => {
    const { lote_id, cantidad_nueva, motivo } = req.body;

    const { rows: [lote] } = await pool.query('SELECT * FROM lotes WHERE id = $1', [lote_id]);
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

    const diff = cantidad_nueva - lote.cantidad;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE lotes SET cantidad = $1 WHERE id = $2', [cantidad_nueva, lote_id]);
        await client.query(`
            INSERT INTO movimientos_inventario(lote_id, producto_id, variante_id,
                                               tipo, cantidad, referencia_tipo, notas, usuario_id)
            VALUES ($1,$2,$3,'ajuste',$4,'ajuste',$5,$6)`,
            [lote_id, lote.producto_id, lote.variante_id, diff, motivo, req.user.id]
        );
        await client.query('COMMIT');
        res.json({ ok: true, diff });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error en ajuste' });
    } finally {
        client.release();
    }
});

// Alertas activas
router.get('/alertas', requireAuth(), async (req, res) => {
    const { rows } = await pool.query(`
        SELECT a.*, p.nombre AS producto_nombre, p.sku
        FROM alertas a
        LEFT JOIN productos p ON p.id = a.producto_id
        WHERE a.resuelta = FALSE
        ORDER BY a.creado_en DESC
        LIMIT 100`
    );
    res.json(rows);
});

router.patch('/alertas/:id/resolver', requireAuth('admin', 'deposito'), async (req, res) => {
    await pool.query('UPDATE alertas SET resuelta = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
});

// Movimientos con filtros
router.get('/movimientos', requireAuth(), async (req, res) => {
    const { producto_id, tipo, desde, hasta, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    let params = [];
    let i = 1;

    if (producto_id) { where.push(`m.producto_id = $${i++}`); params.push(producto_id); }
    if (tipo)        { where.push(`m.tipo = $${i++}`);         params.push(tipo); }
    if (desde)       { where.push(`m.creado_en >= $${i++}`);   params.push(desde); }
    if (hasta)       { where.push(`m.creado_en <= $${i++}`);   params.push(hasta); }

    const { rows } = await pool.query(`
        SELECT m.*, p.nombre AS producto_nombre, p.sku, u.nombre AS usuario_nombre
        FROM movimientos_inventario m
        JOIN productos p ON p.id = m.producto_id
        LEFT JOIN usuarios u ON u.id = m.usuario_id
        WHERE ${where.join(' AND ')}
        ORDER BY m.creado_en DESC
        LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
    );
    res.json(rows);
});

export default router;
