Lider del Proyecto:Angel Pereda Chavez

Colaboradores:Marlon Yasser Yanac Sajami, Brad Ocaña
# Nova Salud 💊

Sistema web de **inventario y ventas en tiempo real** para una botica. Trabajo
entregable del curso de Full Stack Developer (entrega: 7 de noviembre).

Permite gestionar el catálogo de medicamentos, registrar ventas de forma
**atómica** (descuentan stock y se revierten solas si no alcanza), controlar
**roles** de acceso y recibir **alertas automáticas de reposición en vivo**
(cuando alguien vende, las otras pantallas se actualizan sin recargar).

> **Este README es para ti si eres Marlon, Brat, o cualquiera que vaya a
> trabajar sobre este código.** Está escrito asumiendo que **no conoces el
> proyecto**. Si entiendes qué es Node, npm, Git y una terminal, puedes saltar
> el glosario; si no, léelo primero, te va a ahorrar muchas confusiones.

---

## 📑 Índice

1. [Mapa mental: qué es este proyecto en 30 segundos](#1-mapa-mental)
2. [Glosario: palabras que vas a ver y qué significan](#2-glosario)
3. [Requisitos previos (instalar antes de empezar)](#3-requisitos-previos)
4. [Paso 0 — Que Ángel te invite al repo (obligatorio)](#4-paso-0-invitar)
5. [Paso 1 — Clonar el repositorio](#5-paso-1-clonar)
6. [Estructura del proyecto](#6-estructura)
7. [Paso 2 — Correr el BACKEND en local](#7-paso-2-backend)
8. [Paso 3 — Correr el FRONTEND en local](#8-paso-3-frontend)
9. [Cómo usar la aplicación (y qué puede hacer cada rol)](#9-uso-y-roles)
10. [Referencia de la API (endpoints)](#10-api)
10.1 [Pruebas](#pruebas)
11. [Eventos de Socket.io (tiempo real)](#11-socket)
12. [Modelo de datos (las tablas)](#12-datos)
13. [Variables de entorno (todas, con qué hace cada una)](#13-env)
14. [Paso 4 — Desplegar en Render (producción)](#14-render)
15. [Solución de problemas comunes](#15-troubleshooting)
16. [Decisiones de arquitectura (para la defensa)](#16-arquitectura)
17. [Mejoras futuras (no incluidas a propósito)](#17-mejoras)
18. [Checklist de entrega](#18-checklist)

---

<a name="1-mapa-mental"></a>
## 1. Mapa mental: qué es este proyecto en 30 segundos

El proyecto son **dos programas que se hablan entre sí**, más una base de datos:

```
   ┌─────────────────────┐     HTTP (REST)      ┌─────────────────────┐
   │   FRONTEND (React)  │ ───────────────────▶ │   BACKEND (Express) │
   │  lo que ves en el   │ ◀─────────────────── │  la lógica, la auth,│
   │  navegador :5173    │   WebSocket (Socket) │  las ventas :4000   │
   └─────────────────────┘ ───────────────────▶ └──────────┬──────────┘
                                                            │
                                                            ▼
                                                   ┌─────────────────┐
                                                   │  BASE DE DATOS  │
                                                   │  (SQLite/Prisma)│
                                                   └─────────────────┘
```

- **Frontend** (`front/`): la interfaz. Es lo que se ve en el navegador. Está
  hecho con **React** (una librería para armar pantallas con componentes) y
  **Vite** (la herramienta que levanta ese React en tu PC y lo compila para
  producción).
- **Backend** (`back/`): el "cerebro". Es un servidor **Express** (Node.js) que
  recibe peticiones del front, valida permisos, calcula totales, descuenta stock
  y guarda todo en la base de datos. **Nunca** confíes en lo que manda el front:
  el backend recalcula y decide (eso es seguridad).
- **Base de datos**: un archivo SQLite (`dev.db`) que Prisma lee y escribe.
  **Prisma** es el ORM: en vez de escribir SQL a mano, escribes código JavaScript
  (`prisma.producto.findMany()`) y Prisma lo traduce a la base de datos.

El frontend **no toca la base de datos directamente**. Siempre pasa por el
backend. Eso es a propósito: así el backend puede aplicar reglas (roles, stock,
precios reales) que un usuario malintencionado no pueda saltarse.

---

<a name="2-glosario"></a>
## 2. Glosario (léelo si algo de abajo te suena a chino)

| Término | Qué es, en simple |
| --- | --- |
| **Terminal / consola / PowerShell** | La ventana donde escribes comandos. En Windows se abre con `Win + R` → `powershell`, o desde VS Code (menú *Terminal → New Terminal*). En Mac es "Terminal". |
| **Git** | El sistema que guarda el historial de cambios del código (como "guardar partidas" de un videojuego). |
| **Repositorio / repo** | La carpeta del proyecto vigilada por Git, normalmente alojada en GitHub. |
| **GitHub** | El sitio web donde vive el repo (`github.com`). Este proyecto está en `github.com/yusgreen/nova-salud` y es **privado** (solo lo ven los invitados). |
| **Clonar** | Descargar una copia completa del repo (con todo su historial) a tu PC. |
| **Commit** | Un "punto de guardado" del código con un mensaje. |
| **Push / Pull** | *Push* = subir tus commits a GitHub. *Pull* = bajar los commits de GitHub a tu PC. |
| **npm** | El gestor de paquetes de Node. Instala las librerías que usa el proyecto (`npm install`) y corre sus scripts (`npm run dev`). |
| **`node_modules/`** | La carpeta donde npm guarda todas las librerías instaladas. **Nunca se sube a Git** (es enorme y se regenera con `npm install`). |
| **`package.json`** | El "DNI" del proyecto: lista qué librerías usa y qué comandos (`scripts`) tiene. |
| **`.env`** | Archivo con configuraciones secretas (contraseñas, claves). **Nunca se sube a Git.** Se crea copiando `.env.example`. |
| **API / endpoint** | Una URL del backend que hace algo, ej. `GET /products` = "dame la lista de productos". |
| **JWT / token** | Una "credencial digital" que el backend entrega al hacer login y que el front manda en cada petición para probar quién es. Vive 1 hora y caduca solo. |
| **Hash (bcrypt)** | La contraseña **nunca** se guarda en texto. Se guarda transformada (hash) y no se puede revertir. Por eso nadie, ni el profe, ve tu contraseña real. |
| **WebSocket / Socket.io** | Un canal bidireccional en vivo: el backend puede "empujar" mensajes al front sin que el front los pida (así se actualiza el stock solo). |
| **ORM (Prisma)** | Herramienta que traduce código JS a operaciones de base de datos, con un esquema (`schema.prisma`) que define las tablas. |
| **Render** | El servicio donde se **despliega** (se publica a internet) el proyecto para que tenga una URL pública. Tiene plan gratis. |
| **Desplegar / deploy** | Subir el proyecto a un servidor de internet para que cualquiera con la URL lo pueda abrir. |

---

<a name="3-requisitos-previos"></a>
## 3. Requisitos previos (instalar antes de empezar)

Necesitas tener instalado en tu PC:

1. **Node.js 20 o superior** (este proyecto se probó con Node 24). Descárgalo de
   [nodejs.org](https://nodejs.org) (versión LTS). Verifica con:
   ```bash
   node -v     # debe decir v20.x o superior
   npm -v      # debe decir 10.x o superior
   ```
2. **Git**. En Windows se instala con [git-scm.com](https://git-scm.com). Verifica:
   ```bash
   git --version
   ```
3. **Un editor de código**. Recomendado **VS Code** ([code.visualstudio.com](https://code.visualstudio.com)).
4. **Una cuenta en GitHub**. El repo es privado, así que necesitas cuenta para que
   Ángel te invite (Paso 0).
5. **(Solo para desplegar) una cuenta en Render** ([render.com](https://render.com)),
   gratuita, se puede crear con tu GitHub.

> **Nota para Windows:** casi todos los comandos de este README son **PowerShell**.
> Donde haya una diferencia con Mac/Linux (por ejemplo copiar archivos), te pongo
> las dos variantes.

---

<a name="4-paso-0-invitar"></a>
## 4. Paso 0 — Que Ángel te invite al repo (obligatorio)

El repo `yusgreen/nova-salud` es **privado**. Si intentas clonarlo sin permisos,
Git te va a decir `Repository not found` o te pedirá login y fallará. **Ángel
debe invitarlos primero.**

**Lo que hace Ángel (una sola vez, por cada compañero):**

1. Entra a `https://github.com/yusgreen/nova-salud`.
2. *Settings* (Configuración) → *Collaborators* (Colaboradores) → *Add people*.
3. Escribe el **usuario de GitHub** o el **email** de Marlon o Brat.
4. Selecciona el rol **Write** (pueden leer, clonar, hacer push y pull request).
5. Envía la invitación.

**Lo que hacen Marlon/Brat:**

1. Les llega un email de GitHub con la invitación (o la ven en
   `https://github.com/invitations`).
2. Aceptan la invitación. **Sin aceptar esto, el clone va a fallar.**

> Si ya aceptaron y igual falla el `git clone`, normalmente es porque están logueados
> en Git con **otra** cuenta de GitHub. Verifíquenlo con:
> ```bash
> gh auth status        # si tienen GitHub CLI
> # o mirando en el Credential Manager de Windows: "github.com"
> ```

---

<a name="5-paso-1-clonar"></a>
## 5. Paso 1 — Clonar el repositorio

"Clonar" = descargar el proyecto completo a tu PC. Elige **una** de las dos vías.

### Vía recomendada: HTTPS (la más simple)

1. Abre Git Bash, PowerShell o la terminal de VS Code.
2. Navega a la carpeta donde quieras guardar el proyecto, por ejemplo:
   ```bash
   cd C:\Users\TU-USUARIO\Desktop      # Windows
   cd ~/Desktop                        # Mac/Linux
   ```
3. Clona con la URL HTTPS:
   ```bash
   git clone https://github.com/yusgreen/nova-salud.git
   ```
4. La primera vez, Git te va a pedir autenticarte con tu cuenta de GitHub (la que
   Ángel invitó). En Windows normalmente se abre el navegador para iniciar sesión
   con GitHub y listo. Si te pide contraseña, GitHub **ya no acepta contraseñas**:
   necesitas un *Personal Access Token* (PAT). Créalo en
   `GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)`,
   con scope `repo`, y úsalo como contraseña.
5. Entra a la carpeta:
   ```bash
   cd nova-salud
   ls            # (Windows: dir)  deberías ver: back/  front/  README.md  NOTAS.md  .gitignore
   ```

### Vía alternativa: SSH (si ya tienes clave SSH configurada)

```bash
git clone git@github.com:yusgreen/nova-salud.git
```

Requiere que tu clave pública esté agregada en tu cuenta de GitHub
(*Settings → SSH and GPG keys*). Si no sabes qué es esto, usa HTTPS.

**Deberías ver** una carpeta `nova-salud/` con `back/`, `front/`, `README.md`,
`NOTAS.md` y `.gitignore`. Si ves eso, el clone salió bien.

> **Trabajo en equipo:** antes de ponerte a codear, siempre haz `git pull` para
> bajar los cambios de los demás; y después de tus cambios, `git add` + `git commit`
> + `git push`. Si dos editan el mismo archivo sin pull previo, Git marca conflicto
> y hay que resolverlo a mano. Pregunta en el grupo quién está tocando qué.

---

<a name="6-estructura"></a>
## 6. Estructura del proyecto

```
nova-salud/
├── README.md              ← este archivo
├── NOTAS.md               ← bitácora de desarrollo (decisiones y errores que ya se resolvieron)
├── .gitignore             ← qué NO se sube a Git (node_modules, .env, dev.db)
│
├── back/                  ← EL SERVIDOR (Node + Express + Prisma + Socket.io)
│   ├── package.json       ← dependencias y scripts del backend
│   ├── .env.example       ← plantilla de configuración (se copia a .env)
│   ├── prisma/
│   │   ├── schema.prisma  ← las tablas (Usuario, Producto, MovimientoStock, Venta, DetalleVenta, Configuracion, AuditLog)
│   │   └── seed.js        ← datos de demo (admin + 5 productos)
│   └── src/
│       ├── index.js       ← arranca el servidor HTTP + Socket.io
│       ├── prisma.js      ← instancia única de Prisma (el cliente de BD)
│       ├── config/auth.js ← secreto y expiración del JWT
│       ├── controllers/   ← la lógica de cada ruta (auth, product, sale, audit, settings, user)
│       ├── middleware/    ← filtros que corren ANTES de la lógica (auth, attachIo)
│       ├── routes/        ← el mapa de URLs (/auth, /products, /sales, /audit, /settings, /users)
│       └── sockets/       ← quién escucha las conexiones de Socket.io
│
└── front/                 ← LA INTERFAZ (React + Vite + Socket.io-client)
    ├── package.json
    ├── .env.example
    ├── vite.config.js     ← configuración de Vite (puerto 5173)
    ├── index.html         ← el HTML raíz que carga React
    └── src/
        ├── main.jsx       ← punto de entrada, monta los Providers globales
        ├── App.jsx        ← decide qué vista mostrar (Login / Dashboard / Inventario / Caja / Ventas / Cierre de caja / Auditoría / Configuración / Usuarios)
        ├── styles.css     ← tokens de diseño (tema claro/oscuro/sistema) + animaciones + responsive
        ├── services/
        │   ├── api.js     ← wrapper de fetch: pone el token y la URL base en cada llamada
        │   └── socket.js  ← instancia única de Socket.io (singleton)
        ├── context/       ← estado global compartido (Auth, Product, Sale, Sales, Theme, Preferencias)
        ├── components/    ← piezas de pantalla (Inventario, Caja, Ventas, CierreCaja, Auditoria, Configuracion, Usuarios, Topbar, Toast, Modal…)
        └── pages/         ← Login.jsx y Register.jsx
```

**Regla de oro para no perderse:** si quieres cambiar **cómo se ve** algo, mira
`front/`. Si quieres cambiar **qué hace** el servidor (validaciones, stock,
permisos), mira `back/`. La base de datos se define en `back/prisma/schema.prisma`.

---

<a name="7-paso-2-backend"></a>
## 7. Paso 2 — Correr el BACKEND en local

Abre **una terminal** y sigue estos pasos. El backend escucha en
`http://localhost:4000`.

### 7.1 Instalar dependencias

```bash
cd back
npm install
```

*Qué hace:* lee `package.json` y descarga todas las librerías a `node_modules/`.
Tarda unos segundos. **Deberías ver** al final algo como `added N packages`.

> Si te dice `npm warn deprecated ...` o `found 0 vulnerabilities`, es normal, no
> es un error. Ignóralo.

### 7.2 Crear el archivo `.env`

El `.env` guarda configuraciones que **no** se suben a Git (claves, etc.). Se crea
copiando la plantilla:

```bash
# Windows (PowerShell):
Copy-Item .env.example .env
# Mac/Linux:
cp .env.example .env
```

*Qué hace:* crea `.env` con los mismos valores de ejemplo. Ábrelo con VS Code y
confirma que tenga estas tres líneas (los valores de ejemplo ya sirven para local):

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="cambia-esto-en-produccion-por-una-cadena-larga-aleatoria"
JWT_EXPIRES_IN="1h"
```

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | Dónde está la base de datos. `file:./dev.db` = un archivo SQLite local. |
| `JWT_SECRET` | La clave con la que se firman los tokens de login. En producción **debe** cambiarse por algo largo y secreto. |
| `JWT_EXPIRES_IN` | Cuánto dura el token antes de caducar (`1h` = una hora). |

### 7.3 Crear la base de datos (migrar el esquema)

```bash
npx prisma db push
```

*Qué hace:* lee `prisma/schema.prisma` y crea el archivo `dev.db` con las tablas.
**Deberías ver:**
```
Prisma schema loaded from prisma\schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./dev.db"
SQLite database dev.db created at file:./dev.db
🚀  Your database is now in sync with your Prisma schema.
```

> Vas a ver un warning: `The configuration property 'package.json#prisma' is
> deprecated`. **Es ruido benigno**, significa que Prisma 7 va a mover esa config
> a otro archivo. Nosotros usamos Prisma 6 a propósito (ver §16). Ignóralo.

### 7.4 Sembrar datos de demo

```bash
npx prisma db seed
```

*Qué hace:* corre `prisma/seed.js`, que crea **1 admin** y **5 productos** de
prueba. Sin esto, la base de datos está vacía y no vas a poder loguearte.
**Deberías ver:**
```
Seed OK: 1 admin (hasheado) + 5 productos (2 en alerta de bajo stock).
```

Los productos del seed (memorízalos, te sirven para verificar después):

| Producto | Precio | Stock | Stock mínimo | ¿Bajo mínimo? |
| --- | --- | --- | --- | --- |
| Paracetamol 500mg | S/ 5.50 | 120 | 30 | no |
| Ibuprofeno 400mg | S/ 8.00 | 12 | 20 | **sí** |
| Amoxicilina 500mg | S/ 15.00 | 60 | 15 | no |
| Vitamina C 1g | S/ 12.00 | 5 | 10 | **sí** |
| Solucion salina | S/ 6.00 | 200 | 40 | no |

### 7.5 Levantar el servidor

```bash
npm run dev
```

*Qué hace:* corre `node --watch src/index.js`. El `--watch` reinicia el servidor
solo cada vez que guardas un archivo del backend (cómodo para desarrollar).
**Deberías ver:**
```
Nova Salud API en http://localhost:4000 + Socket.io listo
```

Deja esta terminal **abierta y corriendo**. El backend tiene que estar vivo para
que el front funcione.

### 7.6 Verificar que el backend responde (sin front)

Abre **otra terminal** (o el navegador) y prueba:

```bash
# En el navegador, abre:  http://localhost:4000/products
# O desde PowerShell:
Invoke-RestMethod http://localhost:4000/products | Select-Object id, nombre, stock
```

**Deberías ver** los 5 productos del seed. Si ves eso, el backend está perfecto.
Si ves `[]` (lista vacía), falta el Paso 7.4 (seed). Si da error de conexión, el
`npm run dev` no está corriendo.

---

<a name="8-paso-3-frontend"></a>
## 8. Paso 3 — Correr el FRONTEND en local

**Importante:** el backend (Paso 2) tiene que estar corriendo en otra terminal.
El front le habla al backend; si el backend está apagado, el front va a mostrar
"Cargando inventario…" para siempre o un error de red.

Abre **una segunda terminal**:

### 8.1 Instalar dependencias

```bash
cd front
npm install
```

### 8.2 Crear el `.env` del front

```bash
# Windows:
Copy-Item .env.example .env
# Mac/Linux:
cp .env.example .env
```

Confirma que tenga:

```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

| Variable | Para qué sirve |
| --- | --- |
| `VITE_API_URL` | La URL del backend para las peticiones HTTP (login, productos, ventas). |
| `VITE_SOCKET_URL` | La URL del backend para el WebSocket (tiempo real). |

> En Vite, las variables de entorno **deben** empezar con `VITE_` para que el
> código las pueda leer. Si les pones otro nombre, no funcionan. Y se **hornean en
> el build**: si cambias el `.env`, hay que reiniciar `npm run dev`.

### 8.3 Levantar el front

```bash
npm run dev
```

**Deberías ver:**
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```
Y se abre el navegador solo (configuramos `open: true` en `vite.config.js`). Si no
se abre, entra manual a `http://localhost:5173`.

### 8.4 Verificar de punta a punta

1. En `http://localhost:5173` deberías ver la pantalla de **Login**.
2. Inicia sesión con las credenciales del seed:
   - Email: `admin@novasalud.pe`
   - Contraseña: `admin123`
3. Deberías entrar al **Dashboard** (panel de métricas del día). Desde la barra lateral navega a **Inventario**: verás una **tabla** con los 5 productos, chips de resumen `5 productos / 2 bajo mínimo` y badges **Reponer** en Ibuprofeno y Vitamina C.

Si llegaste hasta aquí, **el proyecto corre completo en tu PC**. 🎉

---

<a name="9-uso-y-roles"></a>
## 9. Cómo usar la aplicación (y qué puede hacer cada rol)

En la **barra superior** (Topbar) verás un **saludo dinámico** con tu nombre (p. ej. "Buenos días, Juan"), la **fecha y hora exacta en vivo** (actualizada cada segundo) y, a la derecha, tu **avatar circular** con iniciales. Al hacer clic se abre un **menú** con tu nombre, email, chip de rol, la opción **Mi perfil** y **Salir**. El menú se cierra al hacer clic fuera, con `Escape` o navegando con teclado (flechas, Home, End). A la izquierda, la **barra lateral (sidebar)** muestra las secciones disponibles según tu rol:

| Sección | Qué hace | Quién la ve |
| --- | --- | --- |
| **Dashboard** | Panel de control con metricas del dia (ventas, recaudado, ticket promedio, unidades, producto mas vendido, stock critico, vencimientos y recaudado por metodo de pago). | Todos los roles (vista adaptada por rol). |
| **Inventario** | Muestra los medicamentos con precio, stock, vencimiento y semaforo de reposicion. Admin/farma pueden crear, editar, activar/desactivar, recibir mercaderia y filtrar por vencimiento o inactivos. | Todos leen; solo admin/farma editan. |
| **Caja** | La pantalla de venta: buscas un medicamento, lo agregas al ticket, eliges metodo de pago, calculas vuelto y presionas Cobrar. El total y el vuelto los calcula el backend. | Todos los roles. |
| **Ventas** | Historial de tickets con filtros por fecha/usuario, paginacion, reimpresion de comprobante, anulacion y exportacion Excel. Se actualiza en vivo. | Solo admin/farma. |
| **Cierre de caja** | Resumen por fecha y usuario: cantidad de ventas, total por metodo de pago, efectivo esperado y anuladas. Permite imprimir o exportar Excel. | Todos los roles (cada uno ve solo lo propio; admin/farma ven todos). |
| **Usuarios** | Gestion de usuarios, roles, activacion/desactivacion y alta de usuarios. | Solo admin. |
| **Auditoria** | Historial de acciones del sistema (login, ventas, anulaciones, productos, entradas de stock, usuarios y configuracion) con diff de cambios. | Solo admin/farma. |
| **Configuracion** | Ajustes globales (nombre, lema, moneda, umbral de stock, ayuda demo). **Solo admin** (cajero y farmacéutico no ven esta sección). **Tema**: todos los roles lo cambian desde **Mi perfil → Tema** (o el admin desde Configuración → Apariencia). **Fuente, modo compacto, formato de fecha y filas por página**: solo admin en Configuración → Apariencia / Preferencias. | Solo admin |

| Rol | Ver Dashboard | Leer inventario | Editar/borrar inventario | Vender (caja) | Ver historial de ventas | Ver Auditoría |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **farmaceutico** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **cajero** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |

> **Cómo se prueba el registro de un cajero:** en la pantalla de Login, haz clic en
> *Regístrate*, completa nombre/email/contraseña. El backend **fuerza** el rol
> `cajero` en el registro público (nadie puede auto-crearse admin). Al registrarte
> entras directo (login automático).

### La magia del tiempo real (pruébala con dos pestañas)

1. Abre `http://localhost:5173` en **dos pestañas** del navegador y inicia sesión como
   admin en las dos.
2. En la pestaña A, ve a **Caja** y registra una venta de **Ibuprofeno ×2** (stock 12 → 10; **ya está bajo el mínimo 20 y la alerta se emite igual**).
3. Mira la pestaña B (en Inventario o en Ventas): **el stock baja solo** (12 → 10), aparece el toast rojo **"Reponer: Ibuprofeno"** y el ticket se muestra en Ventas, sin que toques nada ni recargues.

Eso es Socket.io: el backend emite `stock_actualizado`, `alerta_bajo_stock` y
`venta_registrada`, y todos los clientes conectados los reciben en vivo.

> **Detalle de sesión:** el login vive en el `localStorage` del navegador, que es
> **compartido entre pestañas del mismo sitio**. Si en una pestaña haces *Salir*,
> la otra también se desloguea sola (sincronizamos eso con el evento `storage` del
> navegador). Es a propósito: una sesión por navegador.

---

<a name="10-api"></a>
## 10. Referencia de la API (endpoints)

Base local: `http://localhost:4000`. Todas las rutas que dicen 🔒 requieren el
header `Authorization: Bearer <token>` (el token que devuelve `/auth/login`).

### Autenticación (`/auth`)

| Método | Ruta | Auth | Qué hace |
| --- | --- | :---: | --- |
| POST | `/auth/register` | ❌ | Crea un usuario. **Fuerza rol `cajero`** (no acepta rol del body). Devuelve `{ user }` sin token. |
| POST | `/auth/login` | ❌ | Valida email/contraseña (contra el hash). Devuelve `{ token, user }`. |
| GET | `/auth/me` | 🔒 | Devuelve el usuario del token vigente. Sirve para validar sesión al recargar. |

### Inventario (`/products`)

| Método | Ruta | Auth | Qué hace |
| --- | --- | :---: | --- |
| GET | `/products` | ❌ | Lista todos los productos. |
| GET | `/products/:id` | ❌ | Un producto por id. |
| GET | `/products/:id/movimientos` | admin/farma | Historial de movimientos de stock (INICIAL, AJUSTE, VENTA, ANULACION, ENTRADA). |
| POST | `/products` | 🔒 admin/farma | Crea producto (whitelist de campos). Devuelve 201. |
| PUT | `/products/:id` | 🔒 admin/farma | Actualiza producto (incluye `activo`). |
| PUT | `/products/:id/estado` | admin/farma | Activa o desactiva un producto. |
| POST | `/products/:id/entrada` | admin/farma | Recibe mercaderia: suma stock, crea movimiento ENTRADA y audita STOCK_ENTRY. |
| DELETE | `/products/:id` | admin/farma | Borra producto. **409 si tiene ventas historicas** (trazabilidad). |

### Ventas (`/sales`)

| Método | Ruta | Auth | Qué hace |
| --- | --- | :---: | --- |
| POST | `/sales` | todos los roles | Registra venta atómica: valida stock, congela precio de BD, crea venta, descuenta stock, emite eventos. Body: `{ detalles: [{ productoId, cantidad }], metodoPago?, montoRecibido?, nota? }`. |
| GET | `/sales` | admin/farma | Historial con lineas, producto y quien atendio (sin passwordHash). Filtros opcionales: `desde`, `hasta`, `usuarioId`. 403 para cajero. |
| GET | `/sales/mi-turno` | todos los roles | Ventas del usuario autenticado. |
| GET | `/sales/cierre` | todos los roles | Cierre de caja por fecha y usuario (totales por metodo, efectivo esperado, anuladas). |
| GET | `/sales/export` | admin/farma | Exporta a Excel (respeta filtros y excluye anuladas). |
| POST | `/sales/:id/anular` | admin/farma | Anula una venta (motivo >= 5), repone stock y audita SALE_VOID. |

### Auditoría (`/audit`)

| Método | Ruta | Auth | Qué hace |
| --- | --- | :---: | --- |
| GET | `/audit` | 🔒 admin/farma | Lista el registro de acciones del sistema (login, ventas, productos, configuración). |

### Configuración (`/settings`)

| Método | Ruta | Auth | Qué hace |
| --- | --- | :---: | --- |
| GET | `/settings` | ❌ | Devuelve la configuración global (pública). |
| PUT | `/settings` | 🔒 admin | Actualiza la configuración global y audita los cambios. |


### Usuarios (`/users`)

| Metodo | Ruta | Auth | Que hace |
| --- | --- | :---: | --- |
| GET | `/users` | admin | Lista usuarios sin passwordHash. |
| POST | `/users` | admin | Crea usuario con rol elegido. |
| PUT | `/users/:id` | admin | Actualiza nombre y/o rol. |
| PUT | `/users/:id/estado` | admin | Activa o desactiva un usuario. |

### Perfil propio (`/auth`)

| Metodo | Ruta | Auth | Que hace |
| --- | --- | :---: | --- |
| PUT | `/auth/me` | usuario | Actualiza el nombre del usuario autenticado. |
| PUT | `/auth/password` | usuario | Cambia la contrasena validando la actual. |

### Ejemplo de login + venta desde PowerShell (para probar sin front)

```powershell
# 1) Login y guardar token
$body = @{ email = "admin@novasalud.pe"; password = "admin123" } | ConvertTo-Json
$tok = (Invoke-RestMethod -Uri http://localhost:4000/auth/login -Method Post -ContentType "application/json" -Body $body).token

# 2) Registrar una venta (solo productoId y cantidad; el precio lo pone el backend)
$venta = @{ detalles = @( @{ productoId = 1; cantidad = 2 } ) }
Invoke-RestMethod -Uri http://localhost:4000/sales -Method Post -Headers @{ Authorization = "Bearer $tok" } -ContentType "application/json" -Body ($venta | ConvertTo-Json -Compress)
```

> **Trampa de PowerShell:** si usas `curl.exe -d` con un JSON de `ConvertTo-Json`,
> las comillas se deforman y el backend responde 400 con `SyntaxError`. Usa
> `Invoke-RestMethod` (como arriba) o agrega `-Compress` al `ConvertTo-Json`.
> Esto ya nos mordió; está en §15.

---

<a name="pruebas"></a>
## 10.1 Pruebas

El backend incluye 54 pruebas automatizadas con `node:test`:

```bash
cd back
npm test
```

Cubren: autenticación y auditoría, perfil propio, permisos por rol, ventas atómicas (precio de BD, descuento de stock, rollback), filtros de ventas, validación de productos, inventario ampliado y trazabilidad, configuración, gestión de usuarios, métodos de pago, anulación de ventas, productos inactivos y entradas de mercadería, y cierre de caja.

---

<a name="11-socket"></a>
## 11. Eventos de Socket.io (tiempo real)

El backend **emite** estos eventos después de una venta exitosa. El front los
escucha y actualiza la pantalla. Dirección: **server → cliente** (broadcast a
todos los conectados). El socket es **solo lectura**: no se puede mutar el stock
por él (la única puerta de escritura es `POST /sales` con token).

| Evento | Payload (ejemplo) | Qué provoca en el front |
| --- | --- | --- |
| `stock_actualizado` | `[{ id, nombre, stock }]` | Baja el número de stock en Inventario y Caja **sin recargar**. |
| `alerta_bajo_stock` | `[{ id, nombre, stockNuevo, stockMinimo }]` (se emite para los productos que quedan **en o bajo el mínimo** tras la venta: `stockNuevo ≤ stockMinimo`) | Muestra un **toast** rojo "Reponer: …". |
| `venta_registrada` | `{ id, fecha, total, atendidoPor:{id,nombre,rol}, detalles:[…] }` | Agrega el ticket al historial de **Ventas** en vivo. |
| `venta_anulada` | `{ id, estado, anuladaEn, motivoAnulacion, anuladaPor }` | Marca la venta como anulada en **Ventas** en vivo. |

Si vas a tocar el front y quieres reaccionar a una venta, suscríbete en el
contexto correspondiente (`ProductContext` para stock/alerta, `SalesContext` para
historial). **No** conectes ni desconectes el socket desde otro lado: el dueño de
la conexión es `ProductContext` (singleton, un solo dueño).

---

<a name="12-datos"></a>
## 12. Modelo de datos (las tablas)

Fuente de verdad: `back/prisma/schema.prisma`. Resumen de los 7 modelos:

| Modelo | Campos principales | Relación |
| --- | --- | --- |
| **Usuario** | `id`, `nombre`, `email` (unico), `passwordHash` (nunca se expone), `rol` (`admin` \| `farmaceutico` \| `cajero`), `activo` (Boolean) | 1 Usuario -> muchas Ventas (`atendidoPor`), ventas anuladas (`anuladaPor`), `MovimientoStock` y `AuditLog`. |
| **Producto** | `id`, `nombre`, `descripcion`, `precio` (Float), `stock` (Int), `stockMinimo` (Int), `imagen` (String), `codigo` (SKU, unico, autogenerado `P-0001`), `codigoBarras` (unico), `categoria`, `proveedor`, `unidad`, `precioCompra` (Float), `fechaVencimiento` (DateTime), `activo` (Boolean) | 1 Producto -> muchos DetalleVenta y MovimientoStock. |
| **Venta** | `id`, `fecha` (DateTime), `total` (Float), `usuarioId` (FK), `metodoPago` (EFECTIVO/TARJETA/YAPE_PLIN), `montoRecibido` (Float?), `vuelto` (Float?), `estado` (COMPLETADA/ANULADA), `anuladaPorId` (FK?), `anuladaEn` (DateTime?), `motivoAnulacion` (String?), `nota` (String?) | 1 Venta -> muchos DetalleVenta. |
| **DetalleVenta** | `id`, `ventaId` (FK), `productoId` (FK), `cantidad` (Int), `precioUnitario` (Float, congelado al vender) | Une Venta ↔ Producto. |
| **MovimientoStock** | `id`, `productoId` (FK), `usuarioId` (FK), `tipo` (INICIAL \| AJUSTE \| VENTA \| ANULACION \| ENTRADA), `cantidad` (delta), `stockAnterior`, `stockNuevo`, `motivo`, `creadoEn` | Trazabilidad de stock por producto. |
| **Configuracion** | `id` (único = 1), `nombreNegocio`, `lema`, `moneda`, `umbralStockBajo`, `mostrarAyudaDemo`, `actualizadoEn` | Ajustes globales de la botica. |
| **AuditLog** | `id`, `userId` (FK), `accion`, `entidad`, `entidadId`, `detalle` (JSON), `ip`, `userAgent`, `fecha` | Registro de acciones del sistema. |

**Por qué `precioUnitario` está en DetalleVenta y no se calcula al leer:** cuando
vendes, el precio de ese momento se **congela** en la línea. Si mañana sube el
precio del producto, el ticket histórico sigue mostrando lo que realmente se
cobró. Eso es trazabilidad financiera.

**Por qué no se puede borrar un Producto con ventas:** `DetalleVenta` apunta al
Producto con una clave foránea. Borrar el producto rompería tickets históricos.
Por eso `DELETE /products/:id` responde **409** si el producto tiene ventas (§10).

---

<a name="13-env"></a>
## 13. Variables de entorno (todas)

Ningún `.env` se sube a Git (está en `.gitignore`). Cada carpeta tiene su
`.env.example` que se copia a `.env`.

### Backend (`back/.env`)

| Variable | Ejemplo local | En Render (producción) |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | `file:./dev.db` (SQLite efímero; ver §14) |
| `JWT_SECRET` | cualquier cadena | una cadena larga aleatoria, **secreta** |
| `JWT_EXPIRES_IN` | `1h` | `1h` |
| `PORT` | (no hace falta, default 4000) | **no la pongas**: Render la inyecta (default 10000) |
| `CORS_ORIGIN` | `http://localhost:5173` | `https://TU-FRONT.onrender.com` (URL pública exacta del front en Render, **sin barra final**) |

> **Importante:** `CORS_ORIGIN` **debe** coincidir exactamente con la URL de tu front en Render. Sin ella, el backend usa `http://localhost:5173` como fallback y **bloqueará las peticiones del front desplegado** (CORS error).

> **Orden de despliegue en Render:** 1) Crear backend con `CORS_ORIGIN` provisional (ej. `http://localhost:5173`). 2) Crear front (Static Site) apuntando a la URL del backend. 3) Copiar la URL exacta del front (sin barra final, ej. `https://nova-salud-1.onrender.com`). 4) Volver al backend en Render, actualizar `CORS_ORIGIN` con esa URL y **guardar la variable (Render redeploya solo) o Manual Deploy**.

### Frontend (`front/.env`)

| Variable | Ejemplo local | En Render (producción) |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:4000` | la URL pública del backend (§14) |
| `VITE_SOCKET_URL` | `http://localhost:4000` | la URL pública del backend (§14) |

> Recuerda: en Vite solo se leen las que empiezan con `VITE_`, y se **hornean en el
> build**. Por eso el front se despliega **después** de tener la URL del backend.

---

<a name="14-render"></a>
## 14. Paso 4 — Desplegar en Render (producción)

Desplegar = publicar el proyecto a internet con una URL pública. Render lo hace
en dos servicios separados (porque son dos runtimes distintos). **El orden
importa: primero el backend, después el frontend**, porque el front necesita la
URL del back para compilar.

> **Antes de empezar:** necesitas cuenta en [render.com](https://render.com)
> (gratis, se crea con GitHub). Render ve tus repos, incluidos los privados de
> `yusgreen` si estás logueado con esa cuenta.

### 14.1 Desplegar el BACKEND (Web Service)

1. En el dashboard de Render: **New → Web Service**.
2. Conecta el repo `yusgreen/nova-salud` (rama `main`).
3. Configura:

    | Campo | Valor |
    | --- | --- |
    | **Root Directory** | `back` |
    | **Build Command** | `npm install && npx prisma generate` |
    | **Start Command** | `npx prisma db push && npx prisma db seed && node src/index.js` |
    | **Environment** | Node |
    | **Instance Type** | Free |

4. En **Environment Variables**, agrega:

    | Key | Value |
    | --- | --- |
    | `DATABASE_URL` | `file:./dev.db` |
    | `JWT_SECRET` | (cadena larga aleatoria, secreta) |
    | `JWT_EXPIRES_IN` | `1h` |
    | `NODE_ENV` | `development` |
    | `CORS_ORIGIN` | `http://localhost:5173` (provisional; se actualizará tras crear el front) |

> **¿Por qué `NODE_ENV=development`?** Render pone `production` por defecto, y
> eso hace que `npm install` **omite** las `devDependencies`. La CLI de Prisma
> está en devDeps y el *start command* la usa; si no está, el deploy falla. Con
> `development` se instalan todas y el arranque es determinístico. (Esto ya nos
> mordió; ver §15.)

> **Importante — orden de despliegue y `CORS_ORIGIN`:**
> 1. Crea el backend **con `CORS_ORIGIN` provisional** (`http://localhost:5173`).
> 2. Crea el front (Static Site, §14.2) apuntando a la URL del backend.
> 3. Copia la URL exacta del front (sin barra final, ej. `https://nova-salud-1.onrender.com`).
> 4. Vuelve al backend en Render, actualiza `CORS_ORIGIN` con esa URL exacta y **guarda la variable (Render redeploya solo) o Manual Deploy**.
> Sin `CORS_ORIGIN` correcta, el backend usa `http://localhost:5173` como fallback y **bloqueará las peticiones del front desplegado** (CORS error).

5. **Create Web Service**. Espera a que diga **Live**. Copia la URL, se ve así:
   `https://nova-salud-XXXX.onrender.com`.
6. **Verifica** abriendo en el navegador:
   - `https://nova-salud-XXXX.onrender.com/` → `{"ok":true,"service":"nova-salud-api"}`
   - `https://nova-salud-XXXX.onrender.com/products` → los 5 productos del seed.

   Si `/products` devuelve `[]`, el seed no corrió (revisa los logs). Si da error,
   mira **Logs** del servicio (§15).

### 14.2 Desplegar el FRONTEND (Static Site)

1. **New → Static Site**. Conecta el mismo repo, rama `main`.
2. Configura:

    | Campo | Valor |
    | --- | --- |
    | **Root Directory** | `front` |
    | **Build Command** | `npm install && npm run build` |
    | **Publish Directory** | `dist` |

3. En **Environment Variables**, agrega las **dos** apuntando a la URL del backend
   del paso 14.1 (sin `/products` ni nada al final, solo la raíz):

    | Key | Value |
    | --- | --- |
    | `VITE_API_URL` | `https://nova-salud-XXXX.onrender.com` |
    | `VITE_SOCKET_URL` | `https://nova-salud-XXXX.onrender.com` |

4. **Create Static Site**. Espera **Live**. Copia su URL (ej.
   `https://nova-salud-1.onrender.com`).
5. **Verifica** abriendo la URL del front: debería mostrar el Login. Inicia sesión con
   `admin@novasalud.pe` / `admin123` y confirma que entras al **Dashboard**. Desde la barra lateral navega a **Inventario** y verifica la tabla con los 5 productos.

### 14.3 Cómo se actualiza el deploy después

Cada `git push` a `main` **redeploya los dos servicios solos** (Render hace
auto-deploy con cada push). No necesitas tocar el dashboard. Solo usa
**Manual Deploy → Clear build cache & deploy** si sospechas que el build reusó
algo viejo y no reflejó tu cambio (por ejemplo, cuando un commit no llegó al repo).

### 14.4 Limitaciones del plan gratis (léelas, no son bugs)

- **Cold start:** el backend se duerme tras ~15 min sin tráfico. Al abrir el link
  de nuevo, tarda **30–60 s** en despertar (Render muestra una pantalla de carga).
  *Truco de demo:* 30 s antes de presentar, abre tú la URL del backend para
  calentarlo. **No cambies variables de entorno entre el calentamiento y la demo** (un cambio dispara redeploy y reinicia la BD).
- **Filesystem efímero:** el `dev.db` se pierde cuando el servicio se reinicia o
  redeploya. Por eso el *start command* corre `db push && db seed` en cada
  arranque: la demo **siempre** levanta con los 5 productos y el admin. Las ventas
  hechas en vivo se pierden al reinicio. **Cada redeploy o reinicio del servicio reinicia la BD completa** (se pierden también los usuarios registrados en vivo durante la demo; para persistencia real se usaría Postgres, ver §17).

---

<a name="15-troubleshooting"></a>
## 15. Solución de problemas comunes

Estos son los errores **reales** que ya enfrentó el equipo y cómo se resolvieron.
Si te topas con uno, ya tiene respuesta.

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `git clone` dice `Repository not found` o pide login y falla | No te invitaron al repo privado, o estás logueado en Git con otra cuenta. | Pide a Ángel que te invite (Paso 0) y **acepta** la invitación. Verifica con qué cuenta estás: `gh auth status`. |
| `npm run dev` del backend: `Cannot find module 'socket.io'` (o cualquier módulo) | Esa dependencia no está en `package.json` (se instaló en otra carpeta o no se commiteó). Render clona el manifiesto, no tu disco. | `cd back && npm install socket.io` (o la que falte), confirma que aparece en `dependencies` del `package.json`, commit + push. |
| Deploy de Render falla en el *start* con `prisma: command not found` | `NODE_ENV=production` (default de Render) omitió las devDeps, y la CLI de Prisma es devDep. | Pon `NODE_ENV=development` en las env vars del servicio y vuelve a desplegar con *Clear build cache*. |
| `npx prisma db push` da `P1012` o error de `datasource.url` | Estás usando Prisma 7, que mueve la config a `prisma.config.ts` y exige ESM. | Este proyecto usa **Prisma 6.19.3** a propósito. No subas a 7 (ver §16). Si tu `package.json` dice `prisma@^7`, vuelve a `^6.19.3` y `npm install`. |
| Warning `package.json#prisma is deprecated` en los logs | Prisma 6 avisa que en v7 eso se muda. | **Ruido benigno.** Ignóralo. No rompe nada en v6. |
| El front muestra "Cargando inventario…" para siempre o error de red | El backend no está corriendo, o `VITE_API_URL` apunta a un lugar equivocado. | Levanta el backend (Paso 2). En local debe ser `http://localhost:4000`. Si cambiaste el `.env` del front, reinicia `npm run dev` (las `VITE_*` se hornean al arrancar). |
| Login da `Credenciales inválidas` con `admin@novasalud.pe`/`admin123` | No corriste el seed, o la BD se reseteó. | `cd back && npx prisma db seed`. En Render, el seed corre solo al arrancar (start command). |
| `curl.exe -d '{...}'` en PowerShell da 400 `SyntaxError: Expected property name` | PowerShell deforma las comillas del JSON al pasarlas a `curl.exe`. | Usa `Invoke-RestMethod` (ve el ejemplo en §10) o agrega `-Compress` al `ConvertTo-Json`. |
| Un `const` dentro del JSX da `ts(1382) Unexpected token` | En JSX, entre tags solo van elementos, texto o expresiones `{}`; una sentencia `const` suelta no es válida ahí. | Mueve el `const` arriba del `return`, al bloque de JS del `.map()`. |
| El deploy de Render "no refleja mi cambio" | El commit no llegó al repo, o el build reusó caché vieja. | `git log --oneline` para confirmar que tu commit está; `git push`; y si persiste, *Manual Deploy → Clear build cache & deploy*. |
| El backend de Render tarda 30–60 s en responder la primera vez | Cold start del plan gratis. | Normal. Calienta el servicio abriendo `/` 30 s antes de presentar. |
| `ssh -T git@github.com` da `Bad configuration option: \357\273\277host` | Tu `~/.ssh/config` se guardó con BOM (UTF-8 con BOM de PowerShell 5). | Reescribe el config **sin BOM** (en VS Code: *Save with Encoding → UTF-8*, no "UTF-8 with BOM"). |
| Front desplegado muestra "Cargando inventario…" o error de red / consola: `CORS error` / `Failed to fetch` | `CORS_ORIGIN` en backend no coincide con la URL exacta del front en Render (falta, tiene barra final, o apunta a localhost). | En Render, backend → Environment Variables → `CORS_ORIGIN` = URL exacta del front **sin barra final** (ej. `https://nova-salud-1.onrender.com`). Haz **Manual Deploy → Clear build cache & deploy**. |

> **Regla de oro para diagnosticar:** lee el error completo, separa la señal (la
> línea que dice `Error:` o `Cannot find`) del ruido (warnings, `npm warn`,
> `deprecated`). La mayoría de los "errores" de arriba son ruido que se suele
> confundir con la causa. Empieza siempre por los **logs** del servicio en Render.

---

<a name="16-arquitectura"></a>
## 16. Decisiones de arquitectura (para la defensa)

Estas son las elecciones no obvias y **por qué** se tomaron. Sirven para responder
"¿y por qué así?" el 7 de noviembre.

- **Prisma 6.19.3 y no v7.** La guía oficial de upgrade a v7
  (`pris.ly/d/major-version-upgrade`) lista breaking changes incompatibles con
  este proyecto: v7 se distribuye como **ES module** y exige `"type": "module"`
  (nosotros usamos `require()`/CommonJS en todo el backend); el provider
  `prisma-client-js` se reemplaza por `prisma-client` con `output` obligatorio y
  nuevos imports; `datasource.url` en el schema queda deprecado y se mueve a
  `prisma.config.ts` (donde el helper `env()` **lanza error si la variable no
  existe**, rompiendo comandos como `prisma generate`); el seed migra de
  `package.json#prisma` a `migrations.seed`; y se requieren *driver adapters*.
  Quedarse en v6 mantiene el patrón clásico compatible con CommonJS. La migración
  a v7 queda como mejora futura (§17).
- **SQLite + seed al arrancar (no Postgres).** Producción (Render) usa SQLite
  (archivo `dev.db`), no PostgreSQL. Para una demo académica en plan
  gratis, SQLite (un archivo) es suficiente y no requiere servicio de BD
  administrado. El filesystem de Render es efímero, así que el *start command*
  re-siembra en cada arranque. Postgres persistente (con `migrate deploy` en vez
  de `db push`) es la mejora futura natural.
- **JWT stateless (no sesión en memoria).** El token se auto-describe (lleva el
  rol dentro) y caduca solo (`exp - iat = 1h`). El servidor **no** guarda sesión
  en un `Map`: por eso sobrevive a reinicios de Render (un `Map` en memoria se
  vacía al dormir el servicio y desconectaría a todos).
- **bcryptjs (no bcrypt).** `bcrypt` requiere compilación nativa (node-gyp), que
  da problemas en algunos entornos; `bcryptjs` es puro JS y funciona igual para el
  propósito. La contraseña **nunca** se guarda en texto ni se expone en ninguna
  respuesta (los `select` de Prisma excluyen `passwordHash`).
- **El backend es el árbitro (condición de carrera).** El front valida stock para
  UX (deshabilita el `+`), pero la **verdad** la dice el backend dentro de una
  transacción: si dos cajas venden lo mismo a la vez, el back frena a la segunda
  con 400 y hace **rollback** (no se crea la venta ni se toca el stock). El front
  manda intención; el servidor manda verdad.
- **Precio congelado desde la BD.** `POST /sales` ignora cualquier `precio` o
  `total` que mande el cliente y recalcula desde `Producto.precio`. Así nadie
  puede "comprar" un Paracetamol a S/ 0.01 manipulando el body.
- **Socket.io como canal de notificación, no de negocio.** El descuento de stock
  ocurre en la transacción REST; el socket solo **reparte la noticia** (`stock_actualizado`, `alerta_bajo_stock` **se emite para los productos que quedan en o bajo el mínimo tras la venta** (`stockNuevo ≤ stockMinimo`), `venta_registrada`, `venta_anulada`). Un cliente
  malicioso no puede mutar el stock por WebSocket (es read-only, sin token, porque
  lo que expone ya es público en `GET /products`).
- **`req.io?.emit` con optional chaining.** El controller de venta se escribió en
  la fase de backend **antes** de montar el socket. El `?.` hace que los `emit`
  sean no-op si aún no hay canal, y cobren vida solos al enchufarlo, **sin editar
  el controller**. Es un "hueco planeado": la arquitectura previó el futuro.
- **Roles modelados por recurso, no globales.** `/products` (admin/farma escriben),
  `/sales` POST (todos venden), `/sales` GET (admin/farma auditan). Mismos
  middlewares (`requireAuth`, `requireRole`), composiciones distintas según quién
  hace qué en la botica real. El front oculta y el back arbitra (triple guarda).
- **Política de borrado = bloquear (no soft-delete, no cascada).** Borrar un
  producto con ventas rompería el historial (FK). El backend cuenta
  `DetalleVenta` antes de borrar y responde 409 con mensaje humano. Preserva
  trazabilidad sin tocar el schema.
- **Sin React Router (por ahora).** La alternancia de vistas (Login / Dashboard /
  Inventario / Caja / Ventas / **Cierre de caja** / Auditoría / Configuración / **Usuarios**) se hace con estado, no
  con rutas. Reduce superficie de error para un equipo pequeño; migrar a Router es
  mejora futura (§17).
- **Auditoría con diff.** `PRODUCT_UPDATE` guarda en `detalle.cambios` el valor
  anterior y nuevo de cada campo modificado; `CONFIG_UPDATE` audita los cambios de
  configuración. Permite trazabilidad completa sin tablas extra.
- **Trazabilidad de stock.** Cada cambio de inventario genera un `MovimientoStock`
  con stock anterior/nuevo y usuario, consultable por admin/farmacéutico. Tipos:
  **INICIAL** (seed), **AJUSTE** (admin/farma), **VENTA** (caja), **ANULACION** (admin/farma), **ENTRADA** (recepción mercancía).
- **Sistema de temas.** La preferencia (claro/oscuro/sistema) se persiste en
  `localStorage` y se aplica como `data-theme` en `<html>` con script inline
  anti-parpadeo; "sistema" sigue `prefers-color-scheme`.
- **Configuración: BD vs localStorage.** Los ajustes globales (nombre, lema, moneda,
  umbral, ayuda demo) viven en BD y solo el admin los edita; las preferencias
  personales (tema, compacto, fuente, formato, filas) viven en `localStorage`.

---

<a name="17-mejoras"></a>
## 17. Mejoras futuras (no incluidas a propósito)

El alcance se cerró para cumplir el enunciado sin inflar. Estas ideas quedaron
fuera **a decisión**, no por olvido. Si el grupo quiere extender después de la
entrega, van por aquí:
- **Postgres gestionado** en vez de SQLite efemero, para que las ventas de la demo persistan (requiere cambiar `provider` en el schema y usar `migrate deploy`).
- **Migrar a Prisma 7** siguiendo la guia oficial (ESM, `prisma.config.ts`, driver adapters, seed en `migrations.seed`).
- **React Router** para rutas reales (`/inventario`, `/caja`, `/ventas/:id`) en vez de estado.
- **Rooms de Socket.io por rol** para alertas privadas en vez de broadcast global.
- **Render de pago** para eliminar cold start y sleep.
- **Imagenes reales** de productos (hoy el front muestra la inicial como placeholder; el campo `imagen` ya existe en el modelo para cuando haya assets).

---

<a name="18-checklist"></a>
## 18. Checklist de entrega (7 de noviembre)

- [ ] Repo `yusgreen/nova-salud` con todo el código commiteado y pusheado.
- [ ] Este `README.md` actualizado.
- [ ] Backend desplegado en Render, URL pública respondiendo `/` y `/products`.
- [ ] Frontend desplegado en Render, URL pública mostrando Login → Dashboard.
- [ ] Prueba de tiempo real en vivo: dos pestañas, vender en una y ver la otra
      actualizarse sola (stock + toast + ticket en Ventas).
- [ ] Prueba de roles: cajero sin botones de edición ni pestaña Ventas (y 403 por
      API si intenta).
- [ ] Prueba de venta atómica: stock insuficiente → 400 y el stock **no** cambia.
- [ ] Pruebas: `cd back && npm test` (54 pruebas) pasando.
- [ ] Tema claro/oscuro/sistema: cambiar desde **Mi perfil → Tema** (todos los roles).
- [ ] Invitar al profesor como colaborador del repo (rol **Write**).
- [ ] Documentación: propuesta de las 5 preguntas guía + 4 diagramas (casos de uso,
      arquitectura, flujo de venta, ER) + plantilla completa.
- [ ] Video demo (si el curso lo pide).
- [ ] `NOTAS.md` al día (bitácora de decisiones y errores resueltos).

---

## Créditos

Trabajo académico del curso de Full Stack Developer. Autor: **Ángel** (cuenta
GitHub `yusgreen`). Stack: Node.js · Express 5 · Prisma 6 · SQLite · JWT ·
bcryptjs · Socket.io · React 18 · Vite 5 · Render.

> ¿Dudas? Revisa primero §15 (Solución de problemas). Si no está ahí, pregunta en
> el grupo con el **error completo** (no "no funciona", sino el mensaje literal de
> la terminal o los logs de Render). Así se resuelve en minutos, no en horas.
