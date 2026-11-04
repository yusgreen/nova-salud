# DIAGRAMAS.md — Diagramas simplificados para slides (copia y pega en mermaid.live)

> Cada bloque está listo para usar en <https://mermaid.live>. Ajusta tema/tamaño y descarga como **PNG** o **SVG** para PowerPoint.

---

## 1. Arquitectura general (slide 3)

```mermaid
flowchart LR
  subgraph Cliente
    F[Frontend React + Vite\npuerto 5173 / Render Static]
  end
  subgraph Servidor
    B[Backend Express 5\npuerto 4000 / Render Web Service]
    S[Socket.io\nmismo proceso]
    P[(SQLite dev.db\nPrisma ORM)]
  end
  F -- "REST (HTTPS)\nJWT Bearer" --> B
  F -- "WebSocket (WSS)\nSocket.io" --> S
  B --- P
  S -. "emit: stock_actualizado\nalerta_bajo_stock\nventa_registrada\nventa_anulada" .-> F
```

> Clave: **REST y WebSocket al mismo servidor (backend); front y back son orígenes distintos, por eso `CORS_ORIGIN`**, **backend árbitro**, **BD aislada**.

---

## 2. ER simplificado — solo Venta, DetalleVenta, Producto (slide 4)

```mermaid
erDiagram
  Producto ||--o{ DetalleVenta : "aparece en"
  Venta ||--|{ DetalleVenta : "contiene"
  Venta {
    int id PK
    datetime fecha
    float total
    string metodoPago
    string estado
    int usuarioId FK
  }
  DetalleVenta {
    int id PK
    int ventaId FK
    int productoId FK
    int cantidad
    float precioUnitario
  }
  Producto {
    int id PK
    string nombre
    float precio
    int stock
    int stockMinimo
    boolean activo
  }
```

> **Uso en slide**: 3 entidades + relaciones. La completa (7 tablas) queda como respaldo técnico.

---

## 3. Flujo de venta atómica — 6 pasos (slide 6)

```mermaid
sequenceDiagram
  participant C as Caja
  participant B as Backend
  participant DB as BD (tx)
  C->>B: POST /sales {detalles, metodoPago, montoRecibido?}
  B->>DB: BEGIN TX
  B->>DB: Por cada línea: SELECT producto → valida stock/activo → congela precio
  alt Stock OK
    B->>DB: INSERT Venta + DetalleVenta (precioUnitario = precio_BD)
    B->>DB: UPDATE Producto stock -= cantidad
    B->>DB: INSERT MovimientoStock (VENTA)
    B->>DB: COMMIT
    B-->>C: 201 {venta, vuelto, alertasGeneradas}
    B->>Socket: emit stock_actualizado, alerta_bajo_stock, venta_registrada
  else Stock insuficiente / inactivo
    B->>DB: ROLLBACK
    B-->>C: 400 error
  end
  B->>Audit: auditar SALE_CREATE
```

> **Uso en slide**: 6 pasos caben en una diapositiva. La completa (con validación fuera de tx, agrupación de líneas, SELECT usuario dentro de tx, `req.io?.emit`, auditoría post-commit) queda como respaldo técnico.

---

## 4. Casos de uso por rol (slide 8)

```mermaid
flowchart TD
  subgraph Admin["admin (acceso total)"]
    A1[Dashboard]
    A2[Inventario: CRUD + recepción + filtros]
    A3[Caja: vender]
    A4[Ventas: historial + anular + exportar]
    A5[Cierre: todos los usuarios]
    A6[Usuarios: CRUD + activar/desactivar]
    A7[Auditoría: log completo + diff]
    A8[Configuración: global]
    A9[Topbar: saludo + avatar menú + perfil]
  end
  subgraph Farma["farmacéutico (gestión inventario)"]
    F1[Dashboard]
    F2[Inventario: CRUD + recepción + filtros]
    F3[Caja: vender]
    F4[Ventas: historial + anular + exportar]
    F5[Cierre: todos los usuarios]
    F6[Auditoría: log completo + diff]
    F7[Topbar: saludo + avatar menú + perfil]
  end
  subgraph Cajero["cajero (operación)"]
    C1[Dashboard]
    C2[Inventario: solo lectura]
    C3[Caja: vender]
    C4[Cierre: solo propio]
    C5[Topbar: saludo + avatar menú + perfil]
    C6[Registro público → rol forzado cajero]
  end
  style Admin fill:#e0f2fe,stroke:#0284c7
  style Farma fill:#fef3c7,stroke:#f59e0b
  style Cajero fill:#fce7f3,stroke:#ec4899
```

> Basado en `README §9` y `front/src/App.jsx` (NAV con `puedeGestionarInventario`, `isAdmin`, `adminOnly`). Topbar implementado en `Topbar.jsx` con saludo dinámico, avatar, menú accesible (Escape, flechas, Home/End).

---

## Nota de exportación

1. Abre cada bloque en <https://mermaid.live>
2. Ajusta **Theme** (default / dark / forest / neutral) y **Scale**
3. **Download → PNG** (para slides) o **SVG** (escalable)
4. Inserta en PowerPoint / Google Slides / Canva