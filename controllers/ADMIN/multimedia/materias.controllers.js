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

/** Separador de las etiquetas agregadas; una coma chocaría con GROUP_CONCAT. */
const SEP_ETIQUETAS = '|';

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

/**
 * Nombre definitivo de la portada: materia + MAT_ID.
 *
 * Antes llevaba el subsistema, que servía para que dos materias homónimas de
 * subsistemas distintos no se pisaran. Ahora una materia puede impartirse en
 * varios subsistemas a la vez, así que ese sufijo ya no identifica nada; el
 * MAT_ID sí.
 */
function nombrePortada(nombreMateria, matId, ext) {
    return `${slugify(nombreMateria)}-${matId}${ext}`;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(BASE_DIR, { recursive: true });
        cb(null, BASE_DIR);
    },
    filename: (req, file, cb) => {
        // Nombre provisional: el definitivo lleva el MAT_ID, que en un alta no
        // existe hasta después del INSERT.
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
 * Lista de ids desde el body.
 *
 * El alta llega como JSON cuando no hay portada y como multipart cuando sí la
 * hay; en multipart todo es texto, así que un arreglo puede venir como
 * '[1,3]' o '1,3'. Se aceptan las tres formas.
 */
function parseIds(valor) {
    if (valor == null || valor === '') return [];

    let bruto = valor;
    if (typeof valor === 'string') {
        const texto = valor.trim();
        if (texto.startsWith('[')) {
            try {
                bruto = JSON.parse(texto);
            } catch (e) {
                bruto = texto.replace(/^\[|\]$/g, '').split(',');
            }
        } else {
            bruto = texto.split(',');
        }
    }
    if (!Array.isArray(bruto)) bruto = [bruto];

    const ids = bruto
        .map((v) => parseInt(v, 10))
        .filter((n) => Number.isInteger(n) && n > 0);

    return [...new Set(ids)];
}

/**
 * Ejecuta `work` dentro de una transacción sobre una sola conexión del pool.
 *
 * Hace falta porque una materia se guarda en dos tablas (CAS_MATERIA y
 * CAS_GRADO_MATERIA) y un fallo a medias dejaría una materia sin semestres.
 * `work` recibe un `query` que devuelve promesa y está atado a esa conexión.
 */
function conTransaccion(pool, work) {
    return new Promise((resolve, reject) => {
        pool.getConnection((errConn, conn) => {
            if (errConn) return reject(errConn);

            const terminar = (err, valor) => {
                conn.release();
                if (err) reject(err); else resolve(valor);
            };

            conn.beginTransaction((errTx) => {
                if (errTx) return terminar(errTx);

                const query = (sql, params) => new Promise((res, rej) => {
                    conn.query(sql, params, (e, r) => (e ? rej(e) : res(r)));
                });

                Promise.resolve()
                    .then(() => work(query))
                    .then((valor) => {
                        conn.commit((errCommit) => {
                            if (errCommit) return conn.rollback(() => terminar(errCommit));
                            terminar(null, valor);
                        });
                    })
                    .catch((err) => conn.rollback(() => terminar(err)));
            });
        });
    });
}

/**
 * Valida los semestres y devuelve el subsistema de cada uno.
 *
 * Cada fila de CAS_GRADO es "semestre N del subsistema X", así que la lista de
 * semestres ya lleva implícitos los subsistemas: no hace falta guardarlos aparte.
 */
async function resolverGrados(query, gradoIds) {
    const filas = await query(
        'SELECT GRA_ID, GRA_SUB_ID FROM CAS_GRADO WHERE GRA_ID IN (?)',
        [gradoIds]
    );
    if ((filas || []).length !== gradoIds.length) {
        throw Object.assign(
            new Error('Alguno de los semestres seleccionados no existe'),
            { status: 400 }
        );
    }
    return new Map((filas || []).map((f) => [Number(f.GRA_ID), Number(f.GRA_SUB_ID)]));
}

/** Reemplaza los semestres de una materia por los que lleguen. */
async function guardarSemestres(query, matId, gradoIds) {
    await query('DELETE FROM CAS_GRADO_MATERIA WHERE GMA_MAT_ID = ?', [matId]);
    if (gradoIds.length > 0) {
        await query(
            'INSERT INTO CAS_GRADO_MATERIA (GMA_MAT_ID, GMA_GRA_ID) VALUES ?',
            [gradoIds.map((graId) => [matId, graId])]
        );
    }
}

/**
 * Valida nombre y semestres del body.
 * Devuelve { error } o { nombre, descripcion, gradoIds }.
 */
function leerDatosMateria(body) {
    const nombre = (body.MAT_NOMBRE || '').toString().trim();
    const gradoIds = parseIds(body.MAT_GRADOS);

    if (!nombre) {
        return { error: 'El nombre de la materia es obligatorio' };
    }
    if (gradoIds.length === 0) {
        return { error: 'Seleccione al menos un semestre' };
    }

    return {
        nombre,
        descripcion: (body.MAT_DESCRIPCION || '').toString(),
        gradoIds,
    };
}

/**
 * Borra el archivo de una portada, salvo que otra materia siga usándolo.
 * Las portadas con el esquema anterior (nombre + subsistema) podían compartirse
 * entre materias homónimas, así que borrar sin comprobar dejaría a la otra sin
 * imagen.
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

/** Convierte un GROUP_CONCAT numérico en arreglo de números. */
function aListaDeIds(concatenado) {
    if (concatenado == null || concatenado === '') return [];
    return String(concatenado)
        .split(',')
        .map((v) => parseInt(v, 10))
        .filter((n) => Number.isInteger(n));
}

/** Convierte un GROUP_CONCAT de texto en arreglo de cadenas. */
function aListaDeTextos(concatenado, separador) {
    if (concatenado == null || concatenado === '') return [];
    return String(concatenado).split(separador).filter((v) => v !== '');
}

/**
 * Semestres y subsistemas de una materia, agregados desde CAS_GRADO_MATERIA.
 * Va como subconsultas para no multiplicar filas contra los conteos de uso.
 */
const SQL_AGREGADOS = `
    (SELECT GROUP_CONCAT(g.GRA_ID ORDER BY s.SUB_NOMBRE, g.GRA_NUMERO)
       FROM CAS_GRADO_MATERIA gm
       JOIN CAS_GRADO g       ON g.GRA_ID = gm.GMA_GRA_ID
       LEFT JOIN CAS_SUBSISTEMA s ON s.SUB_ID = g.GRA_SUB_ID
      WHERE gm.GMA_MAT_ID = m.MAT_ID)                       AS GRADOS_IDS,
    (SELECT GROUP_CONCAT(CONCAT(COALESCE(s.SUB_NOMBRE, '?'), '-', g.GRA_NUMERO, ' ',
                                COALESCE(g.GRA_NOMBRE, 'Semestre'))
                         ORDER BY s.SUB_NOMBRE, g.GRA_NUMERO
                         SEPARATOR '${SEP_ETIQUETAS}')
       FROM CAS_GRADO_MATERIA gm
       JOIN CAS_GRADO g       ON g.GRA_ID = gm.GMA_GRA_ID
       LEFT JOIN CAS_SUBSISTEMA s ON s.SUB_ID = g.GRA_SUB_ID
      WHERE gm.GMA_MAT_ID = m.MAT_ID)                       AS GRADOS_ETIQUETAS,
    (SELECT GROUP_CONCAT(DISTINCT g.GRA_SUB_ID)
       FROM CAS_GRADO_MATERIA gm
       JOIN CAS_GRADO g ON g.GRA_ID = gm.GMA_GRA_ID
      WHERE gm.GMA_MAT_ID = m.MAT_ID)                       AS SUBSISTEMAS_IDS,
    (SELECT GROUP_CONCAT(DISTINCT s.SUB_NOMBRE ORDER BY s.SUB_NOMBRE SEPARATOR '${SEP_ETIQUETAS}')
       FROM CAS_GRADO_MATERIA gm
       JOIN CAS_GRADO g           ON g.GRA_ID = gm.GMA_GRA_ID
       JOIN CAS_SUBSISTEMA s      ON s.SUB_ID = g.GRA_SUB_ID
      WHERE gm.GMA_MAT_ID = m.MAT_ID)                       AS SUBSISTEMAS_NOMBRES`;

/** Añade a cada fila los arreglos que consume el front. */
function conAgregados(fila) {
    return {
        ...fila,
        MAT_PORTADA_V: versionPortada(fila.MAT_PORTADA),
        MAT_GRADOS: aListaDeIds(fila.GRADOS_IDS),
        MAT_GRADOS_ETIQUETAS: aListaDeTextos(fila.GRADOS_ETIQUETAS, SEP_ETIQUETAS),
        MAT_SUBSISTEMAS: aListaDeIds(fila.SUBSISTEMAS_IDS),
        MAT_SUBSISTEMAS_NOMBRES: aListaDeTextos(fila.SUBSISTEMAS_NOMBRES, SEP_ETIQUETAS),
    };
}

exports.getTodasMaterias = async (req, res) => {
    try {
        const sql = `
            SELECT m.*,
                   ${SQL_AGREGADOS},
                   (SELECT COUNT(*) FROM CAS_PRODUCTOS p WHERE p.PRO_MAT_ID = m.MAT_ID)    AS TOTAL_PRODUCTOS,
                   (SELECT COUNT(*) FROM CAS_MULTIMEDIA mu WHERE mu.MUL_MAT_ID = m.MAT_ID) AS TOTAL_MULTIMEDIA
            FROM CAS_MATERIA m
            ORDER BY m.MAT_NOMBRE ASC`;

        req.db.query(sql, (error, results) => {
            if (error) {
                console.error('Error al obtener materias:', error);
                return res.status(500).json({ error: 'Error del servidor al obtener las materias' });
            }
            res.json((results || []).map(conAgregados));
        });
    } catch (error) {
        console.error('Error general obtener materias:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/** Relee una materia ya guardada para responder y emitir con la misma forma que el listado. */
function leerMateria(db, matId, callback) {
    db.query(
        `SELECT m.*, ${SQL_AGREGADOS} FROM CAS_MATERIA m WHERE m.MAT_ID = ?`,
        [matId],
        (err, filas) => {
            if (err || !filas || filas.length === 0) return callback(null);
            callback(conAgregados(filas[0]));
        }
    );
}

/**
 * Registra una materia.
 *
 * Body: MAT_NOMBRE, MAT_GRADOS (ids de CAS_GRADO), [MAT_DESCRIPCION], [portada].
 *
 * Los subsistemas no viajan aparte: cada semestre ya pertenece a uno.
 * Escribe en CAS_MATERIA y CAS_GRADO_MATERIA dentro de una transacción.
 */
exports.addMateria = async (req, res) => {
    const limpiarTemporal = () => {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => {});
        }
    };

    const datos = leerDatosMateria(req.body || {});
    if (datos.error) {
        limpiarTemporal();
        return res.status(400).json({ error: datos.error });
    }

    const { nombre, descripcion, gradoIds } = datos;
    // La portada se renombra al final, ya con el MAT_ID; si algo falla después
    // hay que retirarla.
    let portadaGuardada = null;

    try {
        const matId = await conTransaccion(req.db, async (query) => {
            const subsistemaPorGrado = await resolverGrados(query, gradoIds);

            // MAT_GRA_ID y MAT_SUB_ID quedan como espejo del primer semestre
            // marcado: la verdad está en CAS_GRADO_MATERIA, pero se siguen
            // llenando para no dejar sin valor a lo que todavía las lea.
            const graPrincipal = gradoIds[0];
            const subPrincipal = subsistemaPorGrado.get(graPrincipal) ?? null;

            const insercion = await query(
                `INSERT INTO CAS_MATERIA
                    (MAT_NOMBRE, MAT_DESCRIPCION, MAT_PORTADA, MAT_GRA_ID, MAT_SUB_ID, MAT_STATUS)
                 VALUES (?, ?, NULL, ?, ?, 1)`,
                [nombre, descripcion, graPrincipal, subPrincipal]
            );
            const nuevoId = insercion.insertId;

            await guardarSemestres(query, nuevoId, gradoIds);

            if (req.file) {
                const ext = path.extname(req.file.filename).toLowerCase();
                const nombreFinal = nombrePortada(nombre, nuevoId, ext);
                fs.renameSync(req.file.path, path.join(BASE_DIR, nombreFinal));
                portadaGuardada = `${CARPETA_PUBLICA}/${nombreFinal}`;
                await query('UPDATE CAS_MATERIA SET MAT_PORTADA = ? WHERE MAT_ID = ?', [portadaGuardada, nuevoId]);
            }

            return nuevoId;
        });

        leerMateria(req.db, matId, (materia) => {
            const nuevaMateria = {
                ...(materia || { MAT_ID: matId, MAT_NOMBRE: nombre }),
                tipo_contenido: 9,
                titulo: nombre,
                operation: 'insert'
            };
            if (req.io) {
                req.io.to('global-room').emit('new-upload', nuevaMateria);
            }
            res.status(201).json(nuevaMateria);
        });
    } catch (error) {
        console.error('Error al registrar materia:', error);
        limpiarTemporal();
        if (portadaGuardada) {
            fs.unlink(path.join(BASE_DIR, path.basename(portadaGuardada)), () => {});
        }
        res.status(error.status || 500).json({
            error: error.status ? error.message : 'Error al registrar la materia'
        });
    }
};

/**
 * Actualiza una materia.
 * PUT /materias/:id
 * Body: MAT_NOMBRE, MAT_GRADOS (ids de CAS_GRADO), [MAT_DESCRIPCION], [portada].
 *
 * Los semestres se reemplazan por completo por los que lleguen. Si cambia el
 * nombre, la portada existente se renombra para seguir la convención; si se
 * sube una nueva, sustituye a la anterior.
 */
exports.updateMateria = async (req, res) => {
    const limpiarTemporal = () => {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => {});
        }
    };

    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        limpiarTemporal();
        return res.status(400).json({ error: 'ID de materia inválido' });
    }

    const datos = leerDatosMateria(req.body || {});
    if (datos.error) {
        limpiarTemporal();
        return res.status(400).json({ error: datos.error });
    }

    const { nombre, descripcion, gradoIds } = datos;

    try {
        const resultado = await conTransaccion(req.db, async (query) => {
            const filas = await query('SELECT * FROM CAS_MATERIA WHERE MAT_ID = ?', [id]);
            if (!filas || filas.length === 0) {
                throw Object.assign(new Error('Materia no encontrada'), { status: 404 });
            }
            const actual = filas[0];

            const subsistemaPorGrado = await resolverGrados(query, gradoIds);
            const graPrincipal = gradoIds[0];
            const subPrincipal = subsistemaPorGrado.get(graPrincipal) ?? null;

            const portadaAnterior = actual.MAT_PORTADA;
            let portada = portadaAnterior;

            if (req.file) {
                // Portada nueva: sustituye a la anterior.
                const ext = path.extname(req.file.filename).toLowerCase();
                const nombreFinal = nombrePortada(nombre, id, ext);
                fs.renameSync(req.file.path, path.join(BASE_DIR, nombreFinal));
                portada = `${CARPETA_PUBLICA}/${nombreFinal}`;
            } else if (portadaAnterior) {
                // Sin archivo nuevo: si cambió el nombre, el archivo debe seguir
                // la convención actual.
                const ext = path.extname(portadaAnterior).toLowerCase();
                const rutaNueva = `${CARPETA_PUBLICA}/${nombrePortada(nombre, id, ext)}`;
                if (rutaNueva !== portadaAnterior) {
                    const origen = path.join(BASE_DIR, path.basename(portadaAnterior));
                    if (fs.existsSync(origen)) {
                        fs.copyFileSync(origen, path.join(BASE_DIR, path.basename(rutaNueva)));
                    }
                    portada = rutaNueva;
                }
            }

            await query(
                `UPDATE CAS_MATERIA
                    SET MAT_NOMBRE = ?, MAT_DESCRIPCION = ?, MAT_PORTADA = ?,
                        MAT_GRA_ID = ?, MAT_SUB_ID = ?
                  WHERE MAT_ID = ?`,
                [nombre, descripcion, portada, graPrincipal, subPrincipal, id]
            );

            await guardarSemestres(query, id, gradoIds);

            return { portada, portadaAnterior };
        });

        const responder = () => {
            leerMateria(req.db, id, (materia) => {
                const actualizada = {
                    ...(materia || { MAT_ID: id, MAT_NOMBRE: nombre }),
                    tipo_contenido: 9,
                    titulo: nombre,
                    operation: 'update'
                };
                if (req.io) {
                    req.io.to('global-room').emit('new-upload', actualizada);
                }
                res.status(200).json(actualizada);
            });
        };

        // El archivo anterior se retira solo si ya nadie lo usa.
        if (resultado.portadaAnterior && resultado.portadaAnterior !== resultado.portada) {
            return borrarPortadaSiNadieLaUsa(req.db, resultado.portadaAnterior, id, responder);
        }
        responder();
    } catch (error) {
        console.error('Error al actualizar materia:', error);
        limpiarTemporal();
        res.status(error.status || 500).json({
            error: error.status ? error.message : 'Error al actualizar la materia'
        });
    }
};

/**
 * Elimina una materia.
 * DELETE /materias/:id
 *
 * Se bloquea si hay productos o multimedia asociados: esas tablas no tienen
 * clave foránea contra CAS_MATERIA, así que borrarla dejaría sus registros
 * apuntando a un id inexistente.
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
            async (errBuscar, filas) => {
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

                try {
                    // CAS_GRADO_MATERIA sí tiene FK contra CAS_MATERIA: hay que
                    // vaciarla antes de borrar la materia.
                    await conTransaccion(req.db, async (query) => {
                        await query('DELETE FROM CAS_GRADO_MATERIA WHERE GMA_MAT_ID = ?', [id]);
                        const r = await query('DELETE FROM CAS_MATERIA WHERE MAT_ID = ?', [id]);
                        if (!r || r.affectedRows === 0) {
                            throw Object.assign(new Error('Materia no encontrada'), { status: 404 });
                        }
                    });
                } catch (error) {
                    console.error('Error al eliminar materia:', error);
                    return res.status(error.status || 500).json({
                        error: error.status ? error.message : 'Error al eliminar la materia'
                    });
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
            }
        );
    } catch (error) {
        console.error('Error general al eliminar materia:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
