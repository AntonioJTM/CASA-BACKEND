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

exports.allMaterias = (req, res) => {
    try {
        const { grado } = req.body;

        const query = 'CALL mostrarMaterias(?)';

        req.db.query(query, [grado], (error, results) => {
            if (error) {
                console.error('Error en la consulta de mostrarMaterias:', error);
                return res.status(500).json({
                    error: 'Error al obtener las materias',
                    details: error.message
                });
            }
            res.json(results[0]);
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

exports.allMateriasPorLicenciaGrado = (req, res) => {
    try {
        const { licenciaId, gradoId } = req.body;

        const query = 'CALL mostrarMateriasPorLicenciaGrado(?,?)';

        req.db.query(query, [licenciaId, gradoId], (error, results) => {
            if (error) {
                console.error('Error en la consulta de mostrarMateriasPorLicenciaGrado:', error);
                return res.status(500).json({
                    error: 'Error al obtener la multimedia',
                    details: error.message
                });
            }
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Error en la ruta de allMateriasPorLicenciaGrado:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};