-- =============================================================================
-- Color de identidad del paquete.
-- Se guarda como hexadecimal '#RRGGBB' (7 caracteres). NULL = sin color elegido:
-- en ese caso el front pinta un color derivado del ID, para que ningún paquete
-- se vea sin identidad.
-- Ejecutar una vez en la base de datos.
-- =============================================================================

ALTER TABLE CAS_PAQUETE
  ADD COLUMN PAQ_COLOR VARCHAR(7) NULL DEFAULT NULL AFTER PAQ_DESCRIPCION;

-- Para revertir:
-- ALTER TABLE CAS_PAQUETE DROP COLUMN PAQ_COLOR;
