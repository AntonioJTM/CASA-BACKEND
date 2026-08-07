/**
 * Devuelve los datos necesarios para ampliar el lote de licencias de un pedido:
 * el pedido y la "plantilla" tomada de su última licencia (tipo de venta, paquete,
 * indicio, vigencia, etc.), de modo que las licencias nuevas salgan idénticas a las
 * originales y el usuario solo tenga que capturar la cantidad.
 *
 * GET /pedidos/:id/plantilla-licencia
 * -> { pedido: {...}, plantilla: {...} | null, totalLicencias: number }
 */
exports.getPlantillaLicenciaPedido = (req, res) => {
    const pedidoId = Number(req.params.id);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({
            success: false,
            status: 'BAD_REQUEST',
            message: 'El id del pedido no es válido'
        });
    }

    req.db.query(
        `SELECT
            p.PDD_ID AS id,
            p.PDD_BITACORA AS bitacora,
            p.PDD_SISTEMA AS sistema,
            p.PDD_SOLICITANTE AS solicitante,
            p.PDD_FECHA_REGISTRO AS fechaRegistro,
            p.PDD_UAD_ID AS uadId
        FROM CAS_PEDIDO p
        WHERE p.PDD_ID = ?`,
        [pedidoId],
        (errPedido, pedidos) => {
            if (errPedido) {
                console.error('Error al obtener el pedido:', errPedido);
                return res.status(500).json({
                    success: false,
                    status: 'ERROR',
                    message: 'Error al obtener el pedido'
                });
            }

            if (!pedidos || !pedidos[0]) {
                return res.status(404).json({
                    success: false,
                    status: 'NOT_FOUND',
                    message: 'Pedido no encontrado'
                });
            }

            req.db.query(
                `SELECT
                    l.LIC_VEN_ID AS venId,
                    COALESCE(v.VEN_NOMBRE, '') AS tipoVentaNombre,
                    l.LIC_PAQ_ID AS paqId,
                    COALESCE(paq.PAQ_NOMBRE, '') AS paqueteNombre,
                    l.LIC_INDICIO AS indicio,
                    l.LIC_FECHA_INICIO AS fechaInicio,
                    l.LIC_FECHA_FIN AS fechaFin,
                    l.LIC_TIEMPO AS tiempo,
                    l.LIC_NUM_CARACTERES AS numCaracteres,
                    l.LIC_TIPO AS tipo
                FROM CAS_LICENCIA l
                LEFT JOIN CAS_VENTA v ON l.LIC_VEN_ID = v.VEN_ID
                LEFT JOIN CAS_PAQUETE paq ON l.LIC_PAQ_ID = paq.PAQ_ID
                WHERE l.LIC_PDD_ID = ?
                ORDER BY l.LIC_ID DESC
                LIMIT 1`,
                [pedidoId],
                (errLic, licencias) => {
                    if (errLic) {
                        console.error('Error al obtener la plantilla de licencia:', errLic);
                        return res.status(500).json({
                            success: false,
                            status: 'ERROR',
                            message: 'Error al obtener la plantilla del pedido'
                        });
                    }

                    req.db.query(
                        'SELECT COUNT(*) AS total FROM CAS_LICENCIA WHERE LIC_PDD_ID = ?',
                        [pedidoId],
                        (errTotal, totales) => {
                            if (errTotal) {
                                console.error('Error al contar licencias del pedido:', errTotal);
                                return res.status(500).json({
                                    success: false,
                                    status: 'ERROR',
                                    message: 'Error al contar las licencias del pedido'
                                });
                            }

                            res.status(200).json({
                                pedido: pedidos[0],
                                plantilla: (licencias && licencias[0]) || null,
                                totalLicencias: (totales && totales[0] && totales[0].total) || 0
                            });
                        }
                    );
                }
            );
        }
    );
};
