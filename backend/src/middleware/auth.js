import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

export function requireAuth(...roles) {
    return async (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Token requerido' });

        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);

            // Verificar sesión activa en DB
            const { rows } = await pool.query(
                `SELECT u.id, u.nombre, u.email, u.rol, u.activo
                 FROM sesiones s
                 JOIN usuarios u ON u.id = s.usuario_id
                 WHERE s.token_hash = $1 AND s.expira_en > NOW()`,
                [token]
            );

            if (!rows[0] || !rows[0].activo) {
                return res.status(401).json({ error: 'Sesión inválida' });
            }

            if (roles.length && !roles.includes(rows[0].rol)) {
                return res.status(403).json({ error: 'Sin permisos' });
            }

            req.user = rows[0];
            next();
        } catch {
            res.status(401).json({ error: 'Token inválido' });
        }
    };
}

export async function audit(req, tabla, id, antes, despues) {
    try {
        await pool.query(
            `INSERT INTO auditoria(usuario_id, accion, tabla, registro_id, datos_antes, datos_despues, ip)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [req.user?.id, req.method, tabla, id,
             antes ? JSON.stringify(antes) : null,
             despues ? JSON.stringify(despues) : null,
             req.ip]
        );
    } catch (e) {
        console.error('Audit error:', e.message);
    }
}
