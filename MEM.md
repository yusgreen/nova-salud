# MEM.md - Memoria Persistente del Proyecto Nova Salud

> Este archivo es la memoria persistente del sistema. Todo agente debe leerlo al
> inicio de cada tarea y actualizarlo cuando existan cambios relevantes de
> arquitectura, decisiones de diseno, modulos clave o convenciones de codigo.

## Informacion general

- **Proyecto:** Nova Salud - sistema de inventario y ventas en tiempo real.
- **Foco:** API REST + Socket.io (backend) y panel React (frontend) para gestion de inventario/ventas.

## Arquitectura

- **Backend** (`back/`): Node.js + Express 5 + Socket.io 4 + Prisma 6 + SQLite.
  - Entry: `back/src/index.js` (crea HTTP server + Socket.io juntos, monta `attachIo` antes de rutas).
  - Rutas: `/auth`, `/products`, `/sales`, `/audit`, `/settings`.
  - Sockets: `back/src/sockets/inventorySocket.js` (tiempo real de inventario).
  - Middleware: `authMiddleware.js`, `attachIo.js`.
  - Util: auditoria en `back/src/utils/audit.js`.
- **Frontend** (`front/`): React 18 + Vite 5 + socket.io-client.
  - Entry: `front/src/App.jsx`, `front/src/main.jsx`.
  - Pages: `Login.jsx`, `Register.jsx`.
  - Components: Dashboard, Inventario, Caja, Ventas, Auditoria, Configuracion, AuthLayout, Topbar, Modal, Toast, ConfirmDialog, ProductForm, Skeleton, Icons, Illustrations.
  - Contexts: AuthContext, ConfigContext, ProductContext, SaleContext, SalesContext.
  - Services: `api.js`, `export.js`, `format.js`, `socket.js`.

## Estructura de carpetas

```
nova-salud/
├── back/
│   ├── src/
│   │   ├── index.js
│   │   ├── prisma.js
│   │   ├── config/      # auth.js
│   │   ├── controllers/# auth, product, sale, audit, settings
│   │   ├── middleware/  # authMiddleware, attachIo
│   │   ├── routes/      # auth, products, sales, audit, settings
│   │   ├── sockets/     # inventorySocket.js
│   │   └── utils/       # audit.js
│   ├── tests/           # critical.test.js, prepare-db.js (node:test)
│   └── prisma/          # schema.prisma, seed.js, dev.db / test.db (SQLite)
├── front/
│   ├── src/
│   │   ├── App.jsx, main.jsx, styles.css
│   │   ├── components/, context/, hooks/, pages/, services/
│   ├── index.html, vite.config.js, .env
└── (raiz) package.json, README.md, NOTAS.md
```

## Modulos y flujos clave

- **Auth:** JWT + bcryptjs; roles `admin | farmaceutico | cajero`; `passwordHash` en BD.
- **Inventario:** productos con `stock`, `stockMinimo`, `codigo` (SKU unico, autogenerado `P-0001` si se omite), `codigoBarras` unico, `categoria`, `proveedor`, `unidad`, `precioCompra` y `fechaVencimiento`; alertas de reposicion. La busqueda de Caja cubre nombre, descripcion, codigo, codigo de barras y categoria.
- **Trazabilidad de stock:** `MovimientoStock` registra `INICIAL` (creacion), `AJUSTE` (edicion de stock) y `VENTA` (delta negativo), con stock anterior/nuevo y usuario. `GET /products/:id/movimientos` exige admin o farmaceutico.
- **Ventas:** ticket `Venta` + `DetalleVenta`; `precioUnitario` congelado al vender; FK `usuarioId`.
- **Auditoria:** `AuditLog` con acciones `LOGIN`, `LOGIN_FALLIDO`, `REGISTER`, `SALE_CREATE`, `PRODUCT_*`, `CONFIG_UPDATE`. `PRODUCT_UPDATE` guarda en `detalle.cambios` el valor anterior y nuevo de cada campo modificado.
- **Configuracion (solo admin):** seccion en el menu debajo de Auditoria. Edita `nombreNegocio`, `lema`, `moneda`, `umbralStockBajo` (default para productos nuevos) y `mostrarAyudaDemo`. Persiste en `Configuracion` (fila unica id=1); `GET /settings` es publico y `PUT /settings` exige rol admin. El nombre/lema se aplican en sidebar y Login/Register, la moneda en Caja/Dashboard/Inventario/Ventas y en el Excel.

## Pruebas

- `back/tests/critical.test.js`: login valido/fallido + auditoria, `/auth/me`, permisos por rol, venta atomica (precio de BD, descuento de stock, rollback por stock insuficiente), rechazo de lineas invalidas, validacion de CRUD de productos, codigos unicos, fechas, movimientos de stock y diff de auditoria.
- `back/tests/prepare-db.js`: crea/sincroniza `test.db` con `DATABASE_URL=file:./test.db`; se ejecuta en `pretest`.
- Importan `src/index.js`, escuchan en puerto efimero y cierran socket/servidor/Prisma en `after`.
- Cubren tambien configuracion: lectura publica, PUT solo admin, validaciones y auditoria `CONFIG_UPDATE`.

## Decisiones de diseno

- SQLite en dev (`back/prisma/dev.db`), PostgreSQL en prod.
- `rol` como `String` (SQLite no soporta enums nativos en Prisma).
- Express 5 + `http.createServer` unificado para Socket.io.
- API en `localhost:4000`; Vite en `localhost:5173` (abre browser automatico).
- Env vars frontend: `VITE_API_URL`, `VITE_SOCKET_URL`.
- `back/src/index.js` exporta `{ app, server, io }` y solo hace `listen` si es el modulo principal (`require.main === module`), para poder testear sin puerto fijo.
- Validacion estricta en backend: producto con precio/stock numericos no negativos; venta rechaza toda la peticion si una linea es invalida (no ignora lineas en silencio).
- Auditoria: `LOGIN_FALLIDO` solo se registra cuando el login realmente falla, con `userId` si el email existe.
- Pruebas con `node:test` + `fetch` nativo y base aislada `back/prisma/test.db` (nunca tocan `dev.db`).
- Caja rediseñada como modulo POS oscuro premium: estilos scopeados en `.caja-page` con tokens propios (`--c-*`) para no afectar otras vistas; layout responsive en 1180/980/640 px.
- Formulario de producto modal amplio (880 px, hoja completa en <=760 px): dos columnas formulario + vista previa sticky; secciones Datos/Precio e inventario/Presentacion; validacion inline por campo con boton deshabilitado; aviso de cambios sin guardar; historial de movimientos en edicion. La imagen acepta URL o ruta (sin subida de archivos). Las filas numericas usan 2 o 3 columnas iguales (`minmax(0,1fr)`) y pasan a 1 columna en <=560 px; evitar filas mixtas 2+1.
- `Modal` atrapa el foco, cierra con Escape, restaura el foco al salir y bloquea el scroll del fondo. Reutilizarlo en vez de crear overlays nuevos.
- Ilustraciones SVG propias en `Illustrations.jsx` con variables CSS (`--accent`, `--accent-soft`, `--card`, `--border`, `--text`), sin dependencias ni archivos externos. Se usan en el panel de Login/Register (`AuthLayout`), hero del Dashboard y estados vacios de Inventario, Ventas y Auditoria; en movil se ocultan las decoraciones grandes.

## Convenciones de codigo

- Backend: CommonJS (`"type": "commonjs"`); rutas en plural; un controller por recurso; middleware de auth.
- Frontend: ESM (`"type": "module"`); JSX; contexts para estado global; services para API/socket.
- Comentarios en espanol; estilo explicativo pero directo.
- Prisma schema: cuidado — "Angel + Qwen" son duenos; Marlon y Brat no edita sin avisar.

## Comandos

- Backend: `npm run dev`, `npm test`, `npm run db:push`, `npm run db:seed`, `npm run db:studio`.
- Frontend: `npm run dev`, `npm run build`.
- Tests: `cd back && npm test` (26 pruebas: auth/auditoria, roles, ventas atomicas, validacion de productos, inventario ampliado/trazabilidad y configuracion).

## Archivos de apoyo

- `README.md` — documentacion principal (42KB).
- `NOTAS.md` — notas rapidas de desarrollo.
