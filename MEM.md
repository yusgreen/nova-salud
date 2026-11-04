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
- Rediseño visual (2026-11): se abandonó el POS oscuro premium y la identidad esmeralda. `styles.css` ahora define tokens institucionales (slate neutro, acción `--action` slate-800, verde solo semántico) y un layout de sidebar persistente + topbar. Caja ya está migrada a clases propias `.pos-*` sobre esos tokens.
- Formulario de producto modal amplio (880 px, hoja completa en <=760 px): dos columnas formulario + vista previa sticky; secciones Datos/Precio e inventario/Presentacion; validacion inline por campo con boton deshabilitado; aviso de cambios sin guardar; historial de movimientos en edicion. La imagen acepta URL o ruta (sin subida de archivos). Las filas numericas usan 2 o 3 columnas iguales (`minmax(0,1fr)`) y pasan a 1 columna en <=560 px; evitar filas mixtas 2+1.
- `Modal` atrapa el foco, cierra con Escape, restaura el foco al salir y bloquea el scroll del fondo. Reutilizarlo en vez de crear overlays nuevos.
- Ilustraciones SVG propias en `Illustrations.jsx` con variables CSS (`--accent`, `--accent-soft`, `--card`, `--border`, `--text`, hoy alias de los tokens nuevos), sin dependencias ni archivos externos. Se usan en el hero del Dashboard y estados vacios de Inventario, Ventas y Auditoria. `AuthLayout` ya no usa ilustración: quedó como tarjeta limpia centrada.
- UI institucional: tokens en `:root` y `[data-theme="dark"]` (`--bg`, `--bg-elevated`, `--bg-muted`, `--fg`, `--fg-muted`, `--border`, `--action`, `--success`, `--warning`, `--danger`, `--info`, escala de espacio/radios/sombras). Verde, ámbar y rojo son solo estados semánticos; botones y navegación usan `--action` (slate). Tipografía Inter + JetBrains Mono para cifras tabulares, cargadas con Google Fonts en `index.html` (`display=swap`) y fallbacks del sistema en `--font-sans`/`--font-mono`.
- Compatibilidad: queda una sección `ALIASES DE COMPATIBILIDAD` al final de `styles.css` para `Comprobante` (ticket/print) e `Illustrations`, más tokens heredados (`--card`, `--text`, `--muted`, `--accent*`, `--warn*`, `--shadow`). Todas las pantallas de gestión usan clases nuevas (`.pos-*`, `.inv-*`, `.page-*`, `.filter-*`, `.settings-*`, `.switch`, `.field`, `.table`); ProductForm ya fue migrado a `.field/.input/.btn`. No borrar esa sección hasta migrar Comprobante del todo. Los controles nativos sin `.input/.select/.textarea` reciben estilos base por selector.
- Auth: `AuthLayout` es una tarjeta centrada (máx. 400 px) con logo + nombre + lema arriba, formulario al centro y credenciales demo discretas al pie (visibles solo si `mostrarAyudaDemo`). Login/Register usan `.auth-*`, `.input`, `.btn`, `.label`, `.form-grid`.
- Sistema de temas: preferencia `light | dark | system` persistida en `localStorage` (`nova_theme`), aplicada como `data-theme` en `<html>` con script inline anti-parpadeo en `index.html`; `system` sigue `prefers-color-scheme`. Selector en Configuración y botón cíclico en la Topbar visible para todos los roles.
- Sesión vencida: `api.js` centraliza los 401 de peticiones autenticadas, limpia el token una sola vez (flag anti-bucles), emite `nova:session-expired` y muestra un Toast global; AuthContext limpia el usuario y App vuelve al Login.
- Topbar (2026-11): saludo dinámico según la hora local con el nombre de pila (`Buenos días` 5-11:59, `Buenas tardes` 12-18:59, `Buenas noches` resto), compactado a `Hola, {nombre}` en ≤600 px (o solo `Hola` sin nombre); fecha y hora exacta en vivo (actualizada cada segundo) y avatar circular neutro con iniciales (el botón de tema se movió a Mi perfil → Tema). El avatar abre un menú desplegable (no modal) con nombre, correo, chip de rol, `Mi perfil` y `Salir` separado; cierra con clic fuera y Escape, abre con foco en el primer ítem, navega con flechas/Home/End y expone `aria-haspopup`/`aria-expanded`. Se eliminaron de la topbar el título de sección, el nombre suelto, el chip de rol y el botón Salir suelto.
- Perfil propio: `ProfileModal` se abre desde `Mi perfil` del menú del avatar; cambio de nombre y de contraseña con validación local (confirmación y mínimo 6) y feedback con Toast reutilizado.
- Gestión de usuarios: el switch de estado usa ConfirmDialog antes de desactivar; el select de rol se deshabilita para el propio usuario; la tabla reutiliza el estilo de auditoría/ventas y muestra un badge "Tú". Los cambios de rol y estado se auditan con diff.
- Vencimientos: helper `services/vencimientos.js` normaliza fechas sin hora en calendario local; `<=30 dias` es "pronto", `<0` es "vencido"; los productos sin fecha se ignoran.
- Ventas: el historial completo vive en SalesContext para el Dashboard; la vista Ventas filtra en cliente y pagina con `filasPorPagina`; el Excel se filtra en backend con los mismos query params, enviando `desde`/`hasta` como ISO con la hora local del navegador.
- Caja: selector de método de pago y campo "Recibido" con vuelto en vivo para efectivo. `POST /sales` valida `montoRecibido >= total` en efectivo y calcula el vuelto en backend; sin los campos nuevos funciona como antes. Tras registrar se abre un Modal con `Comprobante` (ticket imprimible con `window.print()` y CSS `@media print`); reimprimible desde Ventas.
- Anulación: `ConfirmDialog` exige motivo de al menos 5 caracteres; el backend anula en una transacción, repone stock y emite `stock_actualizado` y `venta_anulada`; las vistas se actualizan en vivo y las ventas anuladas quedan tachadas con badge y motivo.
- Animaciones CSS (150-300 ms) con respeto a `prefers-reduced-motion`: transición de vista, hover/active, entrada escalonada, shimmer, modal/overlay, toast y contadores animados.
- Configuración ampliada con pestañas Apariencia/Preferencias/Sistema: apariencia (tema, modo compacto, tamaño de fuente) y preferencias (formato de fecha, filas por página) en `localStorage` (`nova_prefs`); lo global (BD) queda en la pestaña Sistema y solo admin.
- Textos visibles en español neutro (tuteo, sin regionalismos como "acá"→"aquí", "tenés"→"tienes", "creá"→"crea").
- Etiquetas de auditoria centralizadas en `Auditoria.jsx` (`ETIQUETA_ACCION`), con filtro por codigo real y detalle renderizado como pares "clave: valor" (sin JSON crudo); `PRODUCT_UPDATE` muestra "campo: antes → después".
- Caja (fase 3, migrada): JSX reescrito a `.pos-*` sin tocar lógica/estado. Página con header + stats, grilla catálogo/ticket (`minmax(0,1fr) 380px`), búsqueda con `.input`, filas de producto con badges de stock (neutro normal, ámbar bajo, rojo agotado), ticket sticky con líneas, totales, nota, pago con vuelto (neutro sin monto, verde con vuelto > 0, rojo si el recibido no alcanza) y acciones `.btn`. Responsive: 1 columna <=900 px, pago y líneas apilados <=560 px.
- Inventario (fase 4, migrado): de tarjetas a tabla densa en `.table-wrap > .table.inv-table` (Producto/Estado/Precio/Stock/Mínimo/Vencimiento/Acciones), números alineados a la derecha con `--font-mono`, estado "Disponible" con punto verde + texto (nunca solo color), badges solo para inactivo/reponer/vencido/vence pronto, filas inactivas atenuadas y scroll horizontal en móvil. Stats compartidos `.stat-strip/.stat-chip` (también usados en Caja).
- Dashboard (fase 5, migrado): alertas primero en `.alert-panel` (stock bajo mínimo + vencimientos con badges y fechas), luego KPIs `.kpi-grid/.kpi` (números tabulares) y recaudo por método en tarjeta. El cajero conserva su turno y no ve stock crítico; el gerente ve ambos bloques. Se quitó la ilustración del hero y las tarjetas KPI duplicadas de alertas.
- Fase 6 (migración del resto): Ventas, Cierre, Auditoría, Usuarios, Configuración, ProfileModal, ConfirmDialog y Skeleton pasaron a clases base y nuevas (`.page-head`, `.filter-row/.filter-field`, `.field/.label`, `.segmented/.segment`, `.switch`, `.kpi`, `.table`, `.modal-actions`). Ventas ahora es una tabla con acciones Ver/Anular y detalle en `Comprobante`; Cierre usa KPIs + tabla; Auditoría usa badges semánticos por acción. Se agregó el import faltante de `api` en `Ventas.jsx` (la anulación fallaba por `api` indefinido). Impresión: `@media print` usa `body * { visibility:hidden }` + `.ticket-print`/`.cierre-print` visibles; al imprimir un ticket colapsa con `display:none` los hijos de `.sales`/`.pos`/`.cierre` salvo `.modal-overlay` y pasa overlay/modal/ticket a flujo estático, evitando que el overlay fijo repita el comprobante en dos hojas. Fuerza negro sobre blanco con `!important` (independiente del tema), quita sombras/bordes/fondos de modal y usa `page-break-inside: avoid`; `.no-print`, `.btn` y `.ticket-print-actions` no salen. Verificado con Edge headless en temas claro y oscuro: ticket y cierre generan 1 página. Solo los estilos base del ticket (`Comprobante`) y las ilustraciones siguen usando la capa de compatibilidad.
- Pulido final (2026-11): la Topbar muestra el nombre de la sección activa (Panel, Inventario, Caja…), no el usuario; Inventario suma búsqueda por nombre/código/código de barras junto al filtro de vencimiento, checkbox con `accent-color`, acciones `.btn-secondary` y Desactivar sin rojo (el rojo queda en confirmaciones); Ventas acota la columna Ticket (~150 px), reparte anchos por columna y usa "Completada" como texto neutro con punto discreto (solo "Anulada" en rojo); ProductForm se migró a `.field/.label/.input/.btn/.modal-actions`; Dashboard mantiene alertas antes que KPIs. Build final: 95 módulos, CSS 77.43 kB, JS 289.74 kB.
- Switch nuevo `.switch` (con `.is-on`) para Usuarios y Configuración; encendido usa `--success` con etiqueta de texto ("Activo"/"Inactivo"), nunca solo color. `.status-switch` queda como alias heredado. Checkboxes con `accent-color: var(--action)`.
- Regla de archivos: guardar en UTF-8 sin BOM; no usar PowerShell `Set-Content`/`Out-File` para escribirlos.
- Auditoría (2026-11): error handler global JSON en backend, CORS restringido (`CORS_ORIGIN`, fallback producción front Render), JWT fail-fast en producción, redondeo a 2 decimales en total de venta, validación `userId` auditoría, ProductContext stale closure corregido, Caja NaN corregido, ConfigContext expone error, Inventario estado faltante declarado, skeleton Caja con tokens.

- CORS en Render: el backend quedó con fallback producción `https://nova-salud-1.onrender.com` para el front desplegado en Render; se debe setear `CORS_ORIGIN` en el backend de Render con ese valor y redeploy para persistirlo.
- Regla: durante el PASE de correcciones original se pidió no tocar backend (lógica/endpoints/schema); los fixes de auditoría posteriores sí los modificaron, con estas notas.

- Regla: no hacer commit ni push sin autorización del usuario.

- Auditoria final pre-commit (2026-11): 54/54 tests y build OK. Se corrigio `rangoDiaCierre` (sale.controller) para rotular el cierre con la fecha local en vez de UTC y la prueba de cierre para calcular `fechaHoy` en local; el fallo nocturno era de la prueba, no de la app. La Topbar ya no tiene boton de tema y muestra fecha/hora en vivo; el tema quedo accesible para todos en Mi perfil > Tema. README, PRESENTACION, Pruebas y MEM actualizados (54 tests, reloj y ubicacion del tema).

- Ilustraciones (2026-11): SVG inline (sin dependencias) en el login (`AuthLayout`: escudo con cruz medica, capsulas y frasco) y en el panel de cajero (`Dashboard`: recibo + caja registradora + bolsa + monedas) dentro del header `.dashboard-head.is-cajero`. Regla: en JSX/SVG usar `width`/`height` (no `w`/`h`) o los rects no se dibujan. `.auth-shell` volvio a flex centrado con la ilustracion al lado (oculta <=900 px); la del cajero se reduce a 140x99 px en <=640 px. Ademas, el header del Dashboard ya no repite el saludo de la Topbar: admin muestra "Resumen de la farmacia", farmaceutico "Control de inventario" y cajero "Tu turno de hoy". El subtitulo es dinamico via `fraseDelPanel()`: sin ventas, arranque (<5), buen ritmo (<15) o excelente jornada (>=15), con monto recaudado y producto mas vendido; cambia "hoy" por "en tu turno" para cajero. La Topbar ya no tiene boton de tema: ahora muestra fecha y hora exacta en vivo (actualiza cada segundo, 24 h; en <=600 px oculta la fecha y deja la hora). El tema se cambia desde Mi perfil > Tema (todos los roles) o Configuracion > Apariencia (admin).

- Graficos dashboard (2026-11): solo roles con inventario (admin/farmaceutico) ven `.charts-grid` con dos tarjetas HTML/CSS sin dependencias: `GraficoVentasSemana` (barras de recaudado de los ultimos 7 dias, tooltip con monto y cantidad) y `GraficoTopProductos` (barras horizontales del top 5 por unidades). La serie y el top se calculan en `metricas` desde `ventas`; el cajero no los ve. Grid pasa a 1 columna en <=900 px. El panel admin reordena la zona analitica en 2x2: Recaudado por metodo (izquierda) + mini calendario semanal (derecha), luego barras de 7 dias + top productos. `MiniCalendarioSemanal` muestra 7 celdas con dia, numero y monto (hoy resaltado, tooltip con ventas); `RecaudoPorMetodo` ahora tambien renderiza estado vacio "Sin ventas registradas hoy" para no romper el grid. Calendario pasa a 4 columnas en <=640 px.

## Convenciones de codigo

- Backend: CommonJS (`"type": "commonjs"`); rutas en plural; un controller por recurso; middleware de auth.
- Frontend: ESM (`"type": "module"`); JSX; contexts para estado global; services para API/socket.
- Comentarios en espanol; estilo explicativo pero directo.
- Prisma schema: cuidado — "Angel + Qwen" son duenos; Marlon y Brat no edita sin avisar.

## Comandos

- Backend: `npm run dev`, `npm test`, `npm run db:push`, `npm run db:seed`, `npm run db:studio`.
- Frontend: `npm run dev`, `npm run build`.
- Tests: `cd back && npm test` (54 pruebas: auth/auditoria, perfil propio, roles, ventas atomicas, filtros de ventas, validacion de productos, inventario ampliado/trazabilidad, configuracion, gestión de usuarios, métodos de pago, anulación de ventas, productos inactivos/entradas y cierre de caja).

## Archivos de apoyo

- `README.md` — documentacion principal (42KB).
- `NOTAS.md` — notas rapidas de desarrollo.
- `Pruebas.md` — guia de pruebas manuales (login, navegacion, panel por rol, inventario, caja, ventas, cierre, auditoria, configuracion, usuarios, perfil, impresion, tiempo real, responsive y accesibilidad) con casos numerados, resultado esperado y plantilla de reporte de bugs.
- `PRESENTACION.md` y `DIAGRAMAS.md` — material de exposicion.
