const path = require('path');
const fs = require('fs');
const multer = require('multer');

const BASE_DIR =
  process.env.NODE_ENV === 'production'
    ? path.join(process.env.UPLOAD_BASE_PATH || '/var/www/html', 'productos')
    : path.resolve(__dirname, '../../../../var/www/html/productos');

function getArchivosEnCarpeta(proFiles) {
  if (!proFiles || typeof proFiles !== 'string') return [];
  const slug = proFiles.replace(/^\/productos\/?/, '').trim();
  if (!slug) return [];
  const dir = path.join(BASE_DIR, slug);
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function getDirFromProFiles(proFiles) {
  if (!proFiles || typeof proFiles !== 'string') return null;
  const slug = proFiles.replace(/^\/productos\/?/, '').trim();
  if (!slug) return null;
  return path.join(BASE_DIR, slug);
}

function slugify(str) {
  if (!str || typeof str !== 'string') return 'producto';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'producto';
}

/**
 * Compara dos valores del producto ignorando el tipo: lo que viene del formulario
 * son cadenas y lo que devuelve la base puede ser número o NULL.
 */
function mismoValor(a, b) {
  return String(a ?? '') === String(b ?? '');
}

/** Sube en 1 la versión del producto para avisar al launcher que hay contenido nuevo. */
const SQL_SUBIR_VERSION = 'UPDATE CAS_PRODUCTOS SET PRO_VERSION = COALESCE(PRO_VERSION, 0) + 1 WHERE PRO_ID = ?';

/** Versión que quedará tras el incremento (los productos viejos sin versión arrancan en 1). */
function siguienteVersion(versionActual) {
  return Number(versionActual ?? 0) + 1;
}

function getProductos(req, res) {
  req.db.query('SELECT * FROM CAS_PRODUCTOS', (error, results) => {
    if (error) {
      console.error('Error en getProductos:', error);
      return res.status(500).json({
        error: 'Error en la base de datos',
        detalle: error.message,
      });
    }
    const conArchivos = (results || []).map((row) => ({
      ...row,
      archivos: getArchivosEnCarpeta(row.PRO_FILES),
    }));

    res.json(conArchivos);
  });
}

function updateProducto(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    return res.status(400).json({ detalle: 'ID de producto inválido' });
  }
  const pro_nombre = req.body?.pro_nombre != null ? String(req.body.pro_nombre).trim() : null;
  const pro_exe = req.body?.pro_exe != null ? String(req.body.pro_exe).trim() : null;
  const pro_grado = req.body?.pro_grado != null ? parseInt(req.body.pro_grado, 10) : null;
  const pro_tipo = req.body?.pro_tipo != null ? String(req.body.pro_tipo) : null;
  const pro_nombre_detallado = req.body?.pro_nombre_detallado != null
    ? String(req.body.pro_nombre_detallado).trim().slice(0, 100)
    : null;
  const pro_descripcion = req.body?.pro_descripcion != null ? String(req.body.pro_descripcion) : null;

  // Obtener producto actual para saber PRO_FILES, renombrar carpeta si cambia el título
  // y comparar campo por campo para decidir si toca subir la versión.
  const sqlActual = `SELECT PRO_NOMBRE, PRO_FILES, PRO_EXE, PRO_GRA_ID, PRO_TIPO,
    PRO_NOMBRE_DETALLADO, PRO_DESCRIPCION, PRO_VERSION
    FROM CAS_PRODUCTOS WHERE PRO_ID = ?`;
  req.db.query(sqlActual, [id], (error, rows) => {
    if (error) {
      console.error('Error en updateProducto (SELECT):', error);
      return res.status(500).json({ error: 'Error en la base de datos', detalle: error.message });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ detalle: 'Producto no encontrado' });
    }

    const current = rows[0];
    const oldProFiles = current.PRO_FILES || '';
    let oldDir = getDirFromProFiles(oldProFiles);
    if (oldDir && !fs.existsSync(oldDir)) oldDir = null;
    let newProFiles = oldProFiles;

    if (pro_nombre != null && pro_nombre !== (current.PRO_NOMBRE || '').trim() && oldDir) {
      let newSlug = slugify(pro_nombre);
      const newDirBase = path.join(BASE_DIR, newSlug);
      const oldDirResolved = path.resolve(oldDir);
      const newDirBaseResolved = path.resolve(newDirBase);
      if (newDirBaseResolved !== oldDirResolved) {
        let newDir = newDirBase;
        if (fs.existsSync(newDirBase)) {
          newDir = path.join(BASE_DIR, `${newSlug}-${id}`);
          newSlug = `${newSlug}-${id}`;
        }
        if (path.resolve(newDir) !== oldDirResolved) {
          try {
            fs.renameSync(oldDir, newDir);
            newProFiles = `/productos/${newSlug}`;
          } catch (e) {
            console.error('Error renombrando carpeta de producto:', e);
            return res.status(500).json({ detalle: 'Error al renombrar la carpeta de archivos' });
          }
        }
      }
    }

    // Basta con que cambie una letra de cualquier campo para que suba la versión.
    // Si se guarda sin tocar nada, la versión se queda igual.
    const huboCambios =
      newProFiles !== oldProFiles ||
      !mismoValor(pro_nombre, current.PRO_NOMBRE) ||
      !mismoValor(pro_exe, current.PRO_EXE) ||
      !mismoValor(pro_grado, current.PRO_GRA_ID) ||
      !mismoValor(pro_tipo, current.PRO_TIPO) ||
      !mismoValor(pro_nombre_detallado, current.PRO_NOMBRE_DETALLADO) ||
      !mismoValor(pro_descripcion, current.PRO_DESCRIPCION);

    const sql = `UPDATE CAS_PRODUCTOS SET
      PRO_NOMBRE = ?, PRO_EXE = ?, PRO_GRA_ID = ?, PRO_TIPO = ?, PRO_FILES = ?, PRO_NOMBRE_DETALLADO = ?, PRO_DESCRIPCION = ?${huboCambios ? ',\n      PRO_VERSION = COALESCE(PRO_VERSION, 0) + 1' : ''}
      WHERE PRO_ID = ?`;
    const values = [pro_nombre, pro_exe, pro_grado, pro_tipo, newProFiles, pro_nombre_detallado, pro_descripcion, id];

    req.db.query(sql, values, (err, result) => {
      if (err) {
        console.error('Error en updateProducto (UPDATE):', err);
        return res.status(500).json({ error: 'Error en la base de datos', detalle: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ detalle: 'Producto no encontrado' });
      }
      res.status(200).json({
        ok: true,
        affectedRows: result.affectedRows,
        pro_files: newProFiles,
        pro_version: huboCambios ? siguienteVersion(current.PRO_VERSION) : current.PRO_VERSION,
      });
    });
  });
}

// Storage para agregar archivos a producto existente
const addFilesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = req.productDir;
    if (!dir) return cb(new Error('Directorio de producto no encontrado'));
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const raw = (file.originalname || 'archivo').trim();
    const name = path.basename(raw) || 'archivo';
    cb(null, name);
  },
});

const addFilesUpload = multer({
  storage: addFilesStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const addFilesMiddleware = addFilesUpload.array('archivo', 200);

// POST /productos/:id/archivos - Agregar archivos a producto existente
function addFilesToProducto(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    return res.status(400).json({ detalle: 'ID de producto inválido' });
  }

  // Primero obtener el producto para saber su carpeta
  req.db.query('SELECT PRO_FILES, PRO_VERSION FROM CAS_PRODUCTOS WHERE PRO_ID = ?', [id], (error, results) => {
    if (error) {
      console.error('Error buscando producto:', error);
      return res.status(500).json({ detalle: error.message });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ detalle: 'Producto no encontrado' });
    }

    const proFiles = results[0].PRO_FILES;
    const nuevaVersion = siguienteVersion(results[0].PRO_VERSION);
    const dir = getDirFromProFiles(proFiles);
    if (!dir) {
      return res.status(400).json({ detalle: 'El producto no tiene carpeta de archivos' });
    }

    // Crear directorio si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    req.productDir = dir;

    addFilesMiddleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({ detalle: err.message || 'Error al subir archivos' });
      }
      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) {
        return res.status(400).json({ detalle: 'No se recibieron archivos' });
      }

      const nombres = files.map((f) => f.filename);
      const archivosActuales = getArchivosEnCarpeta(proFiles);
      const primeraImagen = files.find((f) => (f.mimetype || '').startsWith('image/'));
      const proImagen = primeraImagen ? `${proFiles}/${primeraImagen.filename}` : null;

      const sendResponse = (versionAplicada, proImagenUpdated = null) => {
        res.status(200).json({
          ok: true,
          archivosAgregados: nombres,
          totalArchivos: archivosActuales.length,
          archivos: archivosActuales,
          ...(versionAplicada != null && { pro_version: versionAplicada }),
          ...(proImagenUpdated != null && { pro_imagen: proImagenUpdated }),
        });
      };

      // Agregar archivos es un cambio de contenido: sube la versión.
      // Si además llegó una imagen, se guarda en la misma sentencia.
      const sql = proImagen
        ? 'UPDATE CAS_PRODUCTOS SET PRO_IMAGEN = ?, PRO_VERSION = COALESCE(PRO_VERSION, 0) + 1 WHERE PRO_ID = ?'
        : SQL_SUBIR_VERSION;
      const values = proImagen ? [proImagen, id] : [id];

      req.db.query(sql, values, (updateErr) => {
        if (updateErr) {
          console.error('Error actualizando el producto tras subir archivos:', updateErr);
          // Los archivos ya quedaron en disco: se reporta el alta aunque la versión no subiera.
          return sendResponse(null, null);
        }
        sendResponse(nuevaVersion, proImagen);
      });
    });
  });
}

// DELETE /productos/:id/archivos/:filename - Eliminar archivo de producto
function deleteFileFromProducto(req, res) {
  const id = parseInt(req.params.id, 10);
  const filename = req.params.filename;

  if (Number.isNaN(id) || id < 1) {
    return res.status(400).json({ detalle: 'ID de producto inválido' });
  }
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ detalle: 'Nombre de archivo inválido' });
  }

  // Sanitizar filename para evitar path traversal
  const safeFilename = path.basename(filename);

  req.db.query('SELECT PRO_FILES, PRO_VERSION FROM CAS_PRODUCTOS WHERE PRO_ID = ?', [id], (error, results) => {
    if (error) {
      console.error('Error buscando producto:', error);
      return res.status(500).json({ detalle: error.message });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ detalle: 'Producto no encontrado' });
    }

    const proFiles = results[0].PRO_FILES;
    const nuevaVersion = siguienteVersion(results[0].PRO_VERSION);
    const dir = getDirFromProFiles(proFiles);
    if (!dir) {
      return res.status(400).json({ detalle: 'El producto no tiene carpeta de archivos' });
    }

    const filePath = path.join(dir, safeFilename);

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ detalle: 'Archivo no encontrado' });
    }

    // Eliminar archivo
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error('Error eliminando archivo:', e);
      return res.status(500).json({ detalle: 'Error al eliminar el archivo' });
    }

    const archivosActuales = getArchivosEnCarpeta(proFiles);

    // Quitar un archivo también cambia el contenido: sube la versión.
    req.db.query(SQL_SUBIR_VERSION, [id], (updateErr) => {
      if (updateErr) {
        console.error('Error incrementando PRO_VERSION:', updateErr);
      }
      res.status(200).json({
        ok: true,
        archivoEliminado: safeFilename,
        totalArchivos: archivosActuales.length,
        archivos: archivosActuales,
        ...(updateErr ? {} : { pro_version: nuevaVersion }),
      });
    });
  });
}

module.exports = { getProductos, updateProducto, addFilesToProducto, deleteFileFromProducto };
