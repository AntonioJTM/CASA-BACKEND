exports.allMultimedia = (req, res) => {
    try {
        const { subtipo, grado } = req.body;

        const query = 'CALL mostrarMultimedia(?,?)';

        req.db.query(query, [subtipo, grado], (error, results) => {
            if (error) {
                console.error('Error en la consulta de mostrarMultimedia:', error);
                return res.status(500).json({
                    error: 'Error al obtener la multimedia',
                    details: error.message
                });
            }
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Error en la ruta de mostrarMultimedia:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

exports.allGradosSubtipo = (req, res) => {
    try {
        const { subtipo } = req.body;

        const query = 'CALL mostrarGradosSubtipos(?)';

        req.db.query(query, [subtipo], (error, results) => {
            if (error) {
                console.error('Error en la consulta de mostrarGradosSubtipos:', error);
                return res.status(500).json({
                    error: 'Error al obtener los grados',
                    details: error.message
                });
            }
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Error en la ruta de allGradosSubtipo:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};


exports.allMultimediaSubtipo = (req, res) => {
    try {
        const { subtipo } = req.body;

        const query = 'CALL mostrarMultimediaPorSubtipo(?)';

        req.db.query(query, [subtipo], (error, results) => {
            if (error) {
                console.error('Error en la consulta de mostrarMultimediaPorSubtipo:', error);
                return res.status(500).json({
                    error: 'Error al obtener los grados',
                    details: error.message
                });
            }
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Error en la ruta de allMultimediaSubtipo:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

/**
 * Materias de un semestre.
 *
 * Antes era CALL mostrarMaterias(?). La consulta vive aquí porque una materia
 * puede impartirse en varios semestres y esa relación está en
 * CAS_GRADO_MATERIA, no en MAT_GRA_ID. Las columnas devueltas son las mismas
 * que traía el SELECT * del procedimiento; MAT_GRA_ID es el semestre pedido.
 */
exports.allMaterias = (req, res) => {
    try {
        const { grado } = req.body;

        const query = `
            SELECT DISTINCT
                m.MAT_ID,
                m.MAT_NOMBRE,
                m.MAT_DESCRIPCION,
                m.MAT_PORTADA,
                ? AS MAT_GRA_ID,
                m.MAT_SUB_ID,
                m.MAT_STATUS
            FROM CAS_MATERIA m
            INNER JOIN CAS_GRADO_MATERIA gm ON gm.GMA_MAT_ID = m.MAT_ID
            WHERE gm.GMA_GRA_ID = ?
            ORDER BY m.MAT_NOMBRE`;

        req.db.query(query, [grado, grado], (error, results) => {
            if (error) {
                console.error('Error en la consulta de materias por grado:', error);
                return res.status(500).json({
                    error: 'Error al obtener las materias',
                    details: error.message
                });
            }
            res.json(results);
        });
    } catch (error) {
        console.error('Error en la ruta de allMaterias:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

exports.allArItems = (req, res) => {
    try {
        const query = 'CALL mostrarArItems()';

        req.db.query(query, (error, results) => {
            if (error) {
                console.error('Error en la consulta de mostrarArItems:', error);
                return res.status(500).json({
                    error: 'Error al obtener los ítems de AR',
                    details: error.message
                });
            }
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Error en la ruta de mostrarMaterias:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

exports.allMultimediaPorMaterias = (req, res) => {
    try {
        const { subtipo, materiaId } = req.body;

        const query = 'CALL mostrarMultimediaPorMaterias(?,?)';

        req.db.query(query, [subtipo, materiaId], (error, results) => {
            if (error) {
                console.error('Error en la consulta de mostrarMultimediaPorMaterias:', error);
                return res.status(500).json({
                    error: 'Error al obtener la multimedia',
                    details: error.message
                });
            }
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Error en la ruta de allMultimediaPorMaterias:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

exports.allPorTipoMultimedia = (req, res) => {
    try {
        const { subtipo, materiaId, tipoMulti } = req.body;

        const query = 'CALL mostrarPorTipoMultimedia(?,?,?)';

        req.db.query(query, [subtipo, materiaId, tipoMulti], (error, results) => {
            if (error) {
                console.error('Error en la consulta de mostrarPorTipoMultimedia:', error);
                return res.status(500).json({
                    error: 'Error al obtener la multimedia',
                    details: error.message
                });
            }
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Error en la ruta de allPorTipoMultimedia:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};


exports.allGradosPorLicencia = (req, res) => {
    try {
        const { licenciaId } = req.body;

        const query = 'CALL mostrarGradosPorLicencia(?)';

        req.db.query(query, [licenciaId], (error, results) => {
            if (error) {
                console.error('Error en la consulta de mostrarGradosPorLicencia:', error);
                return res.status(500).json({
                    error: 'Error al obtener la multimedia',
                    details: error.message
                });
            }
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Error en la ruta de allGradosPorLicencia:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

/**
 * Materias de un semestre que cubre el paquete de una licencia.
 *
 * Antes era CALL mostrarMateriasPorLicenciaGrado(?,?). Igual que allMaterias,
 * el semestre se resuelve por CAS_GRADO_MATERIA. Los JOINs de licencia, paquete
 * y producto y las columnas devueltas son los mismos que traía el procedimiento.
 */
exports.allMateriasPorLicenciaGrado = (req, res) => {
    try {
        const { licenciaId, gradoId } = req.body;

        const query = `
            SELECT DISTINCT
                m.MAT_ID,
                m.MAT_NOMBRE,
                m.MAT_DESCRIPCION,
                ? AS MAT_GRA_ID,
                m.MAT_STATUS
            FROM CAS_LICENCIA l
            INNER JOIN CAS_PAQUETE pq
                ON pq.PAQ_ID = l.LIC_PAQ_ID
            INNER JOIN CAS_PRODUCTOS pr
                ON FIND_IN_SET(
                     pr.PRO_ID,
                     REPLACE(REPLACE(REPLACE(pq.PAQ_PRODUCTOS, '[', ''), ']', ''), ' ', '')
                   ) > 0
            INNER JOIN CAS_MATERIA m
                ON m.MAT_ID = pr.PRO_MAT_ID
            INNER JOIN CAS_GRADO_MATERIA gm
                ON gm.GMA_MAT_ID = m.MAT_ID
               AND gm.GMA_GRA_ID = ?
            WHERE l.LIC_ID = ?
            ORDER BY m.MAT_NOMBRE`;

        req.db.query(query, [gradoId, gradoId, licenciaId], (error, results) => {
            if (error) {
                console.error('Error en la consulta de materias por licencia y grado:', error);
                return res.status(500).json({
                    error: 'Error al obtener las materias',
                    details: error.message
                });
            }
            res.json(results);
        });
    } catch (error) {
        console.error('Error en la ruta de allMateriasPorLicenciaGrado:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};