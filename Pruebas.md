# Guía de pruebas — Nova Salud

Documento para probar **todo** el sistema (visual y funcional) y reportar hallazgos.
Última actualización: 2026-11-04.

> Cómo usarlo: marca `[x]` si pasa. Si algo falla o se ve raro, anótalo con el
> formato de la sección **18. Plantilla de reporte** (al final).

---

## 0. Recomendaciones generales

- Probar en **Chrome o Edge** primero. Si se puede, repetir en **Firefox** y en **móvil**.
- Tener siempre la consola del navegador abierta (F12) para ver errores en rojo.
- Probar con **datos reales**, creando productos y ventas; no solo mirar.
- Alternar entre roles (admin / farmacéutico / cajero) porque la interfaz cambia.
- Al terminar una prueba destructiva (desactivar usuario, anular venta), anotarlo.

---

## 1. Preparación del entorno

### 1.1 Levantar el sistema
- [ ] Backend: en `back/`, `npm install` → `npm run db:push` → `npm run db:seed` → `npm run dev` (puerto 4000).
- [ ] Frontend: en `front/`, `npm install` → `npm run dev` (Vite).
- [ ] Abrir la URL del frontend y verificar que carga sin pantalla en blanco.
- [ ] Si no aparecen datos, confirmar que el backend está en `http://localhost:4000`.

### 1.2 Cuentas de prueba
El seed crea **solo el admin**. Para probar los otros roles hay que crearlos.
- [ ] Admin: `admin@novasalud.pe` / `admin123`
- [ ] Crear un **farmacéutico** desde Usuarios (o usar uno existente).
- [ ] Crear un **cajero** desde Usuarios, o registrarlo desde el login.
- [ ] Anotar email/contraseña de cada uno para las pruebas.

### 1.3 Datos iniciales esperados
- [ ] 5 productos cargados: Paracetamol, Ibuprofeno, Amoxicilina, Vitamina C, Solución salina.
- [ ] 2 productos en alerta de stock: Ibuprofeno (12 / mín 20) y Vitamina C (5 / mín 10).
- [ ] Sin ventas registradas al inicio (historial vacío).

---

## 2. Acceso (Login / Registro)

### L1 — Login válido
- [ ] Ir al login e ingresar admin / `admin123`.
- [ ] Entra al sistema y muestra el Panel.

### L2 — Login inválido
- [ ] Ingresar email correcto y contraseña incorrecta.
- [ ] Muestra mensaje de error claro y **no** entra.
- [ ] Repetir 2-3 veces: no debe bloquearse ni romperse.

### L3 — Campos vacíos / formato
- [ ] Intentar entrar sin email o sin contraseña.
- [ ] El navegador impide enviar o muestra validación.
- [ ] Probar un email con formato inválido.

### L4 — Registro
- [ ] Ir a "Regístrate".
- [ ] Crear cuenta con nombre, email nuevo y contraseña de 6+ caracteres.
- [ ] La cuenta creada entra como **cajero**.
- [ ] Intentar registrar un email ya existente → error claro.
- [ ] Intentar contraseña de menos de 6 → validación.

### L5 — Credenciales demo
- [ ] Si "Mostrar credenciales demo" está activo (Configuración → Sistema), el login muestra la pista `admin@novasalud.pe · admin123`.
- [ ] Si está desactivado, la pista no aparece.

### L6 — Lema e identidad
- [ ] El login muestra el nombre del negocio y el lema: **"Sistema de inventario y ventas en tiempo real"**.
- [ ] El lema no aparece cortado ni desbordado.

### L7 — Visual del login
- [ ] La tarjeta está centrada junto a la ilustración (escudo con cruz, cápsulas y frasco).
- [ ] En pantallas angostas (≤900px) la ilustración se oculta y la tarjeta queda centrada.
- [ ] El logo, nombre y lema se ven alineados; nada se superpone.

### L8 — Cuenta inactiva
- [ ] Desactivar un usuario desde el admin y luego intentar iniciar sesión con él.
- [ ] El login rechaza el acceso con mensaje claro.

---

## 3. Navegación general, Topbar, temas y preferencias

### N1 — Menú lateral por rol
- [ ] Admin ve: Panel, Inventario, Caja, Ventas, Cierre de caja, Auditoría, Configuración, Usuarios.
- [ ] Farmacéutico ve: Panel, Inventario, Caja, Ventas, Cierre, Auditoría (sin Configuración ni Usuarios).
- [ ] Cajero ve: Panel, Inventario, Caja, Cierre (sin Ventas, Auditoría, Configuración, Usuarios).

### N2 — Cambio de módulo
- [ ] Al cambiar de sección, el contenido hace una transición suave (sin parpadeo ni salto).
- [ ] La sección activa queda marcada en el menú.

### N3 — Topbar
- [ ] Arriba se ve el saludo ("Buenos días/tardes/noches, Nombre").
- [ ] El saludo cambia según la hora del sistema.
- [ ] Entre el saludo y el avatar se ven la **fecha y la hora actual** (hora con segundos y actualización en vivo).
- [ ] El reloj y el avatar están alineados y visibles, sin superponerse.

### N4 — Tema
- [ ] El tema se cambia desde **Mi perfil → Tema** (Claro / Oscuro / Sistema), disponible para todos los roles. El admin también lo puede cambiar en Configuración → Apariencia. Ya no hay botón de tema en la Topbar.
- [ ] El cambio se aplica a TODA la app (tablas, modales, botones, gráficos, ticket).
- [ ] Al recargar, el tema elegido se mantiene.
- [ ] En modo oscuro, ningún texto queda ilegible ni con fondo blanco inesperado.
- [ ] En móvil el reloj oculta la fecha y sigue mostrando la hora.

### N5 — Menú de cuenta
- [ ] Clic en el avatar abre el menú con nombre, email y rol.
- [ ] "Mi perfil" abre el modal de perfil.
- [ ] "Salir" cierra sesión y vuelve al login.
- [ ] Clic fuera del menú lo cierra; Escape también.

### N6 — Menú móvil
- [ ] En pantalla angosta aparece el botón de menú (hamburguesa).
- [ ] Abre/cierra el sidebar sin romper el contenido.
- [ ] Al elegir una sección, el menú se cierra solo.

### N7 — Preferencias persistentes
- [ ] Activar "Modo compacto" y recargar: se mantiene.
- [ ] Cambiar "Tamaño de fuente" (pequeño/mediano/grande) y recargar: se mantiene.
- [ ] Los cambios se notan visualmente en la app.

---

## 4. Panel (Dashboard)

> El contenido del Panel cambia fuerte según el rol.

### P1 — Admin
- [ ] Título "Resumen de la farmacia".
- [ ] Frase dinámica según ventas del día (sin ventas, arranque, buen ritmo, excelente jornada).
- [ ] Se ven alertas de stock bajo y de vencimientos (si hay productos así).
- [ ] Se ven 5 KPIs: Ventas de hoy, Recaudado hoy, Ticket promedio, Unidades vendidas, Más vendido hoy.
- [ ] Zona analítica 2×2:
  - [ ] Arriba izquierda: "Recaudado por método".
  - [ ] Arriba derecha: mini calendario semanal (7 días con día, número y monto; hoy resaltado).
  - [ ] Abajo izquierda: gráfico de barras de ventas de los últimos 7 días.
  - [ ] Abajo derecha: productos más vendidos (top 5).
- [ ] Pasar el mouse por barras/calendario muestra tooltip con monto y cantidad.
- [ ] Sin ventas: los gráficos muestran el mensaje de vacío y no se rompen.

### P2 — Farmacéutico
- [ ] Título "Control de inventario".
- [ ] Mismas alertas y mismos gráficos que el admin.
- [ ] No hay diferencia visual rota respecto al admin salvo el título.

### P3 — Cajero
- [ ] Título "Tu turno de hoy".
- [ ] Frase dinámica referida al **turno** ("en tu turno").
- [ ] Se ve la ilustración de caja registradora a la derecha.
- [ ] Solo KPIs de turno y "Recaudado por método".
- [ ] **No** se ven alertas de stock/vencimiento ni los gráficos de gerente.
- [ ] Los números coinciden con las ventas del cajero.

### P4 — Dinámica de la frase
- [ ] Registrar 1 venta y volver al Panel: la frase cambia (arranque).
- [ ] Con 5+ ventas hoy: cambia a "Buen ritmo".
- [ ] La frase incluye el producto más vendido cuando existe.

### P5 — Responsive del Panel
- [ ] En ≤900px los gráficos pasan a 1 columna.
- [ ] En móvil el calendario se acomoda en 4 columnas y no se sale de la tarjeta.
- [ ] La ilustración del cajero se reduce en móvil.

---

## 5. Inventario

### I1 — Admin / Farmacéutico (gestión)
- [ ] Se ven los botones "Nuevo producto" y, por fila, "Editar / Recibir / Desactivar".
- [ ] Contadores superiores: productos, bajo mínimo, vencen pronto, vencidos.

### I2 — Cajero (solo lectura)
- [ ] El cajero ve la tabla pero **no** ve "Nuevo producto" ni acciones por fila.
- [ ] Puede buscar y filtrar, pero no modificar.

### I3 — Buscar
- [ ] Buscar por nombre (parcial) filtra la tabla.
- [ ] Buscar por código (ej. `P-0001`) filtra.
- [ ] Buscar por código de barras (si el producto tiene) filtra.
- [ ] Sin coincidencias: aparece "Sin resultados" y "Limpiar filtros" funciona.

### I4 — Filtro de vencimiento
- [ ] "Vence pronto (≤30 días)" muestra solo esos productos.
- [ ] "Vencidos" muestra solo vencidos.
- [ ] "Todos" vuelve a mostrar todo.

### I5 — Mostrar inactivos
- [ ] Marcar "Mostrar inactivos" muestra productos desactivados (atenuados con badge "Inactivo").
- [ ] Desmarcar los oculta.

### I6 — Crear producto (validaciones)
- [ ] Abrir "Nuevo producto": hay vista previa a la derecha.
- [ ] Marcar campos con error al intentar guardar solo si son inválidos.
- [ ] Probar: nombre vacío/1 letra → error; precio negativo → error; stock decimal → error;
      stock negativo → error; unidad vacía → error; código con símbolos raros → error;
      código de barras muy corto o con símbolos → error; fecha inválida no se puede.
- [ ] Crear un producto válido con todos los campos (nombre, categoría, proveedor,
      descripción, precio venta/compra, stock, mínimo, unidad, código de barras, vencimiento, imagen).
- [ ] Se crea y aparece en la tabla sin recargar la página.
- [ ] El código interno se autogenera si se deja vacío.

### I7 — Vista previa del producto
- [ ] Al escribir nombre, categoría, precio, stock, etc., la vista previa se actualiza.
- [ ] El badge cambia entre "Disponible / Stock bajo / Sin stock".
- [ ] Si la imagen no carga, se muestran las iniciales.
- [ ] Si hay precio de compra, muestra el margen (%).

### I8 — Editar producto
- [ ] "Editar" abre el formulario con los datos cargados.
- [ ] Guardar cambios actualiza la tabla.
- [ ] En edición se ven los últimos movimientos del producto.
- [ ] Si hay cambios sin guardar y cierras, aparece "Tienes cambios sin guardar" con
      "Seguir editando" / "Descartar".

### I9 — Recibir mercadería
- [ ] "Recibir" abre el modal con cantidad, proveedor y motivo.
- [ ] Cantidad 0, negativa o decimal → error.
- [ ] Motivo vacío → error.
- [ ] Entrada válida suma stock y aparece como movimiento `ENTRADA` (auditoría).

### I10 — Activar / Desactivar
- [ ] "Desactivar" cambia el estado y muestra toast.
- [ ] El producto inactivo no debe aparecer en Caja ni poder venderse.
- [ ] "Activar" lo devuelve a disponible.

### I11 — Alertas y vencimientos en tabla
- [ ] Producto con stock ≤ mínimo muestra badge "Reponer".
- [ ] Vencido muestra badge rojo "Vencido" y días "Hace X d".
- [ ] Vence pronto muestra "Vence pronto" y "En X d".
- [ ] Producto normal muestra "Disponible" con punto verde.
- [ ] Fechas se ven en formato legible y no corridas por zona horaria.

### I12 — Estado vacío
- [ ] Con inventario vacío aparece ilustración y botón "Crear primer producto" (gestores).
- [ ] Para cajero, mensaje "Todavía no hay productos cargados para vender."

---

## 6. Caja (Punto de venta)

### C1 — Catálogo
- [ ] Se ven los productos activos con precio, stock y badges.
- [ ] El contador "X resultados" coincide con lo filtrado.
- [ ] Buscar por nombre, código, código de barras o categoría filtra al instante.
- [ ] Botón ✕ limpia la búsqueda.
- [ ] Producto sin stock aparece como "Sin stock" y el botón "Agregar" deshabilitado.

### C2 — Agregar al ticket
- [ ] "Agregar" suma el producto al ticket de la derecha.
- [ ] Agregar el mismo producto otra vez incrementa la cantidad (no duplica la línea).
- [ ] La fila del catálogo muestra "En ticket: N".

### C3 — Control de cantidades
- [ ] `+` aumenta la cantidad hasta el stock disponible.
- [ ] Al llegar al stock, `+` se deshabilita y dice "Máximo"/"Límite de stock".
- [ ] `−` reduce la cantidad; en 1, reduce a 0 o quita la línea según corresponda.
- [ ] El ícono de basura quita la línea completa.
- [ ] "Vaciar ticket" deja el ticket vacío.

### C4 — Totales
- [ ] "Total a cobrar" = suma de precio × cantidad de cada línea.
- [ ] Se muestra cantidad de productos y de unidades correctamente.
- [ ] Los montos usan la moneda configurada.

### C5 — Nota del ticket
- [ ] Se puede escribir una nota; el contador muestra `X/250`.
- [ ] No permite pasar de 250 caracteres.

### C6 — Métodos de pago
- [ ] Efectivo muestra el campo "Recibido" y el "Vuelto".
- [ ] Tarjeta y Yape/Plin ocultan el campo "Recibido".
- [ ] Con efectivo y monto menor al total: muestra "Monto insuficiente" y bloquea el cobro.
- [ ] Con monto igual o mayor: calcula el vuelto correctamente.
- [ ] Sin monto recibido: se puede cobrar igual (queda en "—").

### C7 — Registrar venta
- [ ] Con ticket vacío, "Cobrar" está deshabilitado.
- [ ] Al cobrar, aparece "Venta registrada. Total ... — Atendió: ...".
- [ ] Se abre el comprobante con ticket, fecha, atendió, líneas, total, método y vuelto.
- [ ] El ticket se limpia después de cobrar (nota, método, monto recibido).
- [ ] El stock baja al instante en Inventario (sin recargar).

### C8 — Errores de venta
- [ ] Forzar stock insuficiente (dos pestañas o stock bajo): muestra el mensaje del back y
      **no** limpia el ticket para poder ajustar.
- [ ] Producto inactivo no aparece ni se puede vender.

### C9 — Comprobante e impresión
- [ ] "Imprimir" genera **una sola** página/hoja con el ticket.
- [ ] En la impresión no salen botones, sidebar ni fondos; solo el ticket.
- [ ] Se ve bien en tema claro y oscuro.
- [ ] "Cerrar" vuelve a Caja sin perder la venta ya registrada.

### C10 — Permisos de Caja
- [ ] Admin, farmacéutico y cajero pueden abrir Caja y vender.
- [ ] No hay errores de permisos al cobrar con ninguno de los tres.

---

## 7. Ventas (solo admin y farmacéutico)

### V1 — Acceso
- [ ] Admin y farmacéutico ven "Ventas"; el cajero **no** la ve en el menú.

### V2 — Estado vacío
- [ ] Sin ventas: aparece ilustración y mensaje "Todavía no hay ventas".

### V3 — Tabla
- [ ] Columnas: Ticket, Fecha, Atendido por, Método, Unid., Total, Estado, Acciones.
- [ ] Cada venta lista unidades y total correctos.
- [ ] Ventas anuladas se ven atenuadas, con badge "Anulada" y su motivo.

### V4 — Filtros
- [ ] Filtrar por "Desde" y "Hasta" acota el rango (inclusive).
- [ ] Filtrar por "Atendido por" funciona.
- [ ] Combinar filtros y "Limpiar" restaura todo.
- [ ] Sin resultados: mensaje "Sin ventas con esos filtros" y botón limpiar.

### V5 — Paginación
- [ ] El texto "N ticket(s) · página X de Y" coincide.
- [ ] Anterior/Siguiente cambian de página y se deshabilitan en los extremos.
- [ ] Cambiar "Filas por página" en Configuración → Preferencias afecta la paginación.

### V6 — Ver detalle
- [ ] "Ver" abre el comprobante con el detalle completo de esa venta.
- [ ] "Cerrar" vuelve al historial.

### V7 — Anular
- [ ] "Anular" abre confirmación pidiendo motivo.
- [ ] Motivo con menos de 5 caracteres → error y no permite confirmar.
- [ ] Motivo válido anula la venta, muestra toast, marca "Anulada" y **repone el stock**.
- [ ] No se puede anular dos veces la misma venta.
- [ ] El cajero no tiene botón "Anular".

### V8 — Exportar Excel
- [ ] "Exportar Excel" descarga un archivo `.xlsx` (respeta los filtros aplicados).
- [ ] El archivo se abre correctamente y tiene los datos esperados.
- [ ] Sin resultados el botón está deshabilitado o avisa.

---

## 8. Cierre de caja

### CC1 — Gestor (admin/farmacéutico)
- [ ] Puede elegir fecha y filtrar por cualquier usuario.
- [ ] KPIs: Ventas completadas, Total general, Efectivo esperado, Anuladas.
- [ ] "Por método de pago" muestra cantidad y total por método.
- [ ] El detalle lista tickets, usuario, método, total y estado.
- [ ] "Exportar a Excel" descarga el cierre de esa fecha/usuario.

### CC2 — Cajero
- [ ] El selector de usuario está fijo en su propio usuario (no puede ver otros).
- [ ] Solo ve sus ventas del día elegido.
- [ ] No ve el botón de exportar (si corresponde por rol).
- [ ] Puede cambiar la fecha de su cierre.

### CC3 — Impresión
- [ ] "Imprimir" genera una hoja limpia con el resumen (sin sidebar ni filtros).
- [ ] Se ve bien en claro y oscuro.

### CC4 — Consistencia
- [ ] "Efectivo esperado" coincide con la suma de ventas en efectivo del día.
- [ ] Las anuladas no suman al total general y sí se listan como anuladas.

---

## 9. Auditoría (admin y farmacéutico)

### A1 — Acceso
- [ ] Admin y farmacéutico ven Auditoría; el cajero no.

### A2 — Registro de acciones
- [ ] Se registran: login, login fallido, registro, venta, anulación, crear/editar producto,
      recepción de stock, configuración, perfil, contraseña, usuarios y estados.
- [ ] El intento de login fallido aparece resaltado en rojo.
- [ ] El detalle muestra campos legibles (antes → después cuando aplica).
- [ ] El avatar NO expone la imagen en el detalle (solo indica el cambio).

### A3 — Filtro
- [ ] Filtrar por acción muestra solo esos registros.
- [ ] "Todas" restaura la lista.
- [ ] El contador "N registro(s)" coincide.

### A4 — Datos
- [ ] Fecha, usuario, rol, entidad, IP se muestran correctamente.
- [ ] No aparece `passwordHash` ni datos sensibles en ningún detalle.

---

## 10. Configuración (solo admin)

### CF1 — Acceso
- [ ] Solo el admin ve "Configuración"; farmacéutico y cajero no.

### CF2 — Pestaña Apariencia
- [ ] Cambiar tema Claro/Oscuro/Sistema funciona y persiste.
- [ ] "Modo compacto" cambia el espaciado.
- [ ] "Tamaño de fuente" cambia el texto de la app.

### CF3 — Pestaña Preferencias
- [ ] "Formato de fecha" guarda la preferencia.
- [ ] "Filas por página" (5–100) se guarda y afecta la paginación de Ventas.
- [ ] Al recargar, las preferencias se mantienen (localStorage del navegador).

### CF4 — Pestaña Sistema
- [ ] Se ven "Solo admin" y la vista previa.
- [ ] Editar nombre del negocio, lema, moneda, umbral de stock y ayuda demo actualiza la vista previa.
- [ ] "Guardar cambios" aplica en todo el sistema (topbar/login/ticket/moneda).
- [ ] "Descartar" revierte los campos a lo guardado.
- [ ] Los botones están deshabilitados si no hay cambios.
- [ ] Validaciones: nombre corto, moneda vacía, umbral fuera de rango.
- [ ] El lema guardado se refleja en Login y en el ticket.

---

## 11. Usuarios (solo admin)

### U1 — Acceso
- [ ] Solo el admin ve "Usuarios".

### U2 — Listado
- [ ] Se ven total, activos e inactivos.
- [ ] Cada fila muestra avatar (o iniciales), nombre, email, rol y estado.
- [ ] El usuario actual lleva badge "Tú".
- [ ] Avatares se ven circulares y sin deformarse.

### U3 — Crear usuario
- [ ] "Nuevo usuario" abre el modal.
- [ ] Nombre < 2 → error; email inválido → error; contraseña < 6 → error.
- [ ] Crear admin/farmacéutico/cajero funciona y aparece en la lista.
- [ ] Email duplicado → error claro.

### U4 — Cambiar rol
- [ ] Cambiar el rol de otro usuario se guarda y muestra toast.
- [ ] No se puede cambiar el rol propio (selector deshabilitado).

### U5 — Activar / Desactivar
- [ ] Desactivar pide confirmación.
- [ ] Al desactivar, ese usuario no puede iniciar sesión y sus tokens dejan de servir.
- [ ] "No puedes desactivar tu propia cuenta" (switch deshabilitado en tu fila).
- [ ] No se puede dejar el sistema sin ningún admin activo (probar desactivar al último admin).

---

## 12. Mi perfil (todos los roles)

### PR1 — Abrir
- [ ] Desde el menú del avatar → "Mi perfil".
- [ ] Muestra avatar/iniciales, email de sesión, cambio de nombre y cambio de contraseña.

### PR2 — Avatar
- [ ] "Cambiar foto" acepta JPG/PNG/WebP.
- [ ] La vista previa se recorta cuadrada y se ve nítida (128×128).
- [ ] Imagen mayor a 2MB → error "menor a 2MB".
- [ ] "Quitar foto" vuelve a iniciales.
- [ ] Guardar actualiza el avatar en la Topbar y en la tabla de Usuarios.

### PR3 — Nombre
- [ ] Guardar nombre vacío → error.
- [ ] Guardar nombre válido actualiza Topbar y auditoría (PROFILE_UPDATE).

### PR4 — Contraseña
- [ ] Campos incompletos → error "Completa los tres campos".
- [ ] Nueva contraseña < 6 → error.
- [ ] Confirmación distinta → error.
- [ ] Contraseña actual incorrecta → error del backend.
- [ ] Cambio exitoso permite iniciar sesión con la nueva (y ya no con la vieja).

---

## 13. Impresión (transversal)

### IM1 — Ticket
- [ ] Imprimir un ticket genera 1 página, sin elementos de la app.
- [ ] Datos completos: negocio, lema, ticket, fecha, atendió, líneas, total, pago, vuelto, nota.

### IM2 — Cierre
- [ ] Imprimir el cierre genera 1 página con el resumen y el detalle.
- [ ] No repite contenido ni genera hojas en blanco.

### IM3 — Temas
- [ ] La impresión sale en negro sobre blanco en ambos temas.

---

## 14. Tiempo real (socket)

### RT1 — Stock en vivo
- [ ] Abrir Inventario en una pestaña y Caja en otra (mismo usuario u otro con sesión).
- [ ] Registrar una venta en Caja: el stock en Inventario baja **sin recargar**.
- [ ] Una recepción de mercadería sube el stock en la otra pestaña.

### RT2 — Varios usuarios
- [ ] Con dos navegadores distintos, una venta de un cajero se refleja para el admin/farmacéutico.

### RT3 — Anulación
- [ ] Al anular una venta, el stock repuesto se refleja en Inventario/Caja.

---

## 15. Casos borde y validaciones globales

### E1 — Backend caído
- [ ] Detener el backend y navegar: los módulos muestran error claro (no pantalla blanca).
- [ ] Volver a levantar el backend y recargar: todo funciona.

### E2 — Token vencido
- [ ] Esperar a que expire el token (o manipularlo) y hacer una acción.
- [ ] La app pide iniciar sesión de nuevo en lugar de romperse.

### E3 — Permisos cruzados
- [ ] Estando como cajero, intentar abrir endpoints restringidos (Ventas/Auditoría/Usuarios)
      no debe permitir ver datos.
- [ ] Estando como farmacéutico, no puede entrar a Configuración/Usuarios.

### E4 — Moneda
- [ ] Cambiar la moneda en Configuración y verificar que se actualiza en Caja, Ventas,
      Comprobante y Panel.

### E5 — Umbral de stock
- [ ] Cambiar el umbral de stock bajo y verificar que los nuevos productos lo usan por defecto.

---

## 16. Responsive y visual

### R1 — Escritorio
- [ ] Layout de 2 columnas en Caja (catálogo/ticket) sin solapamientos.
- [ ] Tablas anchas no rompen la página.

### R2 — Tablet (≈768px)
- [ ] Sidebar se adapta y el contenido conserva legibilidad.
- [ ] Gráficos del Panel pasan a 1 columna.

### R3 — Móvil (≈375px)
- [ ] Login sin ilustración, tarjeta centrada.
- [ ] Menú hamburguesa funcional.
- [ ] Tablas con scroll horizontal (sin cortar columnas importantes).
- [ ] Modales se ajustan y se puede hacer scroll dentro.
- [ ] El calendario semanal pasa a 4 columnas y no desborda.
- [ ] Botones y campos son tocables (no diminutos ni superpuestos).

### R4 — Detalles visuales
- [ ] Avatares circulares y con borde visible.
- [ ] Badges y puntos de estado se distinguen sin depender solo del color.
- [ ] Nada se sale de su tarjeta ni se superpone.
- [ ] Textos largos (nombres, productos) se truncan con "…" sin romper la fila.

---

## 17. Accesibilidad básica

### AC1 — Teclado
- [ ] Se puede navegar el menú y los modales con Tab.
- [ ] Escape cierra modales y el menú de cuenta.
- [ ] El foco es visible en botones y campos.

### AC2 — Etiquetas
- [ ] Inputs tienen label o aria-label.
- [ ] Botones con íconos tienen aria-label (ej. tema, avatar, quitar línea).

### AC3 — Contraste
- [ ] Texto legible en ambos temas (claro y oscuro).
- [ ] Estados no dependen únicamente del color (hay texto o badge).

---

## 18. Plantilla de reporte

Copia y completa por cada hallazgo:

```
ID:            (ej. C7-03)
Módulo:        (Login / Panel / Inventario / Caja / Ventas / Cierre / Auditoría / Configuración / Usuarios / Perfil)
Rol usado:     (admin / farmacéutico / cajero)
Navegador:     (Chrome 130 / Edge / Firefox / Safari / móvil + versión)
Fecha/hora:
Severidad:     (Bloqueante / Alta / Media / Baja / Visual)
Pasos:
  1.
  2.
  3.
Resultado esperado:
Resultado obtenido:
¿Se repite siempre?  (Sí / No / A veces)
Captura o video:
Notas extra / consola (F12):
```

### Criterios de severidad
- **Bloqueante**: no deja operar (no se puede vender, no entra, pantalla en blanco).
- **Alta**: funcionalidad clave incorrecta (total mal, stock mal, permisos).
- **Media**: falla en un caso puntual o validación.
- **Baja**: detalle menor de comportamiento.
- **Visual**: únicamente estético (alineación, color, espaciado, responsive).

---

## 19. Checklist final por rol

### Admin
- [ ] Login, Panel, Inventario (CRUD + recepción), Caja, Ventas (filtros/anular/exportar),
      Cierre, Auditoría, Configuración, Usuarios y Perfil.
- [ ] Puede crear farmacéuticos y cajeros y probar con ellos.

### Farmacéutico
- [ ] Panel, Inventario (CRUD + recepción), Caja, Ventas (anular), Cierre, Auditoría y Perfil.
- [ ] No ve Configuración ni Usuarios.

### Cajero
- [ ] Panel de turno, Inventario (solo lectura), Caja, Cierre propio y Perfil.
- [ ] No ve Ventas, Auditoría, Configuración ni Usuarios.

### Transversal
- [ ] Temas, responsive, impresión, tiempo real y validaciones revisados.

---

## 20. Fin de la ronda

- [ ] Todos los hallazgos reportados con la plantilla.
- [ ] Se adjuntaron capturas de los fallos visuales.
- [ ] Se indicó qué casos no se pudieron probar y por qué.
