import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { requireAuth, audit } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth('admin'), async (req, res) => {
    const { rows } = await pool.query(
        'SELECT id, email, nombre, rol, activo, creado_en FROM usuarios ORDER BY nombre'
    );
    res.json(rows);
});

router.post('/', requireAuth('admin'), async (req, res) => {
    const { email, password, nombre, rol } = req.body;
    if (!email || !password || !nombre || !rol) return res.status(400).json({ error: 'Campos requeridos' });

    const hash = bcrypt.hashSync(password, 12);
    const { rows } = await pool.query(`
        INSERT INTO usuarios(email, password_hash, nombre, rol)
        VALUES ($1,$2,$3,$4) RETURNING id, email, nombre, rol, activo, creado_en`,
        [email.toLowerCase(), hash, nombre, rol]
    );
    await audit(req, 'usuarios', rows[0].id, null, { ...rows[0], password: '***' });
    res.status(201).json(rows[0]);
});

router.put('/:id', requireAuth('admin'), async (req, res) => {
    const { nombre, rol, activo, password } = req.body;
    const updates = [];
    const params = [];
    let i = 1;

    if (nombre !== undefined)  { updates.push(`nombre=$${i++}`);  params.push(nombre); }
    if (rol !== undefined)     { updates.push(`rol=$${i++}`);      params.push(rol); }
    if (activo !== undefined)  { updates.push(`activo=$${i++}`);   params.push(activo); }
    if (password)              { updates.push(`password_hash=$${i++}`); params.push(bcrypt.hashSync(password, 12)); }

    if (!updates.length) return res.status(400).json({ error: 'Sin cambios' });

    const { rows } = await pool.query(
        `UPDATE usuarios SET ${updates.join(',')} WHERE id=$${i} RETURNING id,email,nombre,rol,activo`,
        [...params, req.params.id]
    );
    res.json(rows[0]);
});

export default router;
