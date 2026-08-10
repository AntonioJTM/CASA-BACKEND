/**
 * Lista todos los paquetes desde CAS_PAQUETE con:
 * - Nombre del usuario (JOIN con CAS_USUARIO_ADMIN)
 * - Nombres de productos expandidos (JOIN con CAS_PRODUCTOS usando PAQ_PRODUCTOS JSON)
 * GET /paquetes-completos -> [{ id, nombre, descripcion, fechaRegistro, usuarioNombre, uadId, productos: [{ id, nombre }] }, ...]
 */
exports.getPaquetesCompletos = (req, res) => {
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
        ORDER BY p.PAQ_ID DESC`,
        [],
        (error, rows) => {
            if (error) {
                console.error('Error al obtener paquetes completos:', error);
                return res.status(500).json({
                    success: false,
                    status: 'ERROR',
                    message: 'Error al obtener paquetes'
                });
            }

            const list = Array.isArray(rows) ? rows : [];
            const paquetes = [];

            // Procesar cada paquete y expandir productos
            const procesarPaquete = (index, callback) => {
                if (index >= list.length) {
                    return callback();
                }

                const row = list[index];
                let productoIds = [];
                
                // Parsear JSON de productos
                if (row.productosJson) {
                    try {
                        const parsed = JSON.parse(row.productosJson);
                        productoIds = Array.isArray(parsed) ? parsed : [];
                    } catch (_) {
                        productoIds = [];
                    }
                }

                // Si no hay productos, agregar el paquete sin productos
                if (productoIds.length === 0) {
                    paquetes.push({
                        id: row.id,
                        nombre: row.nombre,
                        descripcion: row.descripcion,
                        fechaRegistro: row.fechaRegistro,
                        usuarioNombre: row.usuarioNombre,
                        uadId: row.uadId,
                        cantidadLicencias: row.cantidadLicencias ?? 0,
                        tieneLicencias: row.tieneLicencias ?? 0,
                        productos: []
                    });
                    return procesarPaquete(index + 1, callback);
                }

                // Obtener nombres de productos con JOIN
                const idsPlaceholder = productoIds.map(() => '?').join(',');
                req.db.query(
                    `SELECT PRO_ID AS id, PRO_NOMBRE AS nombre 
                     FROM CAS_PRODUCTOS 
                     WHERE PRO_ID IN (${idsPlaceholder})`,
                    productoIds,
                    (err, productos) => {
                        if (err) {
                            console.error('Error al obtener productos:', err);
                            productos = [];
                        }

                        paquetes.push({
                            id: row.id,
                            nombre: row.nombre,
                            descripcion: row.descripcion,
                            fechaRegistro: row.fechaRegistro,
                            usuarioNombre: row.usuarioNombre,
                            uadId: row.uadId,
                            cantidadLicencias: row.cantidadLicencias ?? 0,
                            tieneLicencias: row.tieneLicencias ?? 0,
                            productos: Array.isArray(productos) ? productos : []
                        });

                        procesarPaquete(index + 1, callback);
                    }
                );
            };

            procesarPaquete(0, () => {
                res.status(200).json(paquetes);
            });
        }
    );
};
