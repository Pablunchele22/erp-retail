# ERP Retail

Sistema ERP para comercio minorista. Backend Node.js + PostgreSQL, frontend React + Vite.

## Arquitectura

```
ERP/
├── backend/          # API REST (Node.js + Express + ESM)
│   ├── src/
│   │   ├── index.js              # Entry point, monta todas las rutas
│   │   ├── db/pool.js            # Pool PostgreSQL
│   │   ├── middleware/auth.js    # requireAuth(roles), audit()
│   │   └── routes/
│   │       ├── auth.js           # POST /login, /logout, GET /me
│   │       ├── productos.js      # CRUD productos + lotes
│   │       ├── ventas.js         # Ventas con FIFO automático
│   │       ├── inventario.js     # Lotes, ajustes, alertas, movimientos
│   │       ├── compras.js        # Órdenes de compra + proveedores
│   │       ├── usuarios.js       # ABM usuarios (solo admin)
│   │       └── dashboard.js      # Stats del día/mes
│   └── migrations/
│       └── 001_schema.sql        # Schema completo (aplicar una vez)
└── frontend/         # React + Vite (puerto 5173)
    └── src/
        ├── api.js                # Axios con interceptors JWT
        ├── auth.jsx              # AuthContext + AuthProvider
        ├── App.jsx               # Rutas protegidas
        └── pages/
            ├── Login.jsx
            ├── Layout.jsx        # Sidebar + Outlet
            ├── Dashboard.jsx
            ├── Productos.jsx
            ├── Ventas.jsx
            ├── Inventario.jsx
            └── Compras.jsx
```

## Levantar localmente

```bash
# PostgreSQL (requiere que esté corriendo)
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
LC_ALL=en_US.UTF-8 pg_ctl -D /opt/homebrew/var/postgresql@16 -l /tmp/postgres.log start

# Backend (puerto 3001)
cd backend && npm run dev

# Frontend (puerto 5173)
cd frontend && npm run dev
```

## Primera vez (setup)

```bash
# Crear BD y aplicar schema
createdb erp_retail
psql erp_retail < backend/migrations/001_schema.sql

# Configurar env
cp backend/.env.example backend/.env
# Editar DATABASE_URL y JWT_SECRET en backend/.env

cd backend && npm install
cd frontend && npm install
```

## Variables de entorno (backend/.env)

```
DATABASE_URL=postgresql://pablosilveira@localhost:5432/erp_retail
JWT_SECRET=<secreto largo>
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## Usuario admin inicial

- **Email:** admin@erp.local
- **Password:** Admin1234!
- **Rol:** admin

## Rutas API principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/login | Login → devuelve JWT |
| GET | /api/dashboard | Stats generales |
| GET/POST | /api/productos | Listado y creación |
| GET/POST | /api/ventas | Ventas (FIFO automático) |
| PATCH | /api/ventas/:id/anular | Anular venta (admin) |
| GET | /api/inventario/stock | Stock en tiempo real |
| GET | /api/inventario/alertas | Alertas activas |
| POST | /api/inventario/lotes | Ingreso de mercadería |
| GET/POST | /api/compras | Órdenes de compra |
| PATCH | /api/compras/:id/estado | Cambiar estado OC |

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| admin | Todo |
| vendedor | Crear ventas, ver productos/clientes |
| deposito | Ajustes de inventario, recepción |
| compras | Órdenes de compra, proveedores |

## Stack técnico

- **Backend:** Node.js (ESM), Express 4, PostgreSQL 16, JWT, bcryptjs
- **Frontend:** React 18, Vite, React Router v6, TanStack Query, Axios
- **BD:** UUID PKs, triggers automáticos (numeración, stock bajo, updated_at), FIFO en ventas

## Notas importantes

- El schema incluye triggers automáticos: numeración de ventas (V-YYYYMMDD-NNNNN) y OC (OC-YYYYMM-NNNN)
- Las ventas desuentan stock en FIFO (primero en entrar, primero en salir por fecha de ingreso)
- Las alertas de stock bajo se generan automáticamente via trigger en movimientos_inventario
- PostgreSQL se instaló via Homebrew en `/opt/homebrew/opt/postgresql@16`
