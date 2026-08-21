-- =============================================================================
-- Subsistema de la materia.
-- La materia guarda directamente a qué subsistema pertenece (CAS_SUBSISTEMA.SUB_ID).
-- Los semestres (CAS_GRADO) siguen siendo comunes a todos los subsistemas.
-- Ejecutar una vez en la base de datos.
-- =============================================================================

ALTER TABLE CAS_MATERIA
  ADD COLUMN MAT_SUB_ID INT(11) NULL DEFAULT NULL AFTER MAT_GRA_ID;

ALTER TABLE CAS_MATERIA
  ADD INDEX IDX_MATERIA_SUBSISTEMA (MAT_SUB_ID);

-- Materias anteriores al cambio: se les asigna el subsistema de su semestre.
UPDATE CAS_MATERIA m
  JOIN CAS_GRADO g ON m.MAT_GRA_ID = g.GRA_ID
   SET m.MAT_SUB_ID = g.GRA_SUB_ID
 WHERE m.MAT_SUB_ID IS NULL;

-- Para revertir:
-- ALTER TABLE CAS_MATERIA DROP INDEX IDX_MATERIA_SUBSISTEMA;
-- ALTER TABLE CAS_MATERIA DROP COLUMN MAT_SUB_ID;
