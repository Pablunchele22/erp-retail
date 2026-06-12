-- ============================================================
-- ERP Retail - Schema Completo v1.0
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- AUTENTICACIÓN Y AUDITORÍA
-- ============================================================

CREATE TABLE usuarios (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre        TEXT NOT NULL,
    rol           TEXT NOT NULL CHECK (rol IN ('admin','vendedor','deposito','compras')),
    activo        BOOLEAN DEFAULT TRUE,
    creado_en     TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sesiones (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    ip          TEXT,
    user_agent  TEXT,
    expira_en   TIMESTAMPTZ NOT NULL,
    creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auditoria (
    id          BIGSERIAL PRIMARY KEY,
    usuario_id  UUID REFERENCES usuarios(id),
    accion      TEXT NOT NULL,
    tabla       TEXT,
    registro_id TEXT,
    datos_antes JSONB,
    datos_despues JSONB,
    ip          TEXT,
    creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATÁLOGO
-- ============================================================

CREATE TABLE categorias (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre               TEXT NOT NULL,
    requiere_vencimiento BOOLEAN DEFAULT FALSE,
    dias_alerta_venc     INT DEFAULT 30,
    activo               BOOLEAN DEFAULT TRUE,
    creado_en            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marcas (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre    TEXT UNIQUE NOT NULL,
    activo    BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE productos (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku          TEXT UNIQUE NOT NULL,
    nombre       TEXT NOT NULL,
    descripcion  TEXT,
    categoria_id UUID REFERENCES categorias(id),
    marca_id     UUID REFERENCES marcas(id),
    unidad       TEXT DEFAULT 'unidad',
    precio_costo NUMERIC(12,2),
    precio_venta NUMERIC(12,2) NOT NULL,
    stock_minimo NUMERIC(12,3) DEFAULT 0,
    activo       BOOLEAN DEFAULT TRUE,
    imagen_url   TEXT,
    creado_en    TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE variantes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    sku_var     TEXT UNIQUE NOT NULL,
    atributos   JSONB NOT NULL DEFAULT '{}',  -- {"color":"rojo","talle":"M"}
    precio_dif  NUMERIC(12,2) DEFAULT 0,
    activo      BOOLEAN DEFAULT TRUE,
    creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVENTARIO
-- ============================================================

CREATE TABLE lotes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id     UUID NOT NULL REFERENCES productos(id),
    variante_id     UUID REFERENCES variantes(id),
    numero_lote     TEXT,
    cantidad        NUMERIC(12,3) NOT NULL DEFAULT 0,
    costo_unitario  NUMERIC(12,4),
    fecha_ingreso   DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    ubicacion       TEXT,
    activo          BOOLEAN DEFAULT TRUE,
    creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE movimientos_inventario (
    id             BIGSERIAL PRIMARY KEY,
    lote_id        UUID NOT NULL REFERENCES lotes(id),
    producto_id    UUID NOT NULL REFERENCES productos(id),
    variante_id    UUID REFERENCES variantes(id),
    tipo           TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste','devolucion')),
    cantidad       NUMERIC(12,3) NOT NULL,
    referencia_id  TEXT,
    referencia_tipo TEXT,  -- 'venta','orden_compra','ajuste'
    usuario_id     UUID REFERENCES usuarios(id),
    notas          TEXT,
    creado_en      TIMESTAMPTZ DEFAULT NOW()
);

-- Vista de stock en tiempo real
CREATE VIEW v_stock_productos AS
SELECT
    p.id AS producto_id,
    p.sku,
    p.nombre,
    p.stock_minimo,
    c.nombre AS categoria,
    c.requiere_vencimiento,
    COALESCE(SUM(l.cantidad), 0) AS stock_total,
    COUNT(DISTINCT l.id) FILTER (WHERE l.cantidad > 0) AS lotes_activos,
    MIN(l.fecha_vencimiento) FILTER (WHERE l.fecha_vencimiento IS NOT NULL AND l.cantidad > 0) AS proximo_vencimiento
FROM productos p
LEFT JOIN categorias c ON c.id = p.categoria_id
LEFT JOIN lotes l ON l.producto_id = p.id AND l.activo = TRUE
WHERE p.activo = TRUE
GROUP BY p.id, p.sku, p.nombre, p.stock_minimo, c.nombre, c.requiere_vencimiento;

-- ============================================================
-- PROVEEDORES Y COMPRAS
-- ============================================================

CREATE TABLE proveedores (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre     TEXT NOT NULL,
    rut        TEXT,
    email      TEXT,
    telefono   TEXT,
    direccion  TEXT,
    contacto   TEXT,
    activo     BOOLEAN DEFAULT TRUE,
    creado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ordenes_compra (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero         TEXT UNIQUE NOT NULL,
    proveedor_id   UUID NOT NULL REFERENCES proveedores(id),
    estado         TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador','enviada','recibida_parcial','recibida','cancelada')),
    fecha_emision  DATE DEFAULT CURRENT_DATE,
    fecha_esperada DATE,
    total          NUMERIC(12,2) DEFAULT 0,
    notas          TEXT,
    usuario_id     UUID REFERENCES usuarios(id),
    creado_en      TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ordenes_compra_items (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orden_id       UUID NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    producto_id    UUID NOT NULL REFERENCES productos(id),
    variante_id    UUID REFERENCES variantes(id),
    cantidad_pedida  NUMERIC(12,3) NOT NULL,
    cantidad_recibida NUMERIC(12,3) DEFAULT 0,
    precio_unitario  NUMERIC(12,4) NOT NULL,
    subtotal         NUMERIC(12,2) GENERATED ALWAYS AS (cantidad_pedida * precio_unitario) STORED
);

-- ============================================================
-- VENTAS
-- ============================================================

CREATE TABLE clientes (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre     TEXT NOT NULL,
    documento  TEXT,
    email      TEXT,
    telefono   TEXT,
    direccion  TEXT,
    activo     BOOLEAN DEFAULT TRUE,
    creado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ventas (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero       TEXT UNIQUE NOT NULL,
    cliente_id   UUID REFERENCES clientes(id),
    estado       TEXT DEFAULT 'completada' CHECK (estado IN ('pendiente','completada','anulada','devolucion')),
    subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
    descuento    NUMERIC(12,2) DEFAULT 0,
    impuestos    NUMERIC(12,2) DEFAULT 0,
    total        NUMERIC(12,2) NOT NULL DEFAULT 0,
    medio_pago   TEXT CHECK (medio_pago IN ('efectivo','tarjeta','transferencia','cuenta_corriente')),
    notas        TEXT,
    usuario_id   UUID REFERENCES usuarios(id),
    creado_en    TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ventas_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venta_id        UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id     UUID NOT NULL REFERENCES productos(id),
    variante_id     UUID REFERENCES variantes(id),
    lote_id         UUID REFERENCES lotes(id),
    cantidad        NUMERIC(12,3) NOT NULL,
    precio_unitario NUMERIC(12,4) NOT NULL,
    descuento_pct   NUMERIC(5,2) DEFAULT 0,
    subtotal        NUMERIC(12,2) GENERATED ALWAYS AS (
                        ROUND(cantidad * precio_unitario * (1 - descuento_pct/100), 2)
                    ) STORED
);

-- ============================================================
-- ALERTAS
-- ============================================================

CREATE TABLE alertas (
    id          BIGSERIAL PRIMARY KEY,
    tipo        TEXT NOT NULL CHECK (tipo IN ('stock_bajo','vencimiento_proximo','vencimiento_hoy','sin_stock')),
    producto_id UUID REFERENCES productos(id),
    lote_id     UUID REFERENCES lotes(id),
    mensaje     TEXT NOT NULL,
    resuelta    BOOLEAN DEFAULT FALSE,
    creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_lotes_producto ON lotes(producto_id) WHERE activo = TRUE;
CREATE INDEX idx_lotes_vencimiento ON lotes(fecha_vencimiento) WHERE activo = TRUE AND fecha_vencimiento IS NOT NULL;
CREATE INDEX idx_movimientos_producto ON movimientos_inventario(producto_id);
CREATE INDEX idx_movimientos_fecha ON movimientos_inventario(creado_en DESC);
CREATE INDEX idx_ventas_fecha ON ventas(creado_en DESC);
CREATE INDEX idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX idx_alertas_no_resuelta ON alertas(producto_id) WHERE resuelta = FALSE;
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id, creado_en DESC);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Numeración automática ventas
CREATE OR REPLACE FUNCTION gen_numero_venta() RETURNS TRIGGER AS $$
BEGIN
    NEW.numero := 'V-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                  LPAD(NEXTVAL('seq_ventas')::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS seq_ventas START 1;
CREATE TRIGGER trg_numero_venta
    BEFORE INSERT ON ventas
    FOR EACH ROW WHEN (NEW.numero IS NULL OR NEW.numero = '')
    EXECUTE FUNCTION gen_numero_venta();

-- Numeración automática OC
CREATE OR REPLACE FUNCTION gen_numero_oc() RETURNS TRIGGER AS $$
BEGIN
    NEW.numero := 'OC-' || TO_CHAR(NOW(), 'YYYYMM') || '-' ||
                  LPAD(NEXTVAL('seq_oc')::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS seq_oc START 1;
CREATE TRIGGER trg_numero_oc
    BEFORE INSERT ON ordenes_compra
    FOR EACH ROW WHEN (NEW.numero IS NULL OR NEW.numero = '')
    EXECUTE FUNCTION gen_numero_oc();

-- Alerta de stock bajo después de movimiento
CREATE OR REPLACE FUNCTION chk_stock_bajo() RETURNS TRIGGER AS $$
DECLARE
    v_stock NUMERIC;
    v_minimo NUMERIC;
    v_nombre TEXT;
BEGIN
    SELECT COALESCE(SUM(l.cantidad), 0), p.stock_minimo, p.nombre
    INTO v_stock, v_minimo, v_nombre
    FROM lotes l
    JOIN productos p ON p.id = l.producto_id
    WHERE l.producto_id = NEW.producto_id AND l.activo = TRUE
    GROUP BY p.stock_minimo, p.nombre;

    IF v_stock <= v_minimo THEN
        INSERT INTO alertas(tipo, producto_id, mensaje)
        VALUES (
            CASE WHEN v_stock = 0 THEN 'sin_stock' ELSE 'stock_bajo' END,
            NEW.producto_id,
            v_nombre || ': stock ' || v_stock || ' (mínimo ' || v_minimo || ')'
        )
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_bajo
    AFTER INSERT OR UPDATE ON movimientos_inventario
    FOR EACH ROW
    EXECUTE FUNCTION chk_stock_bajo();

-- Updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.actualizado_en = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upd_usuarios   BEFORE UPDATE ON usuarios   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_productos  BEFORE UPDATE ON productos  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_ventas     BEFORE UPDATE ON ventas     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_upd_oc         BEFORE UPDATE ON ordenes_compra FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- DATOS INICIALES
-- ============================================================

INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES
('admin@erp.local', crypt('Admin1234!', gen_salt('bf')), 'Administrador', 'admin');

INSERT INTO categorias (nombre, requiere_vencimiento, dias_alerta_venc) VALUES
('Alimentos',       TRUE,  60),
('Bebidas',         TRUE,  30),
('Limpieza',        FALSE, 30),
('Electrónica',     FALSE, 0),
('Indumentaria',    FALSE, 0),
('Farmacia',        TRUE,  90);

INSERT INTO marcas (nombre) VALUES
('Genérico'), ('Arcor'), ('Unilever'), ('Procter & Gamble'), ('Samsung'), ('Adidas');
