/** El dashboard de ventas solo contempla licencias individuales */
const TIPO_LICENCIA = 'INDIVIDUAL';

const sqlDistribucion = `
    SELECT
        CASE LIC_STATUS
            WHEN 1 THEN 'Activa'
            WHEN 2 THEN 'Desactivada'
            WHEN 3 THEN 'Vencida'
            ELSE 'Otro'
        END AS status,
        COUNT(*) AS count
    FROM CAS_LICENCIA
    WHERE LIC_TIPO = ?
    GROUP BY LIC_STATUS
`;

/**
 * Obtiene distribución (porEstado, total) para emisión Socket.IO.
 * Útil para actualización en tiempo real del dashboard.
 */
exports.fetchDistribucion = (db, callback) => {
    db.query(sqlDistribucion, [TIPO_LICENCIA], (err, rows) => {
        if (err) return callback(err, null);
        const porEstado = rows || [];
        const total = porEstado.reduce((sum, row) => sum + (row.count || 0), 0);
        callback(null, { porEstado, total });
    });
};

/**
 * Dashboard: distribución de licencias por estado.
 * GET /licencias-distribucion
 * Respuesta: { porEstado: [{ status, count }], total }
 * LIC_STATUS: 1=Activa, 2=Desactivada, 3=Vencida
 */
exports.getLicenciasDistribucion = (req, res) => {
    req.db.query(sqlDistribucion, [TIPO_LICENCIA], (err, rows) => {
        if (err) {
            console.error('Error getLicenciasDistribucion:', err);
            return res.status(500).json({
                success: false,
                status: 'ERROR',
                message: 'Error al obtener distribución de licencias'
            });
        }
        const porEstado = rows || [];
        const total = porEstado.reduce((sum, row) => sum + (row.count || 0), 0);
        res.status(200).json({ porEstado, total });
    });
};
