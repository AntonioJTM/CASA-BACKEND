const { SELECT_LICENCIAS, buildFiltrosLicencias } = require('./licenciasQuery');

/**
 * Lista todas las licencias desde CAS_LICENCIA con información completa:
 * - Nombre del usuario (JOIN con CAS_USUARIO_ADMIN)
 * - Nombre del tipo de venta (JOIN con CAS_VENTA)
 * - Nombre del paquete (JOIN con CAS_PAQUETE)
 * - Información del pedido (JOIN con CAS_PEDIDO)
 * GET /licencias-completas?tipo=&status=&pedidoId=&ventaId=&paqueteId=&q=&desde=&hasta=
 * -> [{ id, licencia, indicio, fechaInicio, fechaFin, tipoVentaNombre, paqueteNombre, pedidoInfo, usuarioNombre, ... }, ...]
 */
exports.getLicenciasCompletas = (req, res) => {
    const { whereClause, params } = buildFiltrosLicencias(req.query);

    const limit = 5000;

    req.db.query(
        `${SELECT_LICENCIAS}
        ${whereClause}
        ORDER BY l.LIC_ID DESC
        LIMIT ${limit}`,
        params,
        (error, rows) => {
            if (error) {
                console.error('Error al obtener licencias completas:', error);
                return res.status(500).json({
                    success: false,
                    status: 'ERROR',
                    message: 'Error al obtener licencias'
                });
            }
            res.status(200).json(Array.isArray(rows) ? rows : []);
        }
    );
};
