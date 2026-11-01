// back/src/controllers/auth.controller.js

const prisma = require("../prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { secret, expiresIn } = require("../config/auth");
const { auditar } = require("../utils/audit");
function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function usuarioSeguro(usuario) {
  const { passwordHash, ...resto } = usuario;
  return resto;
}

exports.register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    const emailNorm = normalizarEmail(email);

    if (!nombre || !emailNorm || !password) {
      return res.status(400).json({ error: "nombre, email y password son obligatorios" });
    }

    if (!/^\S+@\S+\.\S+$/.test(emailNorm)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: "La password debe tener al menos 6 caracteres" });
    }

    const existe = await prisma.usuario.findUnique({
      where: { email: emailNorm },
    });

    if (existe) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Seguridad: register nunca crea admin ni farmaceutico.
    // El admin entra por seed. Si mañana hace falta crear farmaceutico,
    // debe ser una acción protegida por admin, no un register público.
    const usuario = await prisma.usuario.create({
      data: {
        nombre: String(nombre).trim(),
        email: emailNorm,
        passwordHash,
        rol: "cajero",
      },
    });

    await auditar({
      req,
      userId: usuario.id,
      accion: "REGISTER",
      entidad: "Usuario",
      entidadId: usuario.id,
      detalle: { email: usuario.email, rol: usuario.rol },
    });

    return res.status(201).json({ user: usuarioSeguro(usuario) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al registrar usuario" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const emailNorm = normalizarEmail(email);

    if (!emailNorm || !password) {
      return res.status(400).json({ error: "email y password son obligatorios" });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: emailNorm },
    });

    // Comparo siempre el hash (también para inactivos) para no filtrar por
    // tiempo si el email existe. Un inactivo falla con el mismo mensaje.
    const passwordValida = usuario
      ? await bcrypt.compare(password, usuario.passwordHash)
      : false;
    const credentialsValidas = Boolean(usuario?.activo && passwordValida);

    // Solo se audita el fallo cuando el login realmente falla.
    // Mensaje único para no revelar si el email existe o no.
    if (!credentialsValidas) {
      await auditar({
        req,
        userId: usuario?.id ?? null,
        accion: "LOGIN_FALLIDO",
        entidad: "Usuario",
        entidadId: usuario?.id ?? null,
        detalle: { email: emailNorm },
      });

      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    await auditar({
      req,
      userId: usuario.id,
      accion: "LOGIN",
      entidad: "Usuario",
      entidadId: usuario.id,
      detalle: { email: usuario.email, rol: usuario.rol },
    });

    const token = jwt.sign(
      {
        id: usuario.id,
        rol: usuario.rol,
      },
      secret,
      { expiresIn }
    );


    return res.json({
      token,
      user: usuarioSeguro(usuario),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al iniciar sesión" });
  }
};

exports.me = async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.json({ user: usuarioSeguro(usuario) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener usuario" });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();

    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const actual = await prisma.usuario.findUnique({
      where: { id: req.user.id },
    });

    if (!actual) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Si no hay cambios reales, evito una escritura y una auditoría vacía.
    if (actual.nombre === nombre) {
      return res.json({ user: usuarioSeguro(actual) });
    }

    const usuario = await prisma.usuario.update({
      where: { id: actual.id },
      data: { nombre },
    });

    await auditar({
      req,
      userId: usuario.id,
      accion: "PROFILE_UPDATE",
      entidad: "Usuario",
      entidadId: usuario.id,
      detalle: {
        cambios: {
          nombre: { antes: actual.nombre, despues: usuario.nombre },
        },
      },
    });

    return res.json({ user: usuarioSeguro(usuario) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al actualizar el perfil" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const passwordActual = String(req.body?.passwordActual || "");
    const passwordNueva = String(req.body?.passwordNueva || "");

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({
        error: "La contraseña actual y la nueva son obligatorias",
      });
    }

    if (passwordNueva.length < 6) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener al menos 6 caracteres",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const actualValida = await bcrypt.compare(passwordActual, usuario.passwordHash);

    if (!actualValida) {
      return res.status(400).json({ error: "La contraseña actual es incorrecta" });
    }

    const passwordHash = await bcrypt.hash(passwordNueva, 10);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash },
    });

    // Nunca guardo contraseñas ni hashes en la auditoría.
    await auditar({
      req,
      userId: usuario.id,
      accion: "PASSWORD_CHANGE",
      entidad: "Usuario",
      entidadId: usuario.id,
      detalle: { email: usuario.email },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al cambiar la contraseña" });
  }
};