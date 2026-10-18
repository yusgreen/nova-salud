// Seed de Nova Salud. Corre con: npx prisma db seed
// Importa el SINGLETON (../src/prisma), no crea su propio cliente:
// asi el seed mismo prueba que require('@prisma/client') funciona con CommonJS.
const prisma = require("../src/prisma");
const bcrypt = require("bcryptjs");

async function main() {
  // Borra en ORDEN de dependencias (hijos antes que padres) para que re-sembrar sea limpio.
  // Si al revés, la FK de venta->usuario o detalle->producto revienta.
  await prisma.detalleVenta.deleteMany();
  await prisma.venta.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.usuario.deleteMany();

  // Admin de demo, contrasena HASHEADA (condicion 1 de seguridad del enunciado).
  const hash = await bcrypt.hash("admin123", 10);
  await prisma.usuario.create({
    data: { nombre: "Administrador", email: "admin@novasalud.pe", passwordHash: hash, rol: "admin" },
  });

  // 5 productos de botica. Dos ya por debajo del umbral (stock <= stockMinimo)
  // para que el semaforo de alerta tenga algo que prender desde el dia 1.
  const productos = [
    { nombre: "Paracetamol 500mg", descripcion: "Analgesico", precio: 5.5, imagen: "/images/paracetamol.svg", stock: 120, stockMinimo: 30 },
    { nombre: "Ibuprofeno 400mg",  descripcion: "Antiinflamatorio", precio: 8.0, imagen: "/images/ibuprofeno.svg", stock: 12, stockMinimo: 20 }, // ALERTA
    { nombre: "Amoxicilina 500mg", descripcion: "Antibiotico", precio: 15.0, imagen: "/images/amoxicilina.svg", stock: 60, stockMinimo: 15 },
    { nombre: "Vitamina C 1g",     descripcion: "Suplemento", precio: 12.0, imagen: "/images/vitamina.svg", stock: 5, stockMinimo: 10 }, // ALERTA
    { nombre: "Solucion salina",   descripcion: "Hidratante", precio: 6.0, imagen: "/images/salina.svg", stock: 200, stockMinimo: 40 },
  ];
  for (const p of productos) await prisma.producto.create({ data: p });

  console.log("Seed OK: 1 admin (hasheado) + 5 productos (2 en alerta de bajo stock).");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());