/**
 * Actualiza un paquete en CAS_PAQUETE.
 * PUT /paquetes/:id
 * Body: { nombre, descripcion, productoIds }
 * Emite evento Socket.IO 'paquete-actualizado' para actualización en tiempo real.
 */
exports.updatePaquete = (req, res) => {
    try {
        const paqueteId = req.params.id;
        const { nombre, descripcion, productoIds } = req.body;

        if (!paqueteId || isNaN(Number(paqueteId))) {
            return res.status(400).json({
                success: false,
                status: 'BAD_REQUEST',
                message: 'ID de paquete inválido'
            });
        }
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

        req.db.query('SELECT PAQ_ID FROM CAS_PAQUETE WHERE PAQ_ID = ?', [paqueteId], (error, rows) => {
            if (error) {
                console.error('Error al verificar paquete:', error);
                return res.status(500).json({
                    success: false,
                    status: 'ERROR',
                    message: 'Error al verificar paquete'
                });
            }
            if (!rows || rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    status: 'NOT_FOUND',
                    message: 'Paquete no encontrado'
                });
            }

            req.db.query(
                'UPDATE CAS_PAQUETE SET PAQ_NOMBRE = ?, PAQ_DESCRIPCION = ?, PAQ_PRODUCTOS = ? WHERE PAQ_ID = ?',
                [nombreVal, descripcionVal, productosJson, paqueteId],
                (updateError) => {
                    if (updateError) {
                        console.error('Error al actualizar paquete:', updateError);
                        return res.status(500).json({
                            success: false,
                            status: 'ERROR',
                            message: 'Error al actualizar el paquete'
                        });
                    }

                    req.db.query(
                        `SELECT 
                            p.PAQ_ID AS id,
                            p.PAQ_NOMBRE AS nombre,
                            p.PAQ_DESCRIPCION AS descripcion,
                            p.PAQ_PRODUCTOS AS productosJson,
                            p.PAQ_FECHA_REGISTRO AS fechaRegistro,
                            COALESCE(u.UAD_NOMBRE, 'Sin usuario') AS usuarioNombre,
                            p.PAQ_UAD_ID AS uadId,
                            (SELECT COUNT(*) FROM CAS_LICENCIA l WHERE l.LIC_PAQ_ID = p.PAQ_ID) AS cantidadLicencias,
                            (SELECT COUNT(*) > 0 FROM CAS_LICENCIA l WHERE l.LIC_PAQ_ID = p.PAQ_ID) AS tieneLicencias
                        FROM CAS_PAQUETE p
                        LEFT JOIN CAS_USUARIO_ADMIN u ON p.PAQ_UAD_ID = u.UAD_ID
                        WHERE p.PAQ_ID = ?`,
                        [paqueteId],
                        (err, paqRows) => {
                            if (err || !paqRows || !paqRows[0]) {
                                return res.status(200).json({
                                    success: true,
                                    message: 'Paquete actualizado correctamente',
                                    data: {
                                        id: Number(paqueteId),
                                        nombre: nombreVal,
                                        descripcion: descripcionVal,
                                        productos: ids.map(id => ({ id, nombre: '' }))
                                    }
                                });
                            }

                            const row = paqRows[0];
                            const obtenerProductos = (callback) => {
                                if (ids.length === 0) return callback([]);
                                const placeholder = ids.map(() => '?').join(',');
                                req.db.query(
                                    `SELECT PRO_ID AS id, PRO_NOMBRE AS nombre FROM CAS_PRODUCTOS WHERE PRO_ID IN (${placeholder})`,
                                    ids,
                                    (e, prods) => callback(Array.isArray(prods) ? prods : [])
                                );
                            };

                            obtenerProductos((productos) => {
                                const paqueteActualizado = {
                                    id: row.id,
                                    nombre: row.nombre,
                                    descripcion: row.descripcion,
                                    fechaRegistro: row.fechaRegistro,
                                    usuarioNombre: row.usuarioNombre,
                                    uadId: row.uadId,
                                    cantidadLicencias: row.cantidadLicencias ?? 0,
                                    tieneLicencias: row.tieneLicencias ?? 0,
                                    productos: productos
                                };

                                if (req.io) {
                                    req.io.emit('paquete-actualizado', {
                                        success: true,
                                        paquete: paqueteActualizado,
                                        mensaje: `Paquete ${paqueteId} actualizado`
                                    });
                                }

                                res.status(200).json({
                                    success: true,
                                    message: 'Paquete actualizado correctamente',
                                    data: paqueteActualizado
                                });
                            });
                        }
                    );
                }
            );
        });
    } catch (err) {
        console.error('Error en updatePaquete:', err);
        res.status(500).json({
            success: false,
            status: 'ERROR',
            message: 'Error en el servidor'
        });
    }
};
