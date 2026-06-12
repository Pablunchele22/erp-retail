import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const TOKEN_TTL = '8h';

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Campos requeridos' });

    const { rows } = await pool.query(
        'SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE', [email.toLowerCase()]
    );
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

    await pool.query(
        `INSERT INTO sesiones(usuario_id, token_hash, ip, user_agent, expira_en)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '8 hours')`,
        [user.id, token, req.ip, req.headers['user-agent']]
    );

    res.json({
        token,
        user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    });
});

router.post('/logout', requireAuth(), async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    await pool.query('DELETE FROM sesiones WHERE token_hash = $1', [token]);
    res.json({ ok: true });
});

router.get('/me', requireAuth(), (req, res) => {
    res.json({ user: req.user });
});

export default router;
