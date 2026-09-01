-- =============================================================================
-- Materias en varios subsistemas y varios semestres.
--
-- Antes: CAS_MATERIA.MAT_GRA_ID (un semestre) y MAT_SUB_ID (un subsistema).
-- Ahora: CAS_GRADO_MATERIA, que ya existía y no se usaba.
--
-- No hace falta tabla puente para el subsistema: cada fila de CAS_GRADO lleva
-- GRA_SUB_ID, así que un grado ES "semestre N del subsistema X". Apuntar a él
-- desde CAS_GRADO_MATERIA guarda las dos cosas de una vez.
--
-- ESTE SCRIPT NO CREA NI ALTERA TABLAS, Y NO TOCA NINGÚN PROCEDIMIENTO.
-- Es un único backfill de datos. Las consultas que antes vivían en
-- mostrarMaterias y mostrarMateriasPorLicenciaGrado se movieron al código
-- (controllers/casa-web/multimedia.controller.js), así que esos dos
-- procedimientos quedan intactos y sin uso.
--
-- Los semestres de un subsistema que no los tenga se dan de alta desde el panel
-- ("Crear semestres" en el formulario de materias), no desde aquí.
--
-- Ejecutar una vez.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Migrar las materias existentes a CAS_GRADO_MATERIA
--
-- El LEFT JOIN evita repetir las filas que la tabla ya traía cargadas a mano.
-- Es idempotente: volver a ejecutarlo inserta 0 filas.
-- -----------------------------------------------------------------------------

INSERT INTO CAS_GRADO_MATERIA (GMA_MAT_ID, GMA_GRA_ID)
SELECT m.MAT_ID, m.MAT_GRA_ID
  FROM CAS_MATERIA m
  LEFT JOIN CAS_GRADO_MATERIA gm
    ON gm.GMA_MAT_ID = m.MAT_ID
   AND gm.GMA_GRA_ID = m.MAT_GRA_ID
 WHERE m.MAT_GRA_ID IS NOT NULL
   AND gm.GMA_ID IS NULL;


-- -----------------------------------------------------------------------------
-- MAT_GRA_ID y MAT_SUB_ID
--
-- Dejan de mandar: la verdad está en CAS_GRADO_MATERIA. El backend las sigue
-- escribiendo con el primer semestre marcado y su subsistema, para que nada que
-- todavía las lea se quede sin valor. No se vacían ni se eliminan.
-- -----------------------------------------------------------------------------


-- =============================================================================
-- Verificación
-- =============================================================================
-- SELECT m.MAT_ID, m.MAT_NOMBRE,
--        GROUP_CONCAT(DISTINCT CONCAT(s.SUB_NOMBRE,' ',g.GRA_NUMERO,'°')
--                     ORDER BY s.SUB_NOMBRE, g.GRA_NUMERO SEPARATOR ', ') AS imparte
--   FROM CAS_MATERIA m
--   LEFT JOIN CAS_GRADO_MATERIA gm ON gm.GMA_MAT_ID = m.MAT_ID
--   LEFT JOIN CAS_GRADO g          ON g.GRA_ID = gm.GMA_GRA_ID
--   LEFT JOIN CAS_SUBSISTEMA s     ON s.SUB_ID = g.GRA_SUB_ID
--  GROUP BY m.MAT_ID, m.MAT_NOMBRE
--  ORDER BY m.MAT_NOMBRE;
