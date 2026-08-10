/**
 * Lista todos los paquetes desde CAS_PAQUETE.
 * GET /paquetes -> [{ id, nombre, descripcion, productoIds }, ...]
 * PAQ_PRODUCTOS se devuelve como array (JSON parseado).
 */
exports.getPaquetes = (req, res) => {
    req.db.query(
        'SELECT PAQ_ID AS id, PAQ_NOMBRE AS nombre, PAQ_DESCRIPCION AS descripcion, PAQ_PRODUCTOS FROM CAS_PAQUETE ORDER BY PAQ_ID',
        [],
        (error, rows) => {
            if (error) {
                console.error('Error al obtener paquetes:', error);
                return res.status(500).json({
                    success: false,
                    status: 'ERROR',
                    message: 'Error al obtener paquetes'
                });
            }
            const list = Array.isArray(rows) ? rows : [];
            const paquetes = list.map(row => {
                let productoIds = [];
                if (row.PAQ_PRODUCTOS) {
                    try {
                        const parsed = JSON.parse(row.PAQ_PRODUCTOS);
                        productoIds = Array.isArray(parsed) ? parsed : [];
                    } catch (_) {
                        productoIds = [];
                    }
                }
                return {
                    id: row.id,
                    nombre: row.nombre,
                    descripcion: row.descripcion,
                    productoIds
                };
            });
            res.status(200).json(paquetes);
        }
    );
};
