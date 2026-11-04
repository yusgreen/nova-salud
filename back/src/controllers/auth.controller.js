// back/src/controllers/auth.controller.js

const prisma = require("../prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { secret, expiresIn } = require("../config/auth");
const { auditar } = require("../utils/audit");
function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

const CAMPOS_PUBLICOS = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  avatar: true,
};

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
    const { nombre, avatar } = req.body;
    const nombreLimpio = String(nombre || "").trim();

    if (nombre !== undefined && !nombreLimpio) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    if (avatar !== undefined && avatar !== null) {
      if (typeof avatar !== "string" || !avatar.startsWith("data:image/")) {
        return res.status(400).json({ error: "Formato de imagen inválido" });
      }
      // Limite ~60 KB: 60 * 1024 = 61440 bytes; base64 agrega ~33% de overhead.
      // Dejamos margen y limitamos la cadena a 85000 caracteres.
      if (avatar.length > 85000) {
        return res.status(400).json({ error: "La imagen es demasiado grande (máx 60KB)" });
      }
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      const mime = avatar.split(";")[0].split(":")[1];
      if (!allowed.includes(mime)) {
        return res.status(400).json({ error: "Formato de imagen no permitido (solo JPG, PNG, WebP)" });
      }
    }

    const actual = await prisma.usuario.findUnique({
      where: { id: req.user.id },
    });

    if (!actual) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const data = {};
    if (nombre !== undefined && nombreLimpio !== actual.nombre) data.nombre = nombreLimpio;
    if (avatar !== undefined && avatar !== actual.avatar) data.avatar = avatar;

    if (Object.keys(data).length === 0) {
      return res.json({ user: usuarioSeguro(actual) });
    }

    const usuario = await prisma.usuario.update({
      where: { id: actual.id },
      data,
    });

    const accion = avatar !== undefined ? "AVATAR_UPDATE" : "PROFILE_UPDATE";
    const cambios = {};
    if (data.nombre) cambios.nombre = { antes: actual.nombre, despues: usuario.nombre };
    // No guardamos la imagen en el detalle de auditoría por tamaño
    if (avatar !== undefined) cambios.avatar = avatar === null ? "removido" : "actualizado";

    await auditar({
      req,
      userId: usuario.id,
      accion,
      entidad: "Usuario",
      entidadId: usuario.id,
      detalle: { cambios },
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