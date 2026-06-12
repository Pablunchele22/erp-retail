import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, audit } from '../middleware/auth.js';

const router = Router();

// Listar productos con stock
router.get('/', requireAuth(), async (req, res) => {
    const { buscar, categoria_id, activo = 'true', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let where = ['p.activo = $1'];
    let params = [activo === 'true'];
    let i = 2;

    if (buscar) { where.push(`(p.nombre ILIKE $${i} OR p.sku ILIKE $${i})`); params.push(`%${buscar}%`); i++; }
    if (categoria_id) { where.push(`p.categoria_id = $${i}`); params.push(categoria_id); i++; }

    const { rows } = await pool.query(`
        SELECT p.*, c.nombre AS categoria, m.nombre AS marca,
               COALESCE(s.stock_total, 0) AS stock_total,
               s.proximo_vencimiento
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN marcas m ON m.id = p.marca_id
        LEFT JOIN v_stock_productos s ON s.producto_id = p.id
        WHERE ${where.join(' AND ')}
        ORDER BY p.nombre
        LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
    );

    const { rows: [{ count }] } = await pool.query(
        `SELECT COUNT(*) FROM productos p WHERE ${where.join(' AND ')}`, params
    );

    res.json({ data: rows, total: parseInt(count), page: parseInt(page), limit: parseInt(limit) });
});

router.get('/:id', requireAuth(), async (req, res) => {
    const { rows } = await pool.query(`
        SELECT p.*, c.nombre AS categoria, m.nombre AS marca,
               COALESCE(s.stock_total, 0) AS stock_total
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        LEFT JOIN marcas m ON m.id = p.marca_id
        LEFT JOIN v_stock_productos s ON s.producto_id = p.id
        WHERE p.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
});

router.post('/', requireAuth('admin', 'compras'), async (req, res) => {
    const { sku, nombre, descripcion, categoria_id, marca_id, unidad,
            precio_costo, precio_venta, stock_minimo, imagen_url } = req.body;

    const { rows } = await pool.query(`
        INSERT INTO productos(sku, nombre, descripcion, categoria_id, marca_id, unidad,
                              precio_costo, precio_venta, stock_minimo, imagen_url)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [sku, nombre, descripcion, categoria_id, marca_id, unidad,
         precio_costo, precio_venta, stock_minimo || 0, imagen_url]
    );
    await audit(req, 'productos', rows[0].id, null, rows[0]);
    res.status(201).json(rows[0]);
});

router.put('/:id', requireAuth('admin', 'compras'), async (req, res) => {
    const { rows: [antes] } = await pool.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (!antes) return res.status(404).json({ error: 'No encontrado' });

    const fields = ['nombre','descripcion','categoria_id','marca_id','unidad',
                    'precio_costo','precio_venta','stock_minimo','imagen_url','activo'];
    const updates = fields.filter(f => req.body[f] !== undefined);
    if (!updates.length) return res.status(400).json({ error: 'Sin cambios' });

    const { rows } = await pool.query(
        `UPDATE productos SET ${updates.map((f, i) => `${f} = $${i + 1}`).join(', ')}
         WHERE id = $${updates.length + 1} RETURNING *`,
        [...updates.map(f => req.body[f]), req.params.id]
    );
    await audit(req, 'productos', req.params.id, antes, rows[0]);
    res.json(rows[0]);
});

// Lotes del producto
router.get('/:id/lotes', requireAuth(), async (req, res) => {
    const { rows } = await pool.query(
        `SELECT l.*, v.atributos AS variante_atributos
         FROM lotes l
         LEFT JOIN variantes v ON v.id = l.variante_id
         WHERE l.producto_id = $1 AND l.activo = TRUE
         ORDER BY l.fecha_ingreso ASC`,
        [req.params.id]
    );
    res.json(rows);
});

export default router;
