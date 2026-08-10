/**
 * Registra un paquete en CAS_PAQUETE (PAQ_NOMBRE, PAQ_DESCRIPCION, PAQ_PRODUCTOS, PAQ_FECHA_REGISTRO, PAQ_UAD_ID).
 * Body: { nombre, descripcion, productoIds, [id_usuario] }
 * productoIds se guarda como JSON en PAQ_PRODUCTOS (longtext).
 * Emite evento Socket.IO 'paquete-nuevo' para actualización en tiempo real.
 */
exports.registrarPaquete = (req, res) => {
    try {
        const { nombre, descripcion, productoIds, id_usuario } = req.body;

        if (!nombre || nombre.toString().trim() === '') {
            return res.status(400).json({
                success: false,
                status: 'BAD_REQUEST',
                message: 'El campo nombre es requerido'
            });
        }
        if (!descripcion || descripcion.toString().trim() === '') {
            return res.status(400).json({
                success: false,
                status: 'BAD_REQUEST',
                message: 'El campo descripcion es requerido'
            });
        }
        if (!Array.isArray(productoIds)) {
            return res.status(400).json({
                success: false,
                status: 'BAD_REQUEST',
                message: 'El campo productoIds debe ser un arreglo'
            });
        }

        const ids = productoIds
            .map(id => Number(id))
            .filter(id => !Number.isNaN(id) && Number.isInteger(id) && id > 0);

        const nombreVal = nombre.toString().trim().substring(0, 100);
        const descripcionVal = descripcion.toString().trim().substring(0, 100);
        const productosJson = JSON.stringify(ids);
        const fechaRegistro = new Date().toISOString().slice(0, 10);
        const uadId = (id_usuario != null && id_usuario !== '') ? Number(id_usuario) : null;

        req.db.query(
            'INSERT INTO CAS_PAQUETE (PAQ_NOMBRE, PAQ_DESCRIPCION, PAQ_PRODUCTOS, PAQ_FECHA_REGISTRO, PAQ_UAD_ID) VALUES (?, ?, ?, ?, ?)',
            [nombreVal, descripcionVal, productosJson, fechaRegistro, uadId],
            (error, result) => {
                if (error) {
                    console.error('Error al registrar paquete:', error);
                    return res.status(500).json({
                        success: false,
                        status: 'ERROR',
                        message: 'Error al registrar el paquete'
                    });
                }

                const paqueteId = result.insertId;

                // Obtener datos completos del paquete con usuario y productos para Socket.IO
                req.db.query(
                    `SELECT 
                        p.PAQ_ID AS id,
                        p.PAQ_NOMBRE AS nombre,
                        p.PAQ_DESCRIPCION AS descripcion,
                        p.PAQ_PRODUCTOS AS productosJson,
                        p.PAQ_FECHA_REGISTRO AS fechaRegistro,
                        COALESCE(u.UAD_NOMBRE, 'Sin usuario') AS usuarioNombre,
                        p.PAQ_UAD_ID AS uadId
                    FROM CAS_PAQUETE p
                    LEFT JOIN CAS_USUARIO_ADMIN u ON p.PAQ_UAD_ID = u.UAD_ID
                    WHERE p.PAQ_ID = ?`,
                    [paqueteId],
                    (err, rows) => {
                        if (err) {
                            console.error('Error al obtener paquete completo:', err);
                            return res.status(201).json({
                                success: true,
                                message: 'Paquete registrado correctamente',
                                data: {
                                    id: paqueteId,
                                    nombre: nombreVal,
                                    descripcion: descripcionVal,
                                    productoIds: ids
                                }
                            });
                        }

                        const row = rows && rows[0] ? rows[0] : null;
                        if (!row) {
                            return res.status(201).json({
                                success: true,
                                message: 'Paquete registrado correctamente',
                                data: {
                                    id: paqueteId,
                                    nombre: nombreVal,
                                    descripcion: descripcionVal,
                                    productoIds: ids
                                }
                            });
                        }

                        // Obtener nombres de productos
                        let productoIds = [];
                        if (row.productosJson) {
                            try {
                                const parsed = JSON.parse(row.productosJson);
                                productoIds = Array.isArray(parsed) ? parsed : [];
                            } catch (_) {
                                productoIds = [];
                            }
                        }

                        const obtenerProductos = (callback) => {
                            if (productoIds.length === 0) {
                                return callback([]);
                            }
                            const idsPlaceholder = productoIds.map(() => '?').join(',');
                            req.db.query(
                                `SELECT PRO_ID AS id, PRO_NOMBRE AS nombre 
                                 FROM CAS_PRODUCTOS 
                                 WHERE PRO_ID IN (${idsPlaceholder})`,
                                productoIds,
                                (err2, productos) => {
                                    callback(Array.isArray(productos) ? productos : []);
                                }
                            );
                        };

                        obtenerProductos((productos) => {
                            const paqueteCompleto = {
                                id: row.id,
                                nombre: row.nombre,
                                descripcion: row.descripcion,
                                fechaRegistro: row.fechaRegistro,
                                usuarioNombre: row.usuarioNombre,
                                uadId: row.uadId,
                                cantidadLicencias: 0,
                                tieneLicencias: 0,
                                productos: productos
                            };

                            // Emitir evento Socket.IO para actualización en tiempo real
                            if (req.io) {
                                req.io.emit('paquete-nuevo', {
                                    success: true,
                                    paquete: paqueteCompleto
                                });
                            }

                            res.status(201).json({
                                success: true,
                                message: 'Paquete registrado correctamente',
                                data: paqueteCompleto
                            });
                        });
                    }
                );
            }
        );
    } catch (err) {
        console.error('Error en registrarPaquete:', err);
        res.status(500).json({
            success: false,
            status: 'ERROR',
            message: 'Error en el servidor'
        });
    }
};
