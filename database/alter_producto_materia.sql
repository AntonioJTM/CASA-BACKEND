-- =============================================================================
-- Materia del producto.
-- La materia depende del semestre (CAS_MATERIA.MAT_GRA_ID -> CAS_GRADO.GRA_ID),
-- así que PRO_MAT_ID siempre debe ser una materia del semestre en PRO_GRA_ID.
-- NULL = productos antiguos que se cargaron antes de existir este campo.
-- Ejecutar una vez en la base de datos.
-- =============================================================================

ALTER TABLE CAS_PRODUCTOS
  ADD COLUMN PRO_MAT_ID INT(11) NULL DEFAULT NULL AFTER PRO_GRA_ID;

-- Índice para filtrar productos por materia sin escanear la tabla.
ALTER TABLE CAS_PRODUCTOS
  ADD INDEX IDX_PRODUCTOS_MATERIA (PRO_MAT_ID);

-- Para revertir:
-- ALTER TABLE CAS_PRODUCTOS DROP INDEX IDX_PRODUCTOS_MATERIA;
-- ALTER TABLE CAS_PRODUCTOS DROP COLUMN PRO_MAT_ID;
