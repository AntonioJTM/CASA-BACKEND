/**
 * Alta de los semestres de un subsistema.
 *
 * Cada fila de CAS_GRADO es "semestre N del subsistema X", así que un
 * subsistema nuevo nace sin semestres y no se le puede asignar ninguna materia
 * hasta que se le carguen. Este endpoint los crea desde el panel, sin tocar la
 * base a mano.
 */

/** Semestres que se dan de alta: 1 a 6. */
const SEMESTRES = [1, 2, 3, 4, 5, 6];

/** Nombre con el que se guardan, igual que los que ya existían. */
const NOMBRE_SEMESTRE = 'Semestre';

/** Lista de semestres de un subsistema, ya ordenada. */
function listarSemestres(db, subId, callback) {
    db.query(
        `SELECT g.*, s.SUB_NOMBRE
           FROM CAS_GRADO g
           LEFT JOIN CAS_SUBSISTEMA s ON s.SUB_ID = g.GRA_SUB_ID
          WHERE g.GRA_SUB_ID = ?
          ORDER BY g.GRA_NUMERO`,
        [subId],
        callback
    );
}

/**
 * POST /casa/admin/subsistemas/:id/semestres
 *
 * Crea los semestres que le falten al subsistema. Es idempotente: si ya los
 * tiene todos no inserta nada y responde con la lista tal cual.
 */
exports.crearSemestres = (req, res) => {
    const subId = parseInt(req.params.id, 10);

    if (!Number.isInteger(subId) || subId <= 0) {
        return res.status(400).json({ error: 'ID de subsistema inválido' });
    }

    req.db.query(
        'SELECT SUB_ID, SUB_NOMBRE FROM CAS_SUBSISTEMA WHERE SUB_ID = ?',
        [subId],
        (errSub, filasSub) => {
            if (errSub) {
                console.error('Error al validar el subsistema:', errSub);
                return res.status(500).json({ error: 'Error al validar el subsistema' });
            }
            if (!filasSub || filasSub.length === 0) {
                return res.status(404).json({ error: 'El subsistema no existe' });
            }

            const subNombre = filasSub[0].SUB_NOMBRE;

            // Se insertan solo los que faltan: el LEFT JOIN descarta los que el
            // subsistema ya tenga, así que repetir la llamada no duplica nada.
            const numeros = SEMESTRES.map(() => 'SELECT ? AS numero').join(' UNION ALL ');
            const sql = `
                INSERT INTO CAS_GRADO (GRA_NUMERO, GRA_NOMBRE, GRA_SUB_ID, GRA_STATUS)
                SELECT n.numero, ?, ?, 1
                  FROM (${numeros}) n
                  LEFT JOIN CAS_GRADO g
                    ON g.GRA_SUB_ID = ?
                   AND g.GRA_NUMERO = n.numero
                 WHERE g.GRA_ID IS NULL`;
            const params = [NOMBRE_SEMESTRE, subId, ...SEMESTRES, subId];

            req.db.query(sql, params, (errInsert, resultado) => {
                if (errInsert) {
                    console.error('Error al crear los semestres:', errInsert);
                    return res.status(500).json({ error: 'Error al crear los semestres' });
                }

                const creados = resultado ? resultado.affectedRows : 0;

                listarSemestres(req.db, subId, (errLista, semestres) => {
                    if (errLista) {
                        console.error('Error al leer los semestres creados:', errLista);
                        return res.status(500).json({ error: 'Los semestres se crearon pero no se pudieron leer' });
                    }

                    // El panel del administrador refresca sus listas de semestre
                    // con este evento; sin él habría que recargar la página.
                    if (req.io) {
                        req.io.to('global-room').emit('grados-actualizados', {
                            subId,
                            subNombre,
                            creados,
                            semestres: semestres || [],
                        });
                    }

                    res.status(creados > 0 ? 201 : 200).json({
                        ok: true,
                        subId,
                        subNombre,
                        creados,
                        semestres: semestres || [],
                    });
                });
            });
        }
    );
};
