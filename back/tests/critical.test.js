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
let perfil;
let adminToken;
let cajeroToken;
let perfilToken;
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
    perfil = await crearUsuario("Perfil Test", "perfil@test.pe", "perfil123", "cajero");
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
    const loginPerfil = await login("perfil@test.pe", "perfil123");
    adminToken = loginAdmin.data.token;
    cajeroToken = loginCajero.data.token;
    perfilToken = loginPerfil.data.token;
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

  describe("Perfil propio", () => {
    it("actualiza el nombre y audita PROFILE_UPDATE sin exponer passwordHash", async () => {
      const r = await request("/auth/me", {
        method: "PUT",
        token: perfilToken,
        body: { nombre: "  Perfil Actualizado  " },
      });

      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.user.nombre, "Perfil Actualizado");
      assert.equal(r.data.user.passwordHash, undefined);

      const log = await prisma.auditLog.findFirst({
        where: { accion: "PROFILE_UPDATE", entidadId: perfil.id },
        orderBy: { id: "desc" },
      });
      assert.ok(log, "debe existir un PROFILE_UPDATE");
      const detalle = JSON.parse(log.detalle);
      assert.equal(detalle.cambios.nombre.antes, "Perfil Test");
      assert.equal(detalle.cambios.nombre.despues, "Perfil Actualizado");
      assert.equal(String(log.detalle).includes("passwordHash"), false);
    });

    it("rechaza un nombre vacío", async () => {
      const r = await request("/auth/me", {
        method: "PUT",
        token: perfilToken,
        body: { nombre: "   " },
      });

      assert.equal(r.status, 400);
      assert.match(r.data.error, /nombre/i);
    });

    it("rechaza el cambio si la contraseña actual es incorrecta", async () => {
      const auditoriasAntes = await prisma.auditLog.count({
        where: { accion: "PASSWORD_CHANGE", entidadId: perfil.id },
      });

      const r = await request("/auth/password", {
        method: "PUT",
        token: perfilToken,
        body: { passwordActual: "incorrecta", passwordNueva: "nueva123" },
      });

      assert.equal(r.status, 400);
      assert.match(r.data.error, /actual/i);
      assert.equal(
        await prisma.auditLog.count({
          where: { accion: "PASSWORD_CHANGE", entidadId: perfil.id },
        }),
        auditoriasAntes,
        "un intento fallido no debe auditar PASSWORD_CHANGE"
      );

      const loginViejo = await login("perfil@test.pe", "perfil123");
      assert.equal(loginViejo.status, 200, "la contraseña no debe cambiar");
    });

    it("rechaza una nueva contraseña de menos de 6 caracteres", async () => {
      const r = await request("/auth/password", {
        method: "PUT",
        token: perfilToken,
        body: { passwordActual: "perfil123", passwordNueva: "12345" },
      });

      assert.equal(r.status, 400);
      assert.match(r.data.error, /6 caracteres/i);
    });

    it("cambia la contraseña, audita PASSWORD_CHANGE y permite login con la nueva", async () => {
      const r = await request("/auth/password", {
        method: "PUT",
        token: perfilToken,
        body: { passwordActual: "perfil123", passwordNueva: "nueva123" },
      });

      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.ok, true);
      assert.equal(r.data.passwordHash, undefined);

      const log = await prisma.auditLog.findFirst({
        where: { accion: "PASSWORD_CHANGE", entidadId: perfil.id },
        orderBy: { id: "desc" },
      });
      assert.ok(log, "debe existir un PASSWORD_CHANGE");
      assert.equal(JSON.parse(log.detalle).email, "perfil@test.pe");
      assert.equal(String(log.detalle).includes("nueva123"), false);
      assert.equal(String(log.detalle).includes("passwordHash"), false);

      const loginViejo = await login("perfil@test.pe", "perfil123");
      assert.equal(loginViejo.status, 401);

      const loginNuevo = await login("perfil@test.pe", "nueva123");
      assert.equal(loginNuevo.status, 200);
      assert.equal(loginNuevo.data.user.passwordHash, undefined);
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

  describe("Filtros de ventas", () => {
    let ventaEnero;
    let ventaFebrero;

    before(async () => {
      ventaEnero = await prisma.venta.create({
        data: {
          total: 11,
          usuarioId: admin.id,
          fecha: new Date(2026, 0, 10, 12, 0, 0),
        },
      });
      ventaFebrero = await prisma.venta.create({
        data: {
          total: 22,
          usuarioId: cajero.id,
          fecha: new Date(2026, 1, 15, 12, 0, 0),
        },
      });
    });

    it("sin filtros devuelve el historial completo", async () => {
      const r = await request("/sales", { token: adminToken });

      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.data));
      assert.ok(r.data.some((v) => v.id === ventaEnero.id));
      assert.ok(r.data.some((v) => v.id === ventaFebrero.id));
    });

    it("filtra por rango de fechas inclusivo", async () => {
      const r = await request("/sales?desde=2026-02-01&hasta=2026-02-28", {
        token: adminToken,
      });

      assert.equal(r.status, 200);
      assert.ok(r.data.some((v) => v.id === ventaFebrero.id));
      assert.equal(r.data.some((v) => v.id === ventaEnero.id), false);
    });

    it("filtra por usuario que atendió", async () => {
      const r = await request(`/sales?usuarioId=${admin.id}`, { token: adminToken });

      assert.equal(r.status, 200);
      assert.ok(r.data.some((v) => v.id === ventaEnero.id));
      assert.equal(r.data.some((v) => v.id === ventaFebrero.id), false);
      assert.ok(r.data.every((v) => v.atendidoPor.id === admin.id));
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

  describe("Gestión de usuarios", () => {
    let usuarioCreado;
    let tokenCreado;

    it("el cajero no puede listar, crear ni cambiar usuarios", async () => {
      const lista = await request("/users", { token: cajeroToken });
      assert.equal(lista.status, 403);

      const crear = await request("/users", {
        method: "POST",
        token: cajeroToken,
        body: {
          nombre: "Usuario Prohibido",
          email: "prohibido@test.pe",
          password: "prohibido123",
          rol: "admin",
        },
      });
      assert.equal(crear.status, 403);

      const estado = await request(`/users/${admin.id}/estado`, {
        method: "PUT",
        token: cajeroToken,
        body: { activo: false },
      });
      assert.equal(estado.status, 403);
    });

    it("el admin lista usuarios sin passwordHash y con estado activo", async () => {
      const r = await request("/users", { token: adminToken });

      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.data));
      const adminListado = r.data.find((u) => u.id === admin.id);
      assert.ok(adminListado, "el admin debe aparecer en la lista");
      assert.equal(adminListado.activo, true);
      assert.ok(r.data.every((u) => u.passwordHash === undefined));
    });

    it("crea un usuario con el rol elegido, activo por defecto y audita", async () => {
      const r = await request("/users", {
        method: "POST",
        token: adminToken,
        body: {
          nombre: "Usuario Gestión",
          email: "gestion@test.pe",
          password: "gestion123",
          rol: "farmaceutico",
        },
      });

      assert.equal(r.status, 201, JSON.stringify(r.data));
      usuarioCreado = r.data.user;
      assert.equal(usuarioCreado.rol, "farmaceutico");
      assert.equal(usuarioCreado.activo, true);
      assert.equal(usuarioCreado.passwordHash, undefined);

      const log = await prisma.auditLog.findFirst({
        where: { accion: "USER_CREATE", entidadId: usuarioCreado.id },
        orderBy: { id: "desc" },
      });
      assert.ok(log, "debe existir un USER_CREATE");
      const detalle = JSON.parse(log.detalle);
      assert.equal(detalle.rol, "farmaceutico");
      assert.equal(detalle.activo, true);
      assert.equal(String(log.detalle).includes("gestion123"), false);
    });

    it("actualiza nombre y rol y audita el diff", async () => {
      const r = await request(`/users/${usuarioCreado.id}`, {
        method: "PUT",
        token: adminToken,
        body: { nombre: "Usuario Actualizado", rol: "cajero" },
      });

      assert.equal(r.status, 200, JSON.stringify(r.data));
      usuarioCreado = r.data.user;
      assert.equal(usuarioCreado.nombre, "Usuario Actualizado");
      assert.equal(usuarioCreado.rol, "cajero");

      const log = await prisma.auditLog.findFirst({
        where: { accion: "USER_UPDATE", entidadId: usuarioCreado.id },
        orderBy: { id: "desc" },
      });
      assert.ok(log, "debe existir un USER_UPDATE");
      const detalle = JSON.parse(log.detalle);
      assert.equal(detalle.cambios.nombre.antes, "Usuario Gestión");
      assert.equal(detalle.cambios.nombre.despues, "Usuario Actualizado");
      assert.equal(detalle.cambios.rol.antes, "farmaceutico");
      assert.equal(detalle.cambios.rol.despues, "cajero");
    });

    it("desactiva, audita USER_STATUS y rechaza login y tokens del inactivo", async () => {
      const loginAntes = await login("gestion@test.pe", "gestion123");
      assert.equal(loginAntes.status, 200);
      tokenCreado = loginAntes.data.token;

      const r = await request(`/users/${usuarioCreado.id}/estado`, {
        method: "PUT",
        token: adminToken,
        body: { activo: false },
      });

      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.user.activo, false);

      const log = await prisma.auditLog.findFirst({
        where: { accion: "USER_STATUS", entidadId: usuarioCreado.id },
        orderBy: { id: "desc" },
      });
      assert.ok(log, "debe existir un USER_STATUS");
      const detalle = JSON.parse(log.detalle);
      assert.equal(detalle.cambios.activo.antes, true);
      assert.equal(detalle.cambios.activo.despues, false);

      const loginInactivo = await login("gestion@test.pe", "gestion123");
      assert.equal(loginInactivo.status, 401);
      assert.equal(loginInactivo.data.error, "Credenciales inválidas");

      const fallo = await prisma.auditLog.findFirst({
        where: { accion: "LOGIN_FALLIDO", userId: usuarioCreado.id },
        orderBy: { id: "desc" },
      });
      assert.ok(fallo, "el login inactivo debe auditar LOGIN_FALLIDO");

      const me = await request("/auth/me", { token: tokenCreado });
      assert.equal(me.status, 401, "el token de un inactivo debe rechazarse");
    });

    it("protege al último admin activo", async () => {
      const desactivar = await request(`/users/${admin.id}/estado`, {
        method: "PUT",
        token: adminToken,
        body: { activo: false },
      });
      assert.equal(desactivar.status, 400);
      assert.match(desactivar.data.error, /propia cuenta/i);

      const cambiarRol = await request(`/users/${admin.id}`, {
        method: "PUT",
        token: adminToken,
        body: { rol: "cajero" },
      });
      assert.equal(cambiarRol.status, 400);
      assert.match(cambiarRol.data.error, /propio rol/i);

      const actual = await prisma.usuario.findUnique({ where: { id: admin.id } });
      assert.equal(actual.rol, "admin");
      assert.equal(actual.activo, true);
    });
  });
  describe("Métodos de pago", () => {
  it("calcula el vuelto en efectivo y lo devuelve en la venta", async () => {
    const r = await request("/sales", {
      method: "POST",
      token: cajeroToken,
      body: {
        detalles: [{ productoId: paracetamol.id, cantidad: 1 }],
        metodoPago: "EFECTIVO",
        montoRecibido: 20,
      },
    });

    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.venta.metodoPago, "EFECTIVO");
    assert.equal(r.data.venta.montoRecibido, 20);
    assert.equal(r.data.venta.vuelto, 15);
  });

  it("rechaza un monto recibido insuficiente en efectivo", async () => {
    const r = await request("/sales", {
      method: "POST",
      token: cajeroToken,
      body: {
        detalles: [{ productoId: paracetamol.id, cantidad: 1 }],
        metodoPago: "EFECTIVO",
        montoRecibido: 1,
      },
    });

    assert.equal(r.status, 400);
    assert.match(r.data.error, /insuficiente/i);
  });

  it("mantiene compatibilidad cuando no se envían los campos nuevos", async () => {
    const r = await request("/sales", {
      method: "POST",
      token: cajeroToken,
      body: {
        detalles: [{ productoId: paracetamol.id, cantidad: 1 }],
      },
    });

    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.venta.metodoPago, "EFECTIVO");
    assert.equal(r.data.venta.montoRecibido, null);
    assert.equal(r.data.venta.vuelto, null);
  });
  describe("Anulación de ventas", () => {
    let ventaAnulable;
    let stockAntes;

    before(async () => {
      stockAntes = (await prisma.producto.findUnique({ where: { id: paracetamol.id } })).stock;
      const r = await request("/sales", {
        method: "POST",
        token: adminToken,
        body: { detalles: [{ productoId: paracetamol.id, cantidad: 1 }] },
      });
      assert.equal(r.status, 201, JSON.stringify(r.data));
      ventaAnulable = r.data.venta;
    });

    it("el cajero no puede anular ventas", async () => {
      const r = await request(`/sales/${ventaAnulable.id}/anular`, {
        method: "POST",
        token: cajeroToken,
        body: { motivo: "intento no autorizado" },
      });
      assert.equal(r.status, 403);
    });

    it("rechaza un motivo demasiado corto", async () => {
      const r = await request(`/sales/${ventaAnulable.id}/anular`, {
        method: "POST",
        token: adminToken,
        body: { motivo: "no" },
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /5 caracteres/i);
    });

    it("anula la venta, repone el stock y audita SALE_VOID", async () => {
      const r = await request(`/sales/${ventaAnulable.id}/anular`, {
        method: "POST",
        token: adminToken,
        body: { motivo: "Error en el cobro de prueba" },
      });

      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.venta.estado, "ANULADA");
      assert.equal(r.data.venta.motivoAnulacion, "Error en el cobro de prueba");
      assert.ok(r.data.venta.anuladaEn);

      const producto = await prisma.producto.findUnique({ where: { id: paracetamol.id } });
      assert.equal(producto.stock, stockAntes, "el stock debe reponerse");

      const movimiento = await prisma.movimientoStock.findFirst({
        where: { productoId: paracetamol.id, tipo: "ANULACION" },
        orderBy: { id: "desc" },
      });
      assert.ok(movimiento, "debe existir un movimiento ANULACION");
      assert.equal(movimiento.cantidad, 1);

      const log = await prisma.auditLog.findFirst({
        where: { accion: "SALE_VOID", entidadId: ventaAnulable.id },
        orderBy: { id: "desc" },
      });
      assert.ok(log, "debe existir un SALE_VOID");
      const detalle = JSON.parse(log.detalle);
      assert.equal(detalle.motivo, "Error en el cobro de prueba");
    });

    it("no permite anular dos veces (409)", async () => {
      const r = await request(`/sales/${ventaAnulable.id}/anular`, {
        method: "POST",
        token: adminToken,
        body: { motivo: "segundo intento de anulación" },
      });
      assert.equal(r.status, 409);
      assert.match(r.data.error, /anulada/i);
    });

    it("las ventas anuladas quedan marcadas y no se borran", async () => {
      const r = await request("/sales", { token: adminToken });
      assert.equal(r.status, 200);
      const anulada = r.data.find((v) => v.id === ventaAnulable.id);
      assert.ok(anulada, "la venta anulada debe seguir en el historial");
      assert.equal(anulada.estado, "ANULADA");
      assert.equal(anulada.motivoAnulacion, "Error en el cobro de prueba");

      const completadas = r.data.filter((v) => v.estado !== "ANULADA");
      assert.ok(completadas.every((v) => v.estado !== "ANULADA"));
    });
  });
  describe("Productos inactivos y entradas", () => {
    let productoInactivo;
    let productoEntrada;

    before(async () => {
      const r1 = await request("/products", {
        method: "POST",
        token: adminToken,
        body: { nombre: "Producto Inactivo Test", precio: 4, stock: 3 },
      });
      assert.equal(r1.status, 201, JSON.stringify(r1.data));
      productoInactivo = r1.data;

      const desactivar = await request(`/products/${productoInactivo.id}/estado`, {
        method: "PUT",
        token: adminToken,
        body: { activo: false },
      });
      assert.equal(desactivar.status, 200, JSON.stringify(desactivar.data));
      assert.equal(desactivar.data.activo, false);

      const r2 = await request("/products", {
        method: "POST",
        token: adminToken,
        body: { nombre: "Producto Entrada Test", precio: 7, stock: 2 },
      });
      assert.equal(r2.status, 201, JSON.stringify(r2.data));
      productoEntrada = r2.data;
    });

    it("rechaza vender un producto inactivo", async () => {
      const r = await request("/sales", {
        method: "POST",
        token: cajeroToken,
        body: { detalles: [{ productoId: productoInactivo.id, cantidad: 1 }] },
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /inactivo/i);
    });

    it("la entrada de mercadería suma stock y crea un movimiento ENTRADA", async () => {
      const antes = (await prisma.producto.findUnique({ where: { id: productoEntrada.id } })).stock;
      const r = await request(`/products/${productoEntrada.id}/entrada`, {
        method: "POST",
        token: adminToken,
        body: { cantidad: 5, proveedor: "Proveedor Test", motivo: "Reposición semanal" },
      });

      assert.equal(r.status, 201, JSON.stringify(r.data));
      assert.equal(r.data.producto.stock, antes + 5);

      const movimiento = await prisma.movimientoStock.findFirst({
        where: { productoId: productoEntrada.id, tipo: "ENTRADA" },
        orderBy: { id: "desc" },
      });
      assert.ok(movimiento, "debe existir un movimiento ENTRADA");
      assert.equal(movimiento.cantidad, 5);
      assert.equal(movimiento.stockAnterior, antes);
      assert.equal(movimiento.stockNuevo, antes + 5);
      assert.match(movimiento.motivo, /Reposición semanal/);
    });

    it("rechaza una entrada con cantidad inválida", async () => {
      const r = await request(`/products/${productoEntrada.id}/entrada`, {
        method: "POST",
        token: adminToken,
        body: { cantidad: 0, motivo: "Cantidad inválida" },
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /cantidad/i);
    });
  });
  describe("Cierre de caja", () => {
    const fechaHoy = new Date().toISOString().slice(0, 10);
    let ventaCajero;
    let ventaAdmin;

    before(async () => {
      const r1 = await request("/sales", {
        method: "POST",
        token: cajeroToken,
        body: {
          detalles: [{ productoId: paracetamol.id, cantidad: 1 }],
          metodoPago: "EFECTIVO",
          montoRecibido: 10,
        },
      });
      assert.equal(r1.status, 201, JSON.stringify(r1.data));
      ventaCajero = r1.data.venta;

      const r2 = await request("/sales", {
        method: "POST",
        token: adminToken,
        body: {
          detalles: [{ productoId: ibuprofeno.id, cantidad: 1 }],
          metodoPago: "TARJETA",
        },
      });
      assert.equal(r2.status, 201, JSON.stringify(r2.data));
      ventaAdmin = r2.data.venta;
    });

    it("totales por método para el día", async () => {
      const r = await request(`/sales/cierre?fecha=${fechaHoy}`, {
        token: adminToken,
      });

      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.fecha, fechaHoy);
      assert.ok(r.data.resumen.cantidadVentas >= 2);

      const efectivo = r.data.resumen.porMetodo.find((m) => m.metodo === "EFECTIVO");
      const tarjeta = r.data.resumen.porMetodo.find((m) => m.metodo === "TARJETA");
      assert.ok(efectivo, "debe existir el total en efectivo");
      assert.ok(tarjeta, "debe existir el total con tarjeta");
      assert.ok(efectivo.total >= 5);
      assert.ok(tarjeta.total >= 8);
      assert.equal(r.data.resumen.efectivoEsperado >= 5, true);
    });

    it("el cajero no ve ventas ajenas aunque pida otro usuario", async () => {
      const r = await request(`/sales/cierre?fecha=${fechaHoy}&usuarioId=${admin.id}`, {
        token: cajeroToken,
      });

      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.usuario.id, cajero.id);
      assert.ok((r.data.ventas || []).every((v) => v.atendidoPor.id === cajero.id));
      assert.ok(!(r.data.ventas || []).some((v) => v.id === ventaAdmin.id));
    });
  });
});
});
