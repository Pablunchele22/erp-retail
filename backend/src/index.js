import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRouter      from './routes/auth.js';
import productosRouter from './routes/productos.js';
import ventasRouter    from './routes/ventas.js';
import inventarioRouter from './routes/inventario.js';
import comprasRouter   from './routes/compras.js';
import usuariosRouter  from './routes/usuarios.js';
import dashboardRouter from './routes/dashboard.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), authRouter);
app.use('/api/productos',  productosRouter);
app.use('/api/ventas',     ventasRouter);
app.use('/api/inventario', inventarioRouter);
app.use('/api/compras',    comprasRouter);
app.use('/api/usuarios',   usuariosRouter);
app.use('/api/dashboard',  dashboardRouter);

app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => console.log(`ERP backend en puerto ${PORT}`));
