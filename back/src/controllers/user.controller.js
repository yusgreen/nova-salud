// back/src/controllers/user.controller.js
// Gestion de usuarios: solo admin. Nunca devuelve passwordHash.

const prisma = require("../prisma");
const bcrypt = require("bcryptjs");
const { auditar } = require("../utils/audit");

const ROLES_VALIDOS = ["admin", "farmaceutico", "cajero"];
const CAMPOS_PUBLICOS = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
};

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validarNombre(nombre) {
  if (typeof nombre !== "string" || nombre.length < 2 || nombre.length > 100) {
    return "El nombre debe tener entre 2 y 100 caracteres";
  }
  return null;
}

function validarRol(rol) {
  return ROLES_VALIDOS.includes(rol) ? null : "El rol no es válido";
}

async function contarOtrosAdminsActivos(tx, excluirId) {
  return tx.usuario.count({
    where: {
      rol: "admin",
      activo: true,
      id: { not: excluirId },
    },
  });
}

exports.getUsers = async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { id: "asc" },
      select: CAMPOS_PUBLICOS,
    });
    return res.json(usuarios);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al listar usuarios" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const email = normalizarEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const rol = String(req.body?.rol || "").trim();

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({
        error: "nombre, email, password y rol son obligatorios",
      });
    }

    const errorNombre = validarNombre(nombre);
    if (errorNombre) return res.status(400).json({ error: errorNombre });

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    const errorRol = validarRol(rol);
    if (errorRol) return res.status(400).json({ error: errorRol });

    const existe = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existe) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: { nombre, email, passwordHash, rol, activo: true },
      select: CAMPOS_PUBLICOS,
    });

    await auditar({
      req,
      userId: req.user.id,
      accion: "USER_CREATE",
      entidad: "Usuario",
      entidadId: usuario.id,
      detalle: {
        email: usuario.email,
        rol: usuario.rol,
        activo: usuario.activo,
        cambios: {
          nombre: { antes: null, despues: usuario.nombre },
          email: { antes: null, despues: usuario.email },
          rol: { antes: null, despues: usuario.rol },
          activo: { antes: null, despues: usuario.activo },
        },
      },
    });

    return res.status(201).json({ user: usuario });
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "El email ya está registrado" });
    }
    return res.status(500).json({ error: "Error al crear usuario" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "id inválido" });

    const nombreRaw = req.body?.nombre;
    const rolRaw = req.body?.rol;

    if (nombreRaw === undefined && rolRaw === undefined) {
      return res.status(400).json({ error: "Indica el nombre o el rol a cambiar" });
    }

    const nombre = nombreRaw === undefined ? undefined : String(nombreRaw).trim();
    const rol = rolRaw === undefined ? undefined : String(rolRaw).trim();

    if (nombre !== undefined) {
      const errorNombre = validarNombre(nombre);
      if (errorNombre) return res.status(400).json({ error: errorNombre });
    }

    if (rol !== undefined) {
      const errorRol = validarRol(rol);
      if (errorRol) return res.status(400).json({ error: errorRol });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const actual = await tx.usuario.findUnique({
        where: { id },
        select: CAMPOS_PUBLICOS,
      });
      if (!actual) {
        return { status: 404, error: "Usuario no encontrado" };
      }

      if (rol !== undefined && rol !== actual.rol) {
        if (actual.id === req.user.id) {
          return { status: 400, error: "No puedes cambiar tu propio rol" };
        }

        if (actual.rol === "admin" && actual.activo) {
          const otros = await contarOtrosAdminsActivos(tx, actual.id);
          if (otros === 0) {
            return {
              status: 400,
              error: "Debe quedar al menos un administrador activo",
            };
          }
        }
      }

      const cambios = {};
      if (nombre !== undefined && nombre !== actual.nombre) {
        cambios.nombre = { antes: actual.nombre, despues: nombre };
      }
      if (rol !== undefined && rol !== actual.rol) {
        cambios.rol = { antes: actual.rol, despues: rol };
      }

      if (Object.keys(cambios).length === 0) {
        return { usuario: actual, cambios: null };
      }

      const data = {};
      if (nombre !== undefined) data.nombre = nombre;
      if (rol !== undefined) data.rol = rol;

      const usuario = await tx.usuario.update({
        where: { id },
        data,
        select: CAMPOS_PUBLICOS,
      });

      return { usuario, cambios };
    });

    if (resultado.error) {
      return res.status(resultado.status).json({ error: resultado.error });
    }

    if (resultado.cambios) {
      await auditar({
        req,
        userId: req.user.id,
        accion: "USER_UPDATE",
        entidad: "Usuario",
        entidadId: resultado.usuario.id,
        detalle: {
          email: resultado.usuario.email,
          cambios: resultado.cambios,
        },
      });
    }

    return res.json({ user: resultado.usuario });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al actualizar usuario" });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "id inválido" });

    const activo = req.body?.activo;
    if (typeof activo !== "boolean") {
      return res.status(400).json({ error: "activo debe ser verdadero o falso" });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const actual = await tx.usuario.findUnique({
        where: { id },
        select: CAMPOS_PUBLICOS,
      });
      if (!actual) {
        return { status: 404, error: "Usuario no encontrado" };
      }

      if (actual.id === req.user.id && activo === false) {
        return { status: 400, error: "No puedes desactivar tu propia cuenta" };
      }

      if (actual.activo === activo) {
        return { usuario: actual, cambios: null };
      }

      if (actual.rol === "admin" && actual.activo && activo === false) {
        const otros = await contarOtrosAdminsActivos(tx, actual.id);
        if (otros === 0) {
          return {
            status: 400,
            error: "Debe quedar al menos un administrador activo",
          };
        }
      }

      const usuario = await tx.usuario.update({
        where: { id },
        data: { activo },
        select: CAMPOS_PUBLICOS,
      });

      return {
        usuario,
        cambios: {
          activo: { antes: actual.activo, despues: usuario.activo },
        },
      };
    });

    if (resultado.error) {
      return res.status(resultado.status).json({ error: resultado.error });
    }

    if (resultado.cambios) {
      await auditar({
        req,
        userId: req.user.id,
        accion: "USER_STATUS",
        entidad: "Usuario",
        entidadId: resultado.usuario.id,
        detalle: {
          email: resultado.usuario.email,
          cambios: resultado.cambios,
        },
      });
    }

    return res.json({ user: resultado.usuario });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al cambiar el estado del usuario" });
  }
};
