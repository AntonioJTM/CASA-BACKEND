const path = require('path');
const fs = require('fs');
const multer = require('multer');

/** Raíz de archivos estáticos; se sirve en /FILES/static (ver index.js). */
const BASE_DIR = process.env.NODE_ENV === 'production'
    ? path.join(process.env.UPLOAD_BASE_PATH || '/var/www/html', 'materias')
    : path.resolve(__dirname, '../../../../var/www/html/materias');

/** Ruta pública que se guarda en MAT_PORTADA. */
const CARPETA_PUBLICA = '/materias';

/** Extensiones permitidas para la portada. */
const EXTENSIONES = ['.png', '.jpg', '.jpeg', '.ico'];
const MIMES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/x-icon',
    'image/vnd.microsoft.icon',
]);

/**
 * Nombre de archivo a partir de un texto: minúsculas, sin acentos ni caracteres
 * especiales. "Química II" -> "quimica-ii".
 */
function slugify(str) {
    if (!str || typeof str !== 'string') return 'materia';
    return str
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120) || 'materia';
}

/**
 * Marca de versión de una portada: la fecha de modificación del archivo.
 *
 * Al reemplazar una imagen el nombre no cambia, así que la URL tampoco y el
 * navegador sigue mostrando la copia que ya tenía. Enviando este valor, el front
 * lo añade a la URL y solo fuerza la recarga cuando el archivo cambió de verdad.
 */
function versionPortada(rutaPortada) {
    if (!rutaPortada) return null;
    try {
        return fs.statSync(path.join(BASE_DIR, path.basename(rutaPortada))).mtimeMs;
    } catch (e) {
        return null;
    }
}

/** Nombre definitivo de la portada: materia + subsistema, para que no se pisen. */
function nombrePortada(nombreMateria, nombreSubsistema, ext) {
    return `${slugify(nombreMateria)}-${slugify(nombreSubsistema)}${ext}`;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(BASE_DIR, { recursive: true });
        cb(null, BASE_DIR);
    },
    filename: (req, file, cb) => {
        // Nombre provisional: el definitivo lleva el subsistema, cuyo nombre hay
        // que consultar en la base, y eso no se puede hacer aquí.
        let ext = path.extname(file.originalname || '').toLowerCase();
        if (!EXTENSIONES.includes(ext)) ext = '.png';
        if (ext === '.jpeg') ext = '.jpg';
        cb(null, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});

const uploadPortada = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const mime = (file.mimetype || '').toLowerCase();
        if (EXTENSIONES.includes(ext) && MIMES.has(mime)) return cb(null, true);
        cb(new Error('La portada debe ser un archivo PNG, JPG o ICO'));
    },
}).single('portada');

/** Middleware: procesa la portada y traduce los errores de multer a 400. */
exports.subirPortada = (req, res, next) => {
    uploadPortada(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                error: err.message || 'Error al subir la portada',
            });
        }
        next();
    });
};

/**
 * Borra el archivo de una portada, salvo que otra materia siga usándolo.
 * Dos materias del mismo nombre y subsistema comparten archivo, así que borrar
 * sin comprobar dejaría a la otra sin imagen.
 */
function borrarPortadaSiNadieLaUsa(db, rutaPortada, matIdExcluido, callback) {
    if (!rutaPortada) return callback();
    db.query(
        'SELECT COUNT(*) AS n FROM CAS_MATERIA WHERE MAT_PORTADA = ? AND MAT_ID <> ?',
        [rutaPortada, matIdExcluido],
        (err, filas) => {
            if (err || (filas && filas[0] && Number(filas[0].n) > 0)) return callback();
            fs.unlink(path.join(BASE_DIR, path.basename(rutaPortada)), () => callback());
        }
    );
}

exports.getTodasMaterias = async (req, res) => {
    try {
        // Se resuelven los nombres de semestre y subsistema, y se cuenta el uso
        // de cada materia para saber si se puede eliminar.
        const sql = `
            SELECT m.*,
                   g.GRA_NUMERO   AS GRA_NUMERO,
                   g.GRA_NOMBRE   AS GRA_NOMBRE,
                   sub.SUB_NOMBRE AS SUB_NOMBRE,
                   (SELECT COUNT(*) FROM CAS_PRODUCTOS p WHERE p.PRO_MAT_ID = m.MAT_ID) AS TOTAL_PRODUCTOS,
                   (SELECT COUNT(*) FROM CAS_MULTIMEDIA mu WHERE mu.MUL_MAT_ID = m.MAT_ID) AS TOTAL_MULTIMEDIA
            FROM CAS_MATERIA m
            LEFT JOIN CAS_GRADO g ON m.MAT_GRA_ID = g.GRA_ID
            LEFT JOIN CAS_SUBSISTEMA sub ON m.MAT_SUB_ID = sub.SUB_ID
            ORDER BY m.MAT_NOMBRE ASC`;

        req.db.query(sql, (error, results) => {
            if (error) {
                console.error('Error al obtener materias:', error);
                return res.status(500).json({ error: 'Error del servidor al obtener las materias' });
            }
            const conVersion = (results || []).map((fila) => ({
                ...fila,
                MAT_PORTADA_V: versionPortada(fila.MAT_PORTADA),
            }));
            res.json(conVersion);
        });
    } catch (error) {
        console.error('Error general obtener materias:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Registra una materia.
 *
 * Body: MAT_NOMBRE, MAT_GRA_ID (semestre), MAT_SUB_ID (subsistema),
 *       [MAT_DESCRIPCION], [portada].
 */
exports.addMateria = async (req, res) => {
    const limpiarTemporal = () => {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => {});
        }
    };

    try {
        const { MAT_NOMBRE, MAT_DESCRIPCION, MAT_GRA_ID, MAT_SUB_ID } = req.body;

        const graId = parseInt(MAT_GRA_ID, 10);
        const subId = parseInt(MAT_SUB_ID, 10);

        if (!MAT_NOMBRE || !Number.isInteger(graId) || graId <= 0) {
            limpiarTemporal();
            return res.status(400).json({ error: 'Faltan campos requeridos: MAT_NOMBRE y MAT_GRA_ID' });
        }
        if (!Number.isInteger(subId) || subId <= 0) {
            limpiarTemporal();
            return res.status(400).json({ error: 'Falta el campo requerido: MAT_SUB_ID' });
        }

        req.db.query(
            'SELECT SUB_ID, SUB_NOMBRE FROM CAS_SUBSISTEMA WHERE SUB_ID = ?',
            [subId],
            (errSub, filasSub) => {
                if (errSub) {
                    console.error('Error al validar el subsistema:', errSub);
                    limpiarTemporal();
                    return res.status(500).json({ error: 'Error al validar el subsistema' });
                }
                if (!filasSub || filasSub.length === 0) {
                    limpiarTemporal();
                    return res.status(400).json({ error: 'El subsistema seleccionado no existe' });
                }

                let portada = null;
                if (req.file) {
                    const ext = path.extname(req.file.filename).toLowerCase();
                    const nombreFinal = nombrePortada(MAT_NOMBRE, filasSub[0].SUB_NOMBRE, ext);
                    try {
                        fs.renameSync(req.file.path, path.join(BASE_DIR, nombreFinal));
                        portada = `${CARPETA_PUBLICA}/${nombreFinal}`;
                    } catch (e) {
                        console.error('Error al guardar la portada:', e);
                        limpiarTemporal();
                        return res.status(500).json({ error: 'Error al guardar la portada' });
                    }
                }

                const query = `INSERT INTO CAS_MATERIA
                    (MAT_NOMBRE, MAT_DESCRIPCION, MAT_PORTADA, MAT_GRA_ID, MAT_SUB_ID, MAT_STATUS)
                    VALUES (?, ?, ?, ?, ?, ?)`;
                const values = [MAT_NOMBRE, MAT_DESCRIPCION || '', portada, graId, subId, 1];

                req.db.query(query, values, (error, results) => {
                    if (error) {
                        console.error('Error al insertar materia:', error);
                        if (portada) {
                            fs.unlink(path.join(BASE_DIR, path.basename(portada)), () => {});
                        }
                        return res.status(500).json({ error: 'Error al registrar la materia' });
                    }

                    const nuevaMateria = {
                        MAT_ID: results.insertId,
                        MAT_NOMBRE,
                        MAT_DESCRIPCION: MAT_DESCRIPCION || '',
                        MAT_PORTADA: portada,
                        MAT_PORTADA_V: versionPortada(portada),
                        MAT_GRA_ID: graId,
                        MAT_SUB_ID: subId,
                        SUB_NOMBRE: filasSub[0].SUB_NOMBRE,
                        MAT_STATUS: 1,
                        tipo_contenido: 9,
                        titulo: MAT_NOMBRE,
                        operation: 'insert'
                    };

                    if (req.io) {
                        req.io.to('global-room').emit('new-upload', nuevaMateria);
                    }

                    res.status(201).json(nuevaMateria);
                });
            }
        );
    } catch (error) {
        console.error('Error general al añadir materia:', error);
        limpiarTemporal();
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Actualiza una materia.
 * PUT /materias/:id
 * Body: MAT_NOMBRE, MAT_GRA_ID, MAT_SUB_ID, [MAT_DESCRIPCION], [portada].
 *
 * Si cambia el nombre o el subsistema, la portada existente se renombra para
 * seguir la misma convención; si se sube una nueva, sustituye a la anterior.
 */
exports.updateMateria = async (req, res) => {
    const limpiarTemporal = () => {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => {});
        }
    };

    try {
        const id = parseInt(req.params.id, 10);
        const { MAT_NOMBRE, MAT_DESCRIPCION, MAT_GRA_ID, MAT_SUB_ID } = req.body;

        const graId = parseInt(MAT_GRA_ID, 10);
        const subId = parseInt(MAT_SUB_ID, 10);

        if (!Number.isInteger(id) || id <= 0) {
            limpiarTemporal();
            return res.status(400).json({ error: 'ID de materia inválido' });
        }
        if (!MAT_NOMBRE || !Number.isInteger(graId) || graId <= 0 || !Number.isInteger(subId) || subId <= 0) {
            limpiarTemporal();
            return res.status(400).json({ error: 'Faltan campos requeridos: MAT_NOMBRE, MAT_GRA_ID y MAT_SUB_ID' });
        }

        req.db.query('SELECT * FROM CAS_MATERIA WHERE MAT_ID = ?', [id], (errActual, filas) => {
            if (errActual) {
                console.error('Error al buscar la materia:', errActual);
                limpiarTemporal();
                return res.status(500).json({ error: 'Error al buscar la materia' });
            }
            if (!filas || filas.length === 0) {
                limpiarTemporal();
                return res.status(404).json({ error: 'Materia no encontrada' });
            }

            const actual = filas[0];

            req.db.query(
                'SELECT SUB_ID, SUB_NOMBRE FROM CAS_SUBSISTEMA WHERE SUB_ID = ?',
                [subId],
                (errSub, filasSub) => {
                    if (errSub || !filasSub || filasSub.length === 0) {
                        limpiarTemporal();
                        return res.status(400).json({ error: 'El subsistema seleccionado no existe' });
                    }

                    const nombreSub = filasSub[0].SUB_NOMBRE;
                    let portada = actual.MAT_PORTADA;
                    const portadaAnterior = actual.MAT_PORTADA;

                    try {
                        if (req.file) {
                            // Portada nueva: sustituye a la anterior.
                            const ext = path.extname(req.file.filename).toLowerCase();
                            const nombreFinal = nombrePortada(MAT_NOMBRE, nombreSub, ext);
                            fs.renameSync(req.file.path, path.join(BASE_DIR, nombreFinal));
                            portada = `${CARPETA_PUBLICA}/${nombreFinal}`;
                        } else if (portadaAnterior) {
                            // Sin archivo nuevo: si cambió el nombre o el subsistema,
                            // el archivo debe seguir la convención actual.
                            const ext = path.extname(portadaAnterior).toLowerCase();
                            const nombreFinal = nombrePortada(MAT_NOMBRE, nombreSub, ext);
                            const rutaNueva = `${CARPETA_PUBLICA}/${nombreFinal}`;
                            if (rutaNueva !== portadaAnterior) {
                                const origen = path.join(BASE_DIR, path.basename(portadaAnterior));
                                if (fs.existsSync(origen)) {
                                    fs.copyFileSync(origen, path.join(BASE_DIR, nombreFinal));
                                }
                                portada = rutaNueva;
                            }
                        }
                    } catch (e) {
                        console.error('Error al procesar la portada:', e);
                        limpiarTemporal();
                        return res.status(500).json({ error: 'Error al procesar la portada' });
                    }

                    const sql = `UPDATE CAS_MATERIA
                        SET MAT_NOMBRE = ?, MAT_DESCRIPCION = ?, MAT_PORTADA = ?, MAT_GRA_ID = ?, MAT_SUB_ID = ?
                        WHERE MAT_ID = ?`;
                    const values = [MAT_NOMBRE, MAT_DESCRIPCION || '', portada, graId, subId, id];

                    req.db.query(sql, values, (error, result) => {
                        if (error) {
                            console.error('Error al actualizar materia:', error);
                            return res.status(500).json({ error: 'Error al actualizar la materia' });
                        }
                        if (result.affectedRows === 0) {
                            return res.status(404).json({ error: 'Materia no encontrada' });
                        }

                        const responder = () => {
                            const actualizada = {
                                MAT_ID: id,
                                MAT_NOMBRE,
                                MAT_DESCRIPCION: MAT_DESCRIPCION || '',
                                MAT_PORTADA: portada,
                                MAT_PORTADA_V: versionPortada(portada),
                                MAT_GRA_ID: graId,
                                MAT_SUB_ID: subId,
                                SUB_NOMBRE: nombreSub,
                                MAT_STATUS: actual.MAT_STATUS,
                                tipo_contenido: 9,
                                titulo: MAT_NOMBRE,
                                operation: 'update'
                            };
                            if (req.io) {
                                req.io.to('global-room').emit('new-upload', actualizada);
                            }
                            res.status(200).json(actualizada);
                        };

                        // El archivo anterior se retira solo si ya nadie lo usa.
                        if (portadaAnterior && portadaAnterior !== portada) {
                            return borrarPortadaSiNadieLaUsa(req.db, portadaAnterior, id, responder);
                        }
                        responder();
                    });
                }
            );
        });
    } catch (error) {
        console.error('Error general al actualizar materia:', error);
        limpiarTemporal();
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Elimina una materia.
 * DELETE /materias/:id
 *
 * Se bloquea si hay productos o multimedia asociados: no existen claves foráneas
 * en la base, así que borrarla dejaría esos registros apuntando a un id inexistente.
 */
exports.deleteMateria = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID de materia inválido' });
        }

        req.db.query(
            `SELECT m.MAT_ID, m.MAT_NOMBRE, m.MAT_PORTADA,
                    (SELECT COUNT(*) FROM CAS_PRODUCTOS p WHERE p.PRO_MAT_ID = m.MAT_ID) AS productos,
                    (SELECT COUNT(*) FROM CAS_MULTIMEDIA mu WHERE mu.MUL_MAT_ID = m.MAT_ID) AS multimedia
             FROM CAS_MATERIA m WHERE m.MAT_ID = ?`,
            [id],
            (errBuscar, filas) => {
                if (errBuscar) {
                    console.error('Error al buscar la materia:', errBuscar);
                    return res.status(500).json({ error: 'Error al buscar la materia' });
                }
                if (!filas || filas.length === 0) {
                    return res.status(404).json({ error: 'Materia no encontrada' });
                }

                const materia = filas[0];
                const productos = Number(materia.productos) || 0;
                const multimedia = Number(materia.multimedia) || 0;

                if (productos > 0 || multimedia > 0) {
                    const partes = [];
                    if (productos > 0) partes.push(`${productos} producto(s)`);
                    if (multimedia > 0) partes.push(`${multimedia} archivo(s) multimedia`);
                    return res.status(409).json({
                        error: `No se puede eliminar: la materia tiene ${partes.join(' y ')} asociados`,
                        productos,
                        multimedia,
                    });
                }

                req.db.query('DELETE FROM CAS_MATERIA WHERE MAT_ID = ?', [id], (error, result) => {
                    if (error) {
                        console.error('Error al eliminar materia:', error);
                        return res.status(500).json({ error: 'Error al eliminar la materia' });
                    }
                    if (result.affectedRows === 0) {
                        return res.status(404).json({ error: 'Materia no encontrada' });
                    }

                    borrarPortadaSiNadieLaUsa(req.db, materia.MAT_PORTADA, id, () => {
                        if (req.io) {
                            req.io.to('global-room').emit('new-upload', {
                                MAT_ID: id,
                                tipo_contenido: 9,
                                titulo: materia.MAT_NOMBRE,
                                operation: 'delete'
                            });
                        }
                        res.status(200).json({ ok: true, MAT_ID: id });
                    });
                });
            }
        );
    } catch (error) {
        console.error('Error general al eliminar materia:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
