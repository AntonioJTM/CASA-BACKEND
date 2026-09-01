exports.getGradosFilter = async (req, res) => {
    try {
        // ?subsistema=1 acota los periodos a los de ese subsistema (GRA_SUB_ID).
        const sub = parseInt(req.query.subsistema, 10);
        const filtra = Number.isInteger(sub) && sub > 0;
        // SUB_NOMBRE viaja con cada semestre: ahora que todos los subsistemas
        // tienen su 1° a 6°, sin él las listas mostrarían "1 Semestre" repetido.
        const base = `
            SELECT g.*, s.SUB_NOMBRE
              FROM CAS_GRADO g
              LEFT JOIN CAS_SUBSISTEMA s ON s.SUB_ID = g.GRA_SUB_ID`;
        const sql = filtra
            ? `${base} WHERE g.GRA_SUB_ID = ? ORDER BY g.GRA_NUMERO`
            : `${base} ORDER BY s.SUB_NOMBRE, g.GRA_NUMERO`;

        req.db.query(sql, filtra ? [sub] : [],
            (error, results) => {
                if (error) {
                    console.error('Error en la consulta:', error);
                    return res.status(500).json({ error: 'Error en la base de datos' });
                }
                res.json(results);
            }
        );
    } catch (error) {
        console.error('Error en getGradosFilter:', error);
        res.status(500).json({
            error: 'Error al obtener getGradosFilter',
            detalle: error.message
        });
    }
};

exports.getSubtipoFilter = async (req, res) => {
    try {
        req.db.query('SELECT * FROM CAS_SUBTIPOS',
            (error, results) => {
                if (error) {
                    console.error('Error en la consulta:', error);
                    return res.status(500).json({ error: 'Error en la base de datos' });
                }
                res.json(results);
            }
        );

    } catch (error) {
        console.error('Error en getSubtipoFilter:', error);
        res.status(500).json({
            error: 'Error al obtener getSubtipoFilter',
            detalle: error.message
        });
    }
};

exports.getMateriasFilter = async (req, res) => {
    try {
        const grado = req.query.grado;
        const gradoId = parseInt(grado, 10);

        if (!Number.isInteger(gradoId) || gradoId < 1) {
            return res.status(400).json({
                error: 'Query "grado" es requerida',
                detalle: 'Debes enviar un número en el query parameter ?grado=1'
            });
        }

        // Una materia puede estar en varios semestres: la relación vive en
        // CAS_GRADO_MATERIA, no en MAT_GRA_ID. Se devuelve el semestre pedido
        // como MAT_GRA_ID para no cambiar la forma de la respuesta.
        const sql = `
            SELECT DISTINCT
                m.MAT_ID,
                m.MAT_NOMBRE,
                ? AS MAT_GRA_ID,
                m.MAT_STATUS
            FROM CAS_MATERIA m
            INNER JOIN CAS_GRADO_MATERIA gm ON gm.GMA_MAT_ID = m.MAT_ID
            WHERE gm.GMA_GRA_ID = ?
            ORDER BY m.MAT_NOMBRE;
        `;

        req.db.query(sql, [gradoId, gradoId], (error, results) => {
            if (error) {
                console.error('Error en getMateriasFilter:', error);
                return res.status(500).json({
                    error: 'Error en la base de datos',
                    detalle: error.message
                });
            }
            res.json(results);
        });
    } catch (error) {
        console.error('Error al obtener getMateriasFilter:', error);
        res.status(500).json({
            error: 'Error al obtener getMateriasFilter',
            detalle: error.message
        });
    }
};
exports.getSubsistemasFilter = async (req, res) => {
    try {
        req.db.query(
            'SELECT SUB_ID, SUB_NOMBRE, SUB_PERIODO, SUB_ESTADO, SUB_STATUS FROM CAS_SUBSISTEMA ORDER BY SUB_NOMBRE',
            (error, results) => {
                if (error) {
                    console.error('Error en getSubsistemasFilter:', error);
                    return res.status(500).json({ error: 'Error en la base de datos' });
                }
                res.json(results);
            }
        );
    } catch (error) {
        console.error('Error al obtener getSubsistemasFilter:', error);
        res.status(500).json({
            error: 'Error al obtener getSubsistemasFilter',
            detalle: error.message
        });
    }
};
