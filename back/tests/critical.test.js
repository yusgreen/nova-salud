// Pruebas de los flujos críticos de Nova Salud.
// Usan una base aislada (prisma/test.db) y un puerto efímero: nunca tocan dev.db.
process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_SECRET = "test-secret-nova-salud";
process.env.JWT_EXPIRES_IN = "1h";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const prisma = require("../src/prisma");
const { server, io } = require("../src/index");

let baseUrl;
let admin;
let cajero;
let adminToken;
let cajeroToken;
let paracetamol;
let ibuprofeno;

async function request(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function login(email, password) {
  return request("/auth/login", { method: "POST", body: { email, password } });
}

async function crearUsuario(nombre, email, password, rol) {
  return prisma.usuario.create({
    data: { nombre, email, passwordHash: await bcrypt.hash(password, 10), rol },
  });
}

describe("Nova Salud API · flujos críticos", () => {
  before(async () => {
    await prisma.detalleVenta.deleteMany();
    await prisma.venta.deleteMany();
    await prisma.movimientoStock.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.configuracion.deleteMany();
    await prisma.producto.deleteMany();
    await prisma.usuario.deleteMany();

    admin = await crearUsuario("Admin Test", "admin@test.pe", "admin123", "admin");
    cajero = await crearUsuario("Cajero Test", "cajero@test.pe", "cajero123", "cajero");
    await crearUsuario("Farma Test", "farma@test.pe", "farma123", "farmaceutico");

    paracetamol = await prisma.producto.create({
      data: {
        nombre: "Paracetamol Test",
        descripcion: "Analgesico",
        precio: 5,
        imagen: "",
        stock: 10,
        stockMinimo: 2,
      },
    });
    ibuprofeno = await prisma.producto.create({
      data: {
        nombre: "Ibuprofeno Test",
        descripcion: "Antiinflamatorio",
        precio: 8,
        imagen: "",
        stock: 3,
        stockMinimo: 5,
      },
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const loginAdmin = await login("admin@test.pe", "admin123");
    const loginCajero = await login("cajero@test.pe", "cajero123");
    adminToken = loginAdmin.data.token;
    cajeroToken = loginCajero.data.token;
  });

  after(async () => {
    await new Promise((resolve) => io.close(() => resolve()));
    await new Promise((resolve) => {
      if (!server.listening) return resolve();
      server.closeAllConnections?.();
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  });

  describe("Autenticación y auditoría", () => {
    it("rechaza credenciales inválidas y registra LOGIN_FALLIDO", async () => {
      const r = await login("admin@test.pe", "password-incorrecta");

      assert.equal(r.status, 401);
      assert.equal(r.data.error, "Credenciales inválidas");

      const log = await prisma.auditLog.findFirst({
        where: { accion: "LOGIN_FALLIDO" },
        orderBy: { id: "desc" },
      });
      assert.ok(log, "debe existir un LOGIN_FALLIDO");
      assert.equal(JSON.parse(log.detalle).email, "admin@test.pe");
      assert.equal(log.userId, admin.id);
    });

    it("un login correcto NO registra LOGIN_FALLIDO", async () => {
      const fallosAntes = await prisma.auditLog.count({
        where: { accion: "LOGIN_FALLIDO" },
      });

      const r = await login("admin@test.pe", "admin123");
      assert.equal(r.status, 200);
      assert.ok(r.data.token);
      assert.equal(r.data.user.passwordHash, undefined);

      const fallosDespues = await prisma.auditLog.count({
        where: { accion: "LOGIN_FALLIDO" },
      });
      assert.equal(fallosDespues, fallosAntes, "el login válido no debe auditarse como fallido");

      const logOk = await prisma.auditLog.findFirst({
        where: { accion: "LOGIN", userId: admin.id },
        orderBy: { id: "desc" },
      });
      assert.ok(logOk, "debe existir un LOGIN exitoso");
    });

    it("/auth/me exige token", async () => {
      const r = await request("/auth/me");
      assert.equal(r.status, 401);
    });

    it("/auth/me devuelve el usuario sin passwordHash", async () => {
      const r = await request("/auth/me", { token: adminToken });
      assert.equal(r.status, 200);
      assert.equal(r.data.user.email, "admin@test.pe");
      assert.equal(r.data.user.passwordHash, undefined);
    });
  });

  describe("Permisos por rol", () => {
    it("el cajero no puede ver el historial de ventas", async () => {
      const r = await request("/sales", { token: cajeroToken });
      assert.equal(r.status, 403);
    });

    it("el admin puede ver el historial de ventas", async () => {
      const r = await request("/sales", { token: adminToken });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.data));
    });

    it("el cajero no puede ver la auditoría", async () => {
      const r = await request("/audit", { token: cajeroToken });
      assert.equal(r.status, 403);
    });

    it("el cajero no puede crear productos", async () => {
      const r = await request("/products", {
        method: "POST",
        token: cajeroToken,
        body: { nombre: "Producto prohibido", precio: 1, stock: 1 },
      });
      assert.equal(r.status, 403);
    });
  });

  describe("Ventas, stock y atomicidad", () => {
    it("registra la venta, congela el precio de BD y descuenta stock", async () => {
      const stockAntes = (await prisma.producto.findUnique({ where: { id: paracetamol.id } })).stock;

      const r = await request("/sales", {
        method: "POST",
        token: cajeroToken,
        body: {
          detalles: [{ productoId: paracetamol.id, cantidad: 2, precioUnitario: 0.01 }],
          nota: "venta de prueba",
        },
      });

      assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.equal(r.data.venta.total, 10, "el total debe salir del precio de la BD");
      assert.equal(r.data.venta.nota, "venta de prueba");

      const producto = await prisma.producto.findUnique({ where: { id: paracetamol.id } });
      assert.equal(producto.stock, stockAntes - 2);

      const detalle = await prisma.detalleVenta.findFirst({
        where: { ventaId: r.data.venta.id },
      });
      assert.equal(detalle.precioUnitario, 5, "no debe aceptar el precio enviado por el cliente");

      const venta = await prisma.venta.findUnique({ where: { id: r.data.venta.id } });
      assert.equal(venta.usuarioId, cajero.id, "el vendedor sale del token, no del body");

      const auditoria = await prisma.auditLog.findFirst({
        where: { accion: "SALE_CREATE", entidadId: r.data.venta.id },
      });
      assert.ok(auditoria, "la venta debe quedar auditada");
    });

    it("revierte todas las líneas si una no tiene stock suficiente", async () => {
      const stockParacetamol = (await prisma.producto.findUnique({ where: { id: paracetamol.id } })).stock;
      const ventasAntes = await prisma.venta.count();

      const r = await request("/sales", {
        method: "POST",
        token: cajeroToken,
        body: {
          detalles: [
            { productoId: paracetamol.id, cantidad: 1 },
            { productoId: ibuprofeno.id, cantidad: 999 },
          ],
        },
      });

      assert.equal(r.status, 400);
      assert.match(r.data.error, /Stock insuficiente/);

      const stockDespues = (await prisma.producto.findUnique({ where: { id: paracetamol.id } })).stock;
      assert.equal(stockDespues, stockParacetamol, "la primera línea debe revertirse");
      assert.equal(await prisma.venta.count(), ventasAntes, "no debe quedar ticket a medias");
    });

    it("rechaza líneas con cantidad inválida sin crear la venta", async () => {
      const ventasAntes = await prisma.venta.count();

      const r = await request("/sales", {
        method: "POST",
        token: cajeroToken,
        body: {
          detalles: [
            { productoId: paracetamol.id, cantidad: 1 },
            { productoId: ibuprofeno.id, cantidad: 0 },
          ],
        },
      });

      assert.equal(r.status, 400);
      assert.match(r.data.error, /cantidad enteros positivos/);
      assert.equal(await prisma.venta.count(), ventasAntes);
    });

    it("rechaza un body sin detalles", async () => {
      const r = await request("/sales", {
        method: "POST",
        token: cajeroToken,
        body: {},
      });
      assert.equal(r.status, 400);
    });
  });

  describe("Validación de productos", () => {
    it("rechaza precio negativo", async () => {
      const r = await request("/products", {
        method: "POST",
        token: adminToken,
        body: { nombre: "Precio inválido", precio: -1, stock: 5 },
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /precio/);
    });

    it("rechaza stock decimal", async () => {
      const r = await request("/products", {
        method: "POST",
        token: adminToken,
        body: { nombre: "Stock decimal", precio: 2, stock: 1.5 },
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /stock/);
    });

    it("crea un producto válido y aplica defaults", async () => {
      const r = await request("/products", {
        method: "POST",
        token: adminToken,
        body: { nombre: "  Nuevo Producto  ", precio: 2.5, stock: 4 },
      });

      assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.equal(r.data.nombre, "Nuevo Producto");
      assert.equal(r.data.descripcion, "");
      assert.equal(r.data.stockMinimo, 0);
      assert.match(r.data.codigo, /^P-\d{4}$/);
    });

    it("rechaza una actualización con stock negativo", async () => {
      const r = await request(`/products/${paracetamol.id}`, {
        method: "PUT",
        token: adminToken,
        body: { stock: -3 },
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /stock/);
    });
  });

  describe("Inventario ampliado y trazabilidad", () => {
    it("crea un producto con código manual, metadatos y movimiento inicial", async () => {
      const r = await request("/products", {
        method: "POST",
        token: adminToken,
        body: {
          nombre: "Loratadina 10mg",
          precio: 3.5,
          precioCompra: 1.5,
          stock: 6,
          stockMinimo: 2,
          codigo: "lor-01",
          codigoBarras: "7501234567890",
          categoria: "Antialérgico",
          proveedor: "Lab Test",
          unidad: "caja",
          fechaVencimiento: "2027-12-31",
        },
      });

      assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.equal(r.data.codigo, "LOR-01");
      assert.equal(r.data.categoria, "Antialérgico");
      assert.equal(r.data.unidad, "caja");

      const mov = await prisma.movimientoStock.findFirst({
        where: { productoId: r.data.id, tipo: "INICIAL" },
      });
      assert.ok(mov, "debe registrar el stock inicial");
      assert.equal(mov.cantidad, 6);
      assert.equal(mov.stockNuevo, 6);
    });

    it("rechaza códigos duplicados", async () => {
      const r = await request("/products", {
        method: "POST",
        token: adminToken,
        body: { nombre: "Duplicado", precio: 1, stock: 1, codigo: "LOR-01" },
      });
      assert.equal(r.status, 409);
      assert.match(r.data.error, /codigo/i);
    });

    it("rechaza una fecha de vencimiento inválida", async () => {
      const r = await request("/products", {
        method: "POST",
        token: adminToken,
        body: { nombre: "Fecha mala", precio: 1, stock: 1, fechaVencimiento: "no-es-fecha" },
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /fechaVencimiento/);
    });

    it("registra el ajuste de stock y el diff en auditoría", async () => {
      const antes = await prisma.producto.findUnique({ where: { id: paracetamol.id } });
      const r = await request(`/products/${paracetamol.id}`, {
        method: "PUT",
        token: adminToken,
        body: { stock: antes.stock + 5 },
      });

      assert.equal(r.status, 200, JSON.stringify(r.data));
      const mov = await prisma.movimientoStock.findFirst({
        where: { productoId: paracetamol.id, tipo: "AJUSTE" },
        orderBy: { id: "desc" },
      });
      assert.ok(mov);
      assert.equal(mov.cantidad, 5);
      assert.equal(mov.stockAnterior, antes.stock);
      assert.equal(mov.stockNuevo, antes.stock + 5);

      const log = await prisma.auditLog.findFirst({
        where: { accion: "PRODUCT_UPDATE", entidadId: paracetamol.id },
        orderBy: { id: "desc" },
      });
      const detalle = JSON.parse(log.detalle);
      assert.equal(detalle.cambios.stock.antes, antes.stock);
      assert.equal(detalle.cambios.stock.despues, antes.stock + 5);
    });

    it("expone el historial de movimientos solo a roles de inventario", async () => {
      const sinToken = await request(`/products/${paracetamol.id}/movimientos`);
      assert.equal(sinToken.status, 401);

      const comoCajero = await request(`/products/${paracetamol.id}/movimientos`, {
        token: cajeroToken,
      });
      assert.equal(comoCajero.status, 403);

      const comoAdmin = await request(`/products/${paracetamol.id}/movimientos`, {
        token: adminToken,
      });
      assert.equal(comoAdmin.status, 200);
      assert.ok(Array.isArray(comoAdmin.data));
      assert.ok(comoAdmin.data.some((m) => m.tipo === "VENTA"));
    });
  });

  describe("Configuración", () => {
    it("GET /settings es público y devuelve los valores por defecto", async () => {
      const r = await request("/settings");

      assert.equal(r.status, 200);
      assert.equal(r.data.nombreNegocio, "Nova Salud");
      assert.equal(r.data.moneda, "S/");
      assert.equal(r.data.umbralStockBajo, 10);
      assert.equal(r.data.mostrarAyudaDemo, true);
    });

    it("el cajero no puede modificar la configuración", async () => {
      const r = await request("/settings", {
        method: "PUT",
        token: cajeroToken,
        body: { nombreNegocio: "Botica pirata" },
      });
      assert.equal(r.status, 403);
    });

    it("rechaza una moneda inválida", async () => {
      const r = await request("/settings", {
        method: "PUT",
        token: adminToken,
        body: { moneda: "S/ P" },
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /moneda/);
    });

    it("rechaza un umbral de stock negativo", async () => {
      const r = await request("/settings", {
        method: "PUT",
        token: adminToken,
        body: { umbralStockBajo: -1 },
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /umbralStockBajo/);
    });

    it("el admin actualiza, persiste y audita los cambios", async () => {
      const r = await request("/settings", {
        method: "PUT",
        token: adminToken,
        body: {
          nombreNegocio: "Botica Central",
          lema: "Salud a tu alcance",
          moneda: "$",
          umbralStockBajo: 7,
          mostrarAyudaDemo: false,
        },
      });

      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.nombreNegocio, "Botica Central");
      assert.equal(r.data.moneda, "$");
      assert.equal(r.data.umbralStockBajo, 7);
      assert.equal(r.data.mostrarAyudaDemo, false);

      const publica = await request("/settings");
      assert.equal(publica.data.nombreNegocio, "Botica Central");
      assert.equal(publica.data.moneda, "$");

      const auditoria = await prisma.auditLog.findFirst({
        where: { accion: "CONFIG_UPDATE", entidad: "Configuracion" },
        orderBy: { id: "desc" },
      });
      assert.ok(auditoria, "el cambio debe quedar auditado");
    });
  });
});
