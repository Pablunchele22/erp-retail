import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, audit } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth(), async (req, res) => {
    const { estado, proveedor_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    let params = [];
    let i = 1;

    if (estado)      { where.push(`oc.estado = $${i++}`);       params.push(estado); }
    if (proveedor_id){ where.push(`oc.proveedor_id = $${i++}`); params.push(proveedor_id); }

    const { rows } = await pool.query(`
        SELECT oc.*, p.nombre AS proveedor_nombre, u.nombre AS creado_por
        FROM ordenes_compra oc
        JOIN proveedores p ON p.id = oc.proveedor_id
        LEFT JOIN usuarios u ON u.id = oc.usuario_id
        WHERE ${where.join(' AND ')}
        ORDER BY oc.creado_en DESC
        LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
    );
    res.json(rows);
});

router.get('/:id', requireAuth(), async (req, res) => {
    const { rows: [oc] } = await pool.query(`
        SELECT oc.*, p.nombre AS proveedor_nombre
        FROM ordenes_compra oc
        JOIN proveedores p ON p.id = oc.proveedor_id
        WHERE oc.id = $1`, [req.params.id]
    );
    if (!oc) return res.status(404).json({ error: 'No encontrada' });

    const { rows: items } = await pool.query(`
        SELECT i.*, p.nombre AS producto_nombre, p.sku
        FROM ordenes_compra_items i
        JOIN productos p ON p.id = i.producto_id
        WHERE i.orden_id = $1`, [req.params.id]
    );
    res.json({ ...oc, items });
});

router.post('/', requireAuth('admin', 'compras'), async (req, res) => {
    const { proveedor_id, fecha_esperada, notas, items } = req.body;
    if (!proveedor_id || !items?.length) return res.status(400).json({ error: 'Campos requeridos' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: [oc] } = await client.query(`
            INSERT INTO ordenes_compra(proveedor_id, fecha_esperada, notas, usuario_id, numero)
            VALUES ($1,$2,$3,$4,'') RETURNING *`,
            [proveedor_id, fecha_esperada || null, notas, req.user.id]
        );

        let total = 0;
        for (const item of items) {
            const { rows: [i] } = await client.query(`
                INSERT INTO ordenes_compra_items(orden_id, producto_id, variante_id,
                                                  cantidad_pedida, precio_unitario)
                VALUES ($1,$2,$3,$4,$5) RETURNING *`,
                [oc.id, item.producto_id, item.variante_id || null,
                 item.cantidad, item.precio_unitario]
            );
            total += parseFloat(i.subtotal);
        }

        const { rows: [ocFinal] } = await client.query(
            'UPDATE ordenes_compra SET total=$1 WHERE id=$2 RETURNING *', [total, oc.id]
        );

        await client.query('COMMIT');
        res.status(201).json(ocFinal);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al crear OC' });
    } finally {
        client.release();
    }
});

router.patch('/:id/estado', requireAuth('admin', 'compras'), async (req, res) => {
    const { estado } = req.body;
    const valid = ['borrador','enviada','recibida_parcial','recibida','cancelada'];
    if (!valid.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

    const { rows } = await pool.query(
        'UPDATE ordenes_compra SET estado=$1 WHERE id=$2 RETURNING *', [estado, req.params.id]
    );
    res.json(rows[0]);
});

// Proveedores
router.get('/proveedores/lista', requireAuth(), async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM proveedores WHERE activo=TRUE ORDER BY nombre');
    res.json(rows);
});

router.post('/proveedores', requireAuth('admin', 'compras'), async (req, res) => {
    const { nombre, rut, email, telefono, direccion, contacto } = req.body;
    const { rows } = await pool.query(`
        INSERT INTO proveedores(nombre,rut,email,telefono,direccion,contacto)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [nombre, rut, email, telefono, direccion, contacto]
    );
    res.status(201).json(rows[0]);
});

export default router;
