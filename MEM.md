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
  - Rutas: `/auth`, `/products`, `/sales`, `/audit`, `/settings`, `/users`. `GET /sales/cierre` para cierre de caja.
  - Sockets: `back/src/sockets/inventorySocket.js` (tiempo real de inventario).
  - Middleware: `authMiddleware.js`, `attachIo.js`.
  - Util: auditoria en `back/src/utils/audit.js`.
- **Frontend** (`front/`): React 18 + Vite 5 + socket.io-client.
  - Entry: `front/src/App.jsx`, `front/src/main.jsx`.
  - Pages: `Login.jsx`, `Register.jsx`.
  - Components: Dashboard, Inventario, Caja, Ventas, CierreCaja, Auditoria, Configuracion, Usuarios, Comprobante, AuthLayout, Topbar, ProfileModal, Modal, Toast, ConfirmDialog, ProductForm, Skeleton, Icons, Illustrations.
  - Contexts: AuthContext, ConfigContext, ProductContext, SaleContext, SalesContext, ThemeContext, PreferenciasContext, ToastContext.
  - Services: `api.js`, `export.js`, `format.js`, `socket.js`, `vencimientos.js`.

## Estructura de carpetas

```
nova-salud/
├── back/
│   ├── src/
│   │   ├── index.js
│   │   ├── prisma.js
│   │   ├── config/      # auth.js
│   │   ├── controllers/# auth, product, sale, audit, settings, user
│   │   ├── middleware/  # authMiddleware, attachIo
│   │   ├── routes/      # auth, products, sales, audit, settings, users
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

- **Auth:** JWT + bcryptjs; roles `admin | farmaceutico | cajero`; `passwordHash` en BD; `activo Boolean @default(true)`. `PUT /auth/me` actualiza el nombre y `PUT /auth/password` valida la contraseña actual y exige mínimo 6 caracteres; ambas respuestas omiten `passwordHash`. El login rechaza usuarios inactivos con mensaje neutro y registra `LOGIN_FALLIDO`; `authMiddleware` consulta la BD y rechaza tokens de usuarios inactivos o con rol cambiado.
- **Inventario:** productos con `stock`, `stockMinimo`, `codigo` (SKU unico, autogenerado `P-0001` si se omite), `codigoBarras` unico, `categoria`, `proveedor`, `unidad`, `precioCompra`, `fechaVencimiento` y `activo` (default true). Alertas de reposicion. La busqueda de Caja cubre nombre, descripcion, codigo, codigo de barras y categoria. Inventario muestra badges `Vence pronto` (<=30 dias) y `Vencido`, filtro por estado y conteos; ignora productos sin fecha. Los inactivos se atenúan y se filtran con "Mostrar inactivos"; Caja y alertas excluyen inactivos. Se puede recibir mercadería con `POST /products/:id/entrada`, que suma stock, crea `MovimientoStock` tipo `ENTRADA` y audita `STOCK_ENTRY`. El Dashboard muestra el total por vencer/vencidos y los 5 vencimientos mas cercanos.
- **Trazabilidad de stock:** `MovimientoStock` registra `INICIAL` (creacion), `AJUSTE` (edicion de stock) y `VENTA` (delta negativo), con stock anterior/nuevo y usuario. `GET /products/:id/movimientos` exige admin o farmaceutico.
- **Ventas:** ticket `Venta` + `DetalleVenta`; `precioUnitario` congelado al vender; FK `usuarioId`. `Venta` incluye `metodoPago` (`EFECTIVO|TARJETA|YAPE_PLIN`, default `EFECTIVO`), `montoRecibido` y `vuelto` opcionales, y `estado` (`COMPLETADA|ANULADA`, default `COMPLETADA`) con `anuladaPorId`, `anuladaEn` y `motivoAnulacion`. `GET /sales` y `GET /sales/export` aceptan query params opcionales `desde`, `hasta` y `usuarioId`; el Excel excluye las anuladas. `POST /sales/:id/anular` (admin/farmaceutico) anula en transacción, repone stock, crea `MovimientoStock` tipo `ANULACION` y emite `venta_anulada`. `GET /sales/cierre?fecha=&usuarioId=` resume ventas completadas por método, efectivo esperado y anuladas; los cajeros solo ven las propias. La vista Ventas muestra anuladas tachadas con badge y motivo; el Dashboard excluye anuladas.
- **Auditoria:** `AuditLog` con acciones `LOGIN`, `LOGIN_FALLIDO`, `REGISTER`, `SALE_CREATE`, `SALE_VOID`, `PRODUCT_*`, `STOCK_ENTRY`, `CONFIG_UPDATE`, `PROFILE_UPDATE`, `PASSWORD_CHANGE`, `USER_CREATE`, `USER_UPDATE`, `USER_STATUS`. `PRODUCT_UPDATE` guarda en `detalle.cambios` el valor anterior y nuevo de cada campo modificado; `PROFILE_UPDATE` hace lo mismo con el nombre; `USER_*` guarda el diff de nombre/rol/estado; `SALE_VOID` guarda el motivo; `STOCK_ENTRY` guarda cantidad, proveedor, motivo y stock anterior/nuevo. Nunca se guardan contraseñas ni hashes.
- **Configuracion (solo admin):** seccion en el menu debajo de Auditoria. Edita `nombreNegocio`, `lema`, `moneda`, `umbralStockBajo` (default para productos nuevos) y `mostrarAyudaDemo`. Persiste en `Configuracion` (fila unica id=1); `GET /settings` es publico y `PUT /settings` exige rol admin. El nombre/lema se aplican en sidebar y Login/Register, la moneda en Caja/Dashboard/Inventario/Ventas y en el Excel.
- **Gestión de usuarios (solo admin):** pestaña `Usuarios` con tabla de nombre/email, select de rol, switch de estado con ConfirmDialog y modal "Nuevo usuario". Endpoints `/users` (GET/POST), `/users/:id` (PUT nombre/rol) y `/users/:id/estado` (PUT activo). El admin no puede desactivarse ni cambiarse el rol a sí mismo; debe quedar al menos un admin activo. Los usuarios nuevos y existentes quedan activos por defecto.

## Pruebas

- `back/tests/critical.test.js`: login valido/fallido + auditoria, `/auth/me`, permisos por rol, venta atomica (precio de BD, descuento de stock, rollback por stock insuficiente), rechazo de lineas invalidas, validacion de CRUD de productos, codigos unicos, fechas, movimientos de stock y diff de auditoria.
- `back/tests/critical.test.js`: gestión de usuarios (permisos por rol, listado sin `passwordHash`, creación con rol elegido y auditoría, actualización con diff, desactivación y rechazo de login/token inactivo, protección del último admin activo).
- `back/tests/prepare-db.js`: crea/sincroniza `test.db` con `DATABASE_URL=file:./test.db`; se ejecuta en `pretest`.
- Importan `src/index.js`, escuchan en puerto efimero y cierran socket/servidor/Prisma en `after`.
- Cubren tambien configuracion: lectura publica, PUT solo admin, validaciones y auditoria `CONFIG_UPDATE`.
- Cubren perfil propio: cambio de nombre, rechazo de nombre vacio, cambio de contraseña valido/invalido, minimo 6 caracteres, auditoria `PROFILE_UPDATE`/`PASSWORD_CHANGE` y ausencia de `passwordHash` en las respuestas.
- Cubren filtros de ventas: `GET /sales` sin filtros, por rango de fechas inclusivo y por `usuarioId`.

## Decisiones de diseno

- SQLite en dev (`back/prisma/dev.db`) y en Render (PostgreSQL como mejora futura).
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
- UI rediseñada con identidad verde esmeralda: tokens en `:root` (claro) y `[data-theme="dark"]` (`--accent`, `--accent-dark`, `--accent-soft`, `--success`, `--warning`, `--danger`, `--info`, radios y sombras). `--warn` se mantiene como alias de `--warning`.
- Sistema de temas: preferencia `light | dark | system` persistida en `localStorage` (`nova_theme`), aplicada como `data-theme` en `<html>` con script inline anti-parpadeo en `index.html`; `system` sigue `prefers-color-scheme`. Selector en Configuración y botón cíclico en la Topbar visible para todos los roles.
- Sesión vencida: `api.js` centraliza los 401 de peticiones autenticadas, limpia el token una sola vez (flag anti-bucles), emite `nova:session-expired` y muestra un Toast global; AuthContext limpia el usuario y App vuelve al Login.
- Perfil propio: modal desde el nombre en la Topbar; cambio de nombre y de contraseña con validación local (confirmación y mínimo 6) y feedback con Toast reutilizado.
- Gestión de usuarios: el switch de estado usa ConfirmDialog antes de desactivar; el select de rol se deshabilita para el propio usuario; la tabla reutiliza el estilo de auditoría/ventas y muestra un badge "Tú". Los cambios de rol y estado se auditan con diff.
- Vencimientos: helper `services/vencimientos.js` normaliza fechas sin hora en calendario local; `<=30 dias` es "pronto", `<0` es "vencido"; los productos sin fecha se ignoran.
- Ventas: el historial completo vive en SalesContext para el Dashboard; la vista Ventas filtra en cliente y pagina con `filasPorPagina`; el Excel se filtra en backend con los mismos query params, enviando `desde`/`hasta` como ISO con la hora local del navegador.
- Caja: selector de método de pago y campo "Recibido" con vuelto en vivo para efectivo. `POST /sales` valida `montoRecibido >= total` en efectivo y calcula el vuelto en backend; sin los campos nuevos funciona como antes. Tras registrar se abre un Modal con `Comprobante` (ticket imprimible con `window.print()` y CSS `@media print`); reimprimible desde Ventas.
- Anulación: `ConfirmDialog` exige motivo de al menos 5 caracteres; el backend anula en una transacción, repone stock y emite `stock_actualizado` y `venta_anulada`; las vistas se actualizan en vivo y las ventas anuladas quedan tachadas con badge y motivo.
- Animaciones CSS (150-300 ms) con respeto a `prefers-reduced-motion`: transición de vista, hover/active, entrada escalonada, shimmer, modal/overlay, toast y contadores animados.
- Configuración ampliada con pestañas Apariencia/Preferencias/Sistema: apariencia (tema, modo compacto, tamaño de fuente) y preferencias (formato de fecha, filas por página) en `localStorage` (`nova_prefs`); lo global (BD) queda en la pestaña Sistema y solo admin.
- Textos visibles en español neutro (tuteo, sin regionalismos como "acá"→"aquí", "tenés"→"tienes", "creá"→"crea").
- Etiquetas de auditoria centralizadas en `Auditoria.jsx` (`ETIQUETA_ACCION`), con filtro por codigo real y detalle renderizado como pares "clave: valor" (sin JSON crudo); `PRODUCT_UPDATE` muestra "campo: antes → después".
- Tokens `--c-*` de `.caja-page` derivados de `--bg`, `--card`, `--border` y `--accent` (paleta verde) para tema claro y oscuro; sin hex azul ni gradientes azules en Caja.
- Componente switch verde reutilizable (`.status-switch`) para toggles (Usuarios, Configuración compacto/demo); checkboxes estilizados con `accent-color: var(--accent)`.
- Regla de archivos: guardar en UTF-8 sin BOM; no usar PowerShell `Set-Content`/`Out-File` para escribirlos.
- Auditoría (2026-11): error handler global JSON en backend, CORS restringido (`CORS_ORIGIN`, fallback producción front Render), JWT fail-fast en producción, redondeo a 2 decimales en total de venta, validación `userId` auditoría, ProductContext stale closure corregido, Caja NaN corregido, ConfigContext expone error, Inventario estado faltante declarado, skeleton Caja con tokens.

- CORS en Render: el backend quedó con fallback producción `https://nova-salud-1.onrender.com` para el front desplegado en Render; se debe setear `CORS_ORIGIN` en el backend de Render con ese valor y redeploy para persistirlo.

## Convenciones de codigo

- Backend: CommonJS (`"type": "commonjs"`); rutas en plural; un controller por recurso; middleware de auth.
- Frontend: ESM (`"type": "module"`); JSX; contexts para estado global; services para API/socket.
- Comentarios en espanol; estilo explicativo pero directo.
- Prisma schema: cuidado — "Angel + Qwen" son duenos; Marlon y Brat no edita sin avisar.

## Comandos

- Backend: `npm run dev`, `npm test`, `npm run db:push`, `npm run db:seed`, `npm run db:studio`.
- Frontend: `npm run dev`, `npm run build`.
- Tests: `cd back && npm test` (53 pruebas: auth/auditoria, perfil propio, roles, ventas atomicas, filtros de ventas, validacion de productos, inventario ampliado/trazabilidad, configuracion, gestión de usuarios, métodos de pago, anulación de ventas, productos inactivos/entradas y cierre de caja).

## Archivos de apoyo

- `README.md` — documentacion principal (42KB).
- `NOTAS.md` — notas rapidas de desarrollo.
