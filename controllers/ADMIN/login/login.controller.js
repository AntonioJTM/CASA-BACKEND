const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;


        if (!username || !password) {
            return res.status(400).json({
                success: false,
                status: 'BAD_REQUEST',
                message: "Username y password son requeridos"
            });
        }

        req.db.query(
            'CALL LOGIN_USUARIO_ADMIN(?, ?)',
            [username, password],
            (error, results) => {
                if (error) {
                    console.error("Error en la consulta:", error);
                    return res.status(500).json({
                        success: false,
                        status: 'ERROR',
                        message: "Error en el servidor"
                    });
                }

                const rows = Array.isArray(results[0]) ? results[0] : results;
                if (!rows || rows.length === 0) {
                    return res.status(401).json({
                        success: false,
                        status: 'NOT_FOUND',
                        message: "Usuario inactivo o credenciales inválidas"
                    });
                }

                const userData = rows[0];
                const usernameFromDb = userData.UAD_NOMBRE;
                const userType = userData.UAD_TIPO;
                const id_usuario = userData.UAD_ID;

                const JWT_SECRET = process.env.JWT_SECRET || 'tu-secret-key-cambiar-en-produccion';
                const token = jwt.sign(
                    {
                        userId: userData.UAD_ID,
                        username: usernameFromDb,
                        userType: userType
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                // Formatear último acceso para el front (ISO o null)
                let lastAccess = null;
                if (userData.UAD_ULTIMO_ACCESO) {
                    lastAccess = new Date(userData.UAD_ULTIMO_ACCESO).toISOString();
                }

                res.status(200).json({
                    token: token,
                    username: usernameFromDb,
                    userType: userType,
                    lastAccess: lastAccess,
                    id_usuario: id_usuario
                });
            }
        );
    } catch (error) {
        console.error("Error en el servidor:", error);
        res.status(500).json({
            success: false,
            status: 'ERROR',
            message: "Error en el servidor"
        });
    }
};