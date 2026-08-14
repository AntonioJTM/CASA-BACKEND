const nodemailer = require('nodemailer');

//********* PRUEBAS LOCALES ************ */
// const transporter = nodemailer.createTransport({
//     host: 'smtp.gmail.com',
//     port: 587,
//     secure: false,
//     auth: {
//         user: 'alexiselcazu@gmail.com',
//         pass: 'dumb rzgp edhs jbod'
//     }
// });

//********* PROUDUCCION ************ */
const transporter = nodemailer.createTransport({
    host: 'mail.metabooks.com.mx', 
    port: 465,
    secure: true, 
    auth: {
        user: 'contacto@metabooks.com.mx',
        pass: 'DyLPcBnbrzFct8jF'
    }
});

//************** PALABRAS PROHBIDAS PARA EL USUARIO ********************** */
const PALABRAS_PROHIBIDAS = new Set([
    'PENE',
    'PUTA',
    'PUTO',
    'CACA',
    'FETO',
    'TETA',
    'PITO',
    'COLO',
    'COÑO',
    'CULO',
    'JODA',
    'MEOX',
    'ORTO',
    'PEDO',
    'PICH',
    'RAJA',
    'PICO',
    'PELO',
    'MEAR',
    'GATO',
    'LORA',
    'KAKA',
    'PUT4',
    'VACA',
    'VAKA',
]);



/**
 * Valida una licencia por tipo.
 *
 * `tipo` acepta uno o varios valores separados por coma. Hace falta porque las
 * licencias que antes se generaban como 'GENERICA' ahora se llaman
 * 'PRESENTACIONES': las emitidas antes del cambio deben seguir validando.
 *
 * Replica lo que hace sp_existe_licencia (misma forma de respuesta: RESPONSE y
 * LIC_ID en una sola fila), pero comparando contra varios tipos.
 */
exports.existLicence = (req, res) => {
    try {
        const { tipo, licencia } = req.body;

        const tipos = String(tipo ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t !== '');

        if (tipos.length === 0 || !licencia) {
            return res.json([{ RESPONSE: 'NO', LIC_ID: null }]);
        }

        const query = `
            SELECT
                CASE WHEN COUNT(*) > 0 THEN 'SI' ELSE 'NO' END AS RESPONSE,
                MAX(LIC_ID) AS LIC_ID
            FROM CAS_LICENCIA
            WHERE LIC_LICENCIA = ?
              AND LIC_TIPO IN (${tipos.map(() => '?').join(',')})
              AND LIC_STATUS = 1`;

        req.db.query(query, [licencia, ...tipos], (error, results) => {
            if (error) {
                console.error('Error en la consulta de existe Licencia:', error);
                return res.status(500).json({
                    error: 'Error al obtener la respuesta',
                    details: error.message
                });
            }
            res.json(Array.isArray(results) ? results : []);
        });
    } catch (error) {
        console.error('Error en la ruta de existLicence:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { usuario, password } = req.body;

        const query = 'CALL sp_login_usuario(?, ?)';

        req.db.query(query, [usuario, password], (error, results) => {

            if (error) {
                console.error(error);
                return res.status(500).json({
                    response: 'ERROR',
                    code: 'ERROR_DB'
                });
            }

            const data = results[0][0];

            if (!data || data.RESPONSE !== 'OK') {
                return res.status(200).json({
                    response: 'ERROR',
                    code: 'CREDENCIALES_INVALIDAS'
                });
            }

            return res.status(200).json({
                response: 'OK',
                code: 'LOGIN_OK',
                userId: data.USU_ID,
                usuario: data.USU_USUARIO,
                nombre: data.USU_NOMBRE
            });

        });

    } catch (error) {
        console.error('Error loginUser:', error);
        res.status(500).json({
            response: 'ERROR',
            code: 'ERROR_SERVIDOR'
        });
    }
};

exports.recuperarPass = async (req, res) => {
    const { correo, nombre, usuario, password } = req.body;

    try {

        await enviarCorreoRecuperarCuenta({
            correo,
            nombre,
            usuario,
            password
        });

        // RESPUESTA DE ÉXITO
        return res.status(200).json({
            ok: true,
            message: 'Correo enviado correctamente'
        });

    } catch (err) {

        console.error('⚠️ Error enviando correo:', err.message);

        //RESPUESTA DE ERROR
        return res.status(500).json({
            ok: false,
            message: 'Error al enviar el correo'
        });
    }
};


exports.validarCorreo = (req, res) => {
    try {
        const { correo } = req.body;

        const query = 'CALL sp_existe_correo_usuario(?)';

        req.db.query(query, [correo], (error, results) => {
            if (error) {
                console.error('Error en la consulta de sp_existe_correo_usuario:', error);
                return res.status(500).json({
                    error: 'Error al obtener la respuesta',
                    details: error.message
                });
            }
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Error en la ruta de validarCorreo:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

exports.getLicenceUser = (req, res) => {
    try {
        const { usuarioId } = req.body;

        const query = 'CALL mostrarLicenciasUsuario(?)';

        req.db.query(query, [usuarioId], (error, results) => {
            if (error) {
                console.error('Error en la consulta de de mostrarLicenciasUsuario:', error);
                return res.status(500).json({
                    error: 'Error al obtener la respuesta',
                    details: error.message
                });
            }
            res.json(results[0]);
        });
    } catch (error) {
        console.error('Error en la ruta de getLicenceUser:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

exports.insertProducts = async (req, res) => {
    try {
        const { usuarioId, licenciaId } = req.body;

        const query = 'CALL agregarProductos(?,?)';

        req.db.query(query, [usuarioId, licenciaId], (error, results) => {

            if (error) {
                return res.status(500).json({
                    response: 'ERROR',
                    code: 'ERROR_DB'
                });
            }

            const spData = results[0][0];
            const spResponse = spData?.RESPONSE;

            if (spResponse === 'OK') {
                return res.status(200).json({
                    response: 'OK',
                    message: 'Producto agregado correctamente'
                });
            }

            if (spResponse === 'EXISTE') {
                return res.status(200).json({
                    response: 'EXISTE',
                    message: 'El usuario ya tiene esta licencia'
                });
            }

            return res.status(400).json({
                response: 'ERROR',
                message: 'No se pudo agregar el producto'
            });


        });

    } catch (error) {
        console.error('Error insertProducts:', error);
        res.status(500).json({
            response: 'ERROR',
            code: 'ERROR_SERVIDOR',
            message: error.message
        });
    }
};



exports.insertUser = async (req, res) => {
    try {
        const {
            nombre,
            apellidop,
            apellidom,
            correo,
            telefono,
            password,
            fecha,
            licenciaId
        } = req.body;

        // Generar usuario único
        const usuario = await generarUsuarioUnico(
            req.db,
            nombre,
            apellidop,
            apellidom
        );

        const query = 'CALL insertarUsuario(?,?,?,?,?,?,?,?,?)';

        req.db.query(query, [
            nombre,
            apellidop,
            apellidom,
            correo,
            usuario,
            telefono,
            password,
            fecha,
            licenciaId
        ], async (error, results) => {

            if (error) {
                return res.status(500).json({
                    response: 'ERROR',
                    code: 'ERROR_DB'
                });
            }

            const spData = results[0][0];

            const spResponse = spData?.RESPONSE;
            const userId = spData?.USER_ID;

            // CORREO YA EXISTE
            if (spResponse === 'CORREO_EXISTE') {
                return res.status(200).json({
                    response: 'ERROR',
                    code: 'CORREO_EXISTE'
                });
            }

            // CUALQUIER OTRO ERROR
            if (spResponse !== 'OK') {
                return res.status(200).json({
                    response: 'ERROR',
                    code: spResponse
                });
            }

            //  USUARIO CREADO
            let correoEnviado = true;

            try {
                await enviarCorreoBienvenida({
                    correo,
                    nombre,
                    usuario,
                    password
                });
            } catch (err) {
                correoEnviado = false;
                console.error('⚠️ Error enviando correo:', err.message);
            }

            return res.status(200).json({
                response: 'OK',
                code: 'USUARIO_CREADO',
                userId: userId,
                usuarioGenerado: usuario,
                usuarioNombre: nombre,
                correoEnviado
            });
        });


    } catch (error) {
        console.error('Error insertUser:', error);
        res.status(500).json({
            response: 'ERROR',
            code: 'ERROR_SERVIDOR',
            message: error.message
        });
    }
};


async function generarUsuarioUnico(db, nombre, apellidop, apellidom) {
    const base = generarUsuarioBase(nombre, apellidop, apellidom);

    let usuario;
    let existe = true;
    let intentos = 0;

    while (existe && intentos < 10) {
        const random = generarRandomAlfanumerico(4);
        usuario = base + random;
        existe = await usuarioExiste(db, usuario);
        intentos++;
    }

    if (existe) {
        throw new Error('No se pudo generar un usuario único');
    }

    return usuario;
}



function generarRandomAlfanumerico(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generarUsuarioBase(nombre, apellidop, apellidom) {
    nombre = nombre.toUpperCase().trim();
    apellidop = apellidop.toUpperCase().trim();
    apellidom = apellidom.toUpperCase().trim();

    const maxIntentos = nombre.length; // límite basado en nombre
    let intento = 0;

    while (intento < maxIntentos) {

        let usuarioBase;

        if (intento === 0) {
            // Caso original
            usuarioBase =
                nombre.substring(0, 2) +
                apellidop.substring(0, 1) +
                apellidom.substring(0, 1);
        } else {
            const indiceNombre = intento + 1; // 3ra, 4ta, etc
            const indiceApellido = intento;   // 2da, 3ra, etc

            if (
                indiceNombre >= nombre.length ||
                indiceApellido >= apellidop.length ||
                indiceApellido >= apellidom.length
            ) {
                break;
            }

            usuarioBase =
                nombre.substring(0, 1) +
                nombre.charAt(indiceNombre) +
                apellidop.charAt(indiceApellido) +
                apellidom.charAt(indiceApellido);
        }

        if (!esPalabraProhibida(usuarioBase)) {
            return usuarioBase;
        }

        intento++;
    }

    // Si se agotaron letras → generar aleatorio seguro
    let randomBase;
    do {
        randomBase = generarRandomSoloLetras(4);
    } while (esPalabraProhibida(randomBase));

    return randomBase;
}

function generarRandomSoloLetras(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}


function usuarioExiste(db, usuario) {
    return new Promise((resolve, reject) => {
        const query = 'CALL sp_existe_usuario(?)';
        db.query(query, [usuario], (error, results) => {
            if (error) return reject(error);
            resolve(results[0].total > 0);
        });
    });
}

function esPalabraProhibida(texto) {
    return PALABRAS_PROHIBIDAS.has(texto.toUpperCase());
}



async function enviarCorreoBienvenida({ correo, nombre, usuario, password }) {

    const html = `
  <table width="100%" cellpadding="0" cellspacing="0"
    style="background-color:#E6E8F4; padding:40px 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;;">

    <tr>
        <td align="center">

            <table width="600" cellpadding="0" cellspacing="0"
                style="background: linear-gradient(180deg, #3F41C4 0%, #000B2D 60%); border-radius:20px; overflow:hidden;">
                <tr>
                    <td align="center" style="padding:50px 80px 10px 80px;">
                        <p style="color:#FFFFFF; font-size:40px; font-weight: bold;">
                            Bienvenido a
                        </p>
                    </td>
                </tr>
                <!-- HEADER CON IMAGEN -->
                <tr>
                    <td align="center">
                        <img src="https://casa.metabooks.com.mx/multimedia/img-correo.png" width="600"
                            style="display:block; max-width:100%;">
                    </td>
                </tr>

                <!-- SALUDO -->
                <tr>
                    <td align="center" style="padding:0px 30px 10px 30px;">
                        <h1 style="color:#ffffff; margin:0; font-size:50px; background: linear-gradient(90deg, #ffffff, #5590FE);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    display: inline-block;
    background-size: 100% 100%;">
                            ¡Hola ${nombre}!
                        </h1>
                    </td> 
                </tr>

                <tr>
                    <td align="center" style="padding:0 80px 30px 80px;">
                        <p style="color:#cfd8ff; font-size:20px;">
                            Tu cuenta ha sido creada correctamente.
                        </p>
                    </td>
                </tr>

                <!-- DIVISOR -->
                <tr>
                    <td style="padding:0 40px;">
                        <hr style="border:none; border-top:1px solid #FFFFFF;">
                    </td>
                </tr>

                <!-- DATOS -->
                <tr>
                    <td align="center" style="padding:30px 40px;">
                        <p style="color:#5691FF; font-weight:bold; margin-bottom:15px; font-size: 20px;">
                            Datos de acceso:
                        </p>

                        <p style="color:#ffffff; margin:5px 0; font-size: 20px;">
                            Usuario: <strong>${usuario}</strong>
                        </p>

                        <p style="color:#ffffff; margin:5px 0; font-size: 20px;">
                            Contraseña: <strong>${password}</strong>
                        </p>
                    </td>
                </tr>

                <!-- DIVISOR -->
                <tr>
                    <td style="padding:0 40px;">
                        <hr style="border:none; border-top:1px solid #FFFFFF;">
                    </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                    <td align="center" style="padding:30px 50px 30px 50px;">
                        <p style="color:#FFFFFF; font-size:20px;">
                            Te recomendamos guardar tu contraseña.
                        </p>
                    </td>
                </tr>

            </table>

        </td>
    </tr>

</table>
  `;

    await transporter.sendMail({
        from: '"Casa Web" <contacto@metabooks.com.mx>',
        to: correo,
        subject: 'Credenciales de acceso Casa Web',
        html
    });
}



async function enviarCorreoRecuperarCuenta({ correo, nombre, usuario, password }) {
    const html = `
  <table width="100%" cellpadding="0" cellspacing="0"
    style="background-color:#E6E8F4; padding:40px 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;;">

    <tr>
        <td align="center">

            <table width="600" cellpadding="0" cellspacing="0"
                style="background: linear-gradient(180deg, #3F41C4 0%, #000B2D 60%); border-radius:20px; overflow:hidden;">

                <!-- HEADER CON IMAGEN -->
                <tr>
                    <td align="center">
                        <img src="https://casa.metabooks.com.mx/multimedia/img-correo.png" width="600"
                            style="display:block; max-width:100%; margin-top: 70px;">
                    </td>
                </tr>

                <!-- SALUDO -->
                <tr>
                    <td align="center" style="padding:0px 30px 10px 30px;">
                        <h1 style="color:#ffffff; margin:0; font-size:50px; background: linear-gradient(90deg, #ffffff, #5590FE);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    display: inline-block;
    background-size: 100% 100%;">
                            ¡Hola ${nombre}!
                        </h1>
                    </td>
                </tr>

                <tr>
                    <td align="center" style="padding:0 80px 30px 80px;">
                        <p style="color:#cfd8ff; font-size:20px;">
                            Estos son tus datos para ingresar y seguir disfrutando del contenido
                        </p>
                    </td>
                </tr>

                <!-- DIVISOR -->
                <tr>
                    <td style="padding:0 40px;">
                        <hr style="border:none; border-top:1px solid #FFFFFF;">
                    </td>
                </tr>

                <!-- DATOS -->
                <tr>
                    <td align="center" style="padding:30px 40px;">
                        <p style="color:#5691FF; font-weight:bold; margin-bottom:15px; font-size: 20px;">
                            Datos de acceso:
                        </p>

                        <p style="color:#ffffff; margin:5px 0; font-size: 20px;">
                            Usuario: <strong>${usuario}</strong>
                        </p>

                        <p style="color:#ffffff; margin:5px 0; font-size: 20px;">
                            Contraseña: <strong>${password}</strong>
                        </p>
                    </td>
                </tr>

                <!-- DIVISOR -->
                <tr>
                    <td style="padding:0 40px;">
                        <hr style="border:none; border-top:1px solid #FFFFFF;">
                    </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                    <td align="center" style="padding:30px 50px 30px 50px;">
                        <p style="color:#FFFFFF; font-size:20px;">
                            Te recomendamos anotar tus datos de inicio de sesión para que no se te olviden.
                        </p>
                    </td>
                </tr>

            </table>

        </td>
    </tr>

</table>
  `;

    await transporter.sendMail({
        from: '"Casa Web" <contacto@metabooks.com.mx>',
        to: correo,
        subject: 'Recuperar contraseña',
        html
    });
}
