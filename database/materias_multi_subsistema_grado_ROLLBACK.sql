-- =============================================================================
-- Deshacer materias_multi_subsistema_grado.sql
--
-- No hay procedimientos que restaurar: el cambio no tocó ninguno. mostrarMaterias
-- y mostrarMateriasPorLicenciaGrado siguen exactamente como estaban; lo único
-- que pasó es que el código dejó de llamarlos.
--
-- MAT_GRA_ID y MAT_SUB_ID nunca se vaciaron, así que cada materia conserva su
-- semestre y subsistema originales: revertir el código basta para volver atrás.
-- Lo de abajo solo hace falta si además quieres limpiar los datos.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Semestres que el backfill agregó a CAS_GRADO_MATERIA
--
-- GMA_ID > 2 conserva las 2 filas que ya existían antes del cambio
-- (materia 1 en 2° y 3° de BGT). Verifica el corte antes de ejecutar:
-- -----------------------------------------------------------------------------

-- SELECT * FROM CAS_GRADO_MATERIA ORDER BY GMA_ID;
-- DELETE FROM CAS_GRADO_MATERIA WHERE GMA_ID > 2;


-- -----------------------------------------------------------------------------
-- 2. Semestres creados desde el botón "Crear semestres" del panel
--
-- Sustituye 3 por el SUB_ID del subsistema en cuestión. Solo si ninguna materia,
-- producto o multimedia los usa: la consulta debe dar 0 en las tres columnas.
-- -----------------------------------------------------------------------------

-- SELECT (SELECT COUNT(*) FROM CAS_GRADO_MATERIA gm JOIN CAS_GRADO g ON g.GRA_ID = gm.GMA_GRA_ID WHERE g.GRA_SUB_ID = 3) AS en_materias,
--        (SELECT COUNT(*) FROM CAS_PRODUCTOS p   JOIN CAS_GRADO g ON g.GRA_ID = p.PRO_GRA_ID   WHERE g.GRA_SUB_ID = 3) AS en_productos,
--        (SELECT COUNT(*) FROM CAS_MULTIMEDIA mu JOIN CAS_GRADO g ON g.GRA_ID = mu.MUL_GRA_ID  WHERE g.GRA_SUB_ID = 3) AS en_multimedia;

-- DELETE FROM CAS_GRADO WHERE GRA_SUB_ID = 3;
