/**
 * Lista todos los pedidos desde CAS_PEDIDO con el nombre del usuario
 * (JOIN con CAS_USUARIO_ADMIN).
 * GET /pedidos-completos -> [{ id, bitacora, sistema, solicitante, fechaRegistro, usuarioNombre, uadId }, ...]
 */
exports.getPedidosCompletos = (req, res) => {
    req.db.query(
        `SELECT 
            p.PDD_ID AS id,
            p.PDD_BITACORA AS bitacora,
            p.PDD_SISTEMA AS sistema,
            p.PDD_SOLICITANTE AS solicitante,
            p.PDD_FECHA_REGISTRO AS fechaRegistro,
            COALESCE(u.UAD_NOMBRE, 'Sin usuario') AS usuarioNombre,
            p.PDD_UAD_ID AS uadId,
            (SELECT COUNT(*) FROM CAS_LICENCIA l WHERE l.LIC_PDD_ID = p.PDD_ID) AS cantidadLicencias
        FROM CAS_PEDIDO p
        LEFT JOIN CAS_USUARIO_ADMIN u ON p.PDD_UAD_ID = u.UAD_ID
        ORDER BY p.PDD_ID DESC`,
        [],
        (error, rows) => {
            if (error) {
                console.error('Error al obtener pedidos completos:', error);
                return res.status(500).json({
                    success: false,
                    status: 'ERROR',
                    message: 'Error al obtener pedidos'
                });
            }
            res.status(200).json(Array.isArray(rows) ? rows : []);
            // console.log(rows);
        }
    );
};
