# Cambio: el launcher resuelve el contenido según el tipo de licencia

Fecha: 2026-08-14

## Qué cambió

**`controllers/casa-launcher/casa-launcher-productos.controller.js`** (reescrito)

El endpoint `GET /casa/launcher/productos` ahora bifurca por `LIC_TIPO` en lugar de asumir que todo contenido viene de un paquete.

- La consulta de licencias trae `l.LIC_TIPO` además del paquete, y el `INNER JOIN CAS_PAQUETE` pasó a `LEFT JOIN`.
- Si alguna licencia activa del usuario es `PRESENTACIONES` o `GENERICA`, devuelve todo `CAS_PRODUCTOS` sin consultar paquetes.
- Si no, devuelve la unión de los `PAQ_PRODUCTOS` de sus licencias, igual que antes.
- La respuesta suma el campo `alcance`: `'TOTAL' | 'PAQUETE' | 'NINGUNO'`.

**`casa-launcher/src/app/components/casa/casa-home/casa-home.ts`**

Se agregó el helper privado `tipo()` para leer `PRO_TIPO` sin asumir que trae valor. `PRO_TIPO` es nullable en la base, y al devolver el catálogo completo pueden llegar productos que ningún paquete curó.

## Cuándo

2026-08-14, el mismo día que Antonio renombró `GENERICA` a `PRESENTACIONES` (`casa-web a5c9576`) y que Carlos aplicó la misma bifurcación en el portal web (`casa-web 51392fc`).

## Por qué

Antonio decidió que el paquete es exclusivo de las licencias `INDIVIDUAL`. El modal de ventas ahora envía `paquete: null` para `PRESENTACIONES`:

```ts
// casa-web/src/app/ventas/modals/licencias/licencias.ts
get requierePaquete(): boolean {
  return this.form.tipoLicencia === 'INDIVIDUAL';
}
```

El launcher derivaba el contenido únicamente del paquete y con un `INNER JOIN`. Con `LIC_PAQ_ID` en NULL el JOIN eliminaba la fila, el endpoint respondía `productos: []` y el launcher mostraba un home vacío tras un login exitoso, sin ningún mensaje.

Peor: con `INNER JOIN` una licencia sin paquete era indistinguible de un usuario sin licencias, así que no había forma de saber que era de tipo `PRESENTACIONES`. El `LEFT JOIN` es lo que permite verla y decidir.

No existe ninguna relación en la base entre una licencia `PRESENTACIONES` y el contenido: la única ruta es `LIC_PAQ_ID -> CAS_PAQUETE.PAQ_PRODUCTOS` y termina en NULL. "Todo el catálogo" es por lo tanto una regla de código, no un dato. Este cambio es esa regla.

Análisis completo del caso: `casa-launcher/docs/ANALISIS-LICENCIAS-PRESENTACIONES.md`.

## Qué no cambió

El contrato con el launcher es el mismo: `{ success, productos }`, con las mismas 10 columnas y el mismo `ORDER BY PRO_NOMBRE`. El campo `alcance` es aditivo y el launcher lo ignora.

La rama `INDIVIDUAL` conserva su comportamiento exacto, incluida la validación `LIC_STATUS = 1` como único criterio de vigencia. Las 4 cuentas que existen hoy son todas `INDIVIDUAL`, así que ninguna cambia de comportamiento.

## Pendiente

Este cambio deja el backend listo, pero el flujo todavía no se puede probar de punta a punta:

1. **No se puede crear la credencial.** El registro de casa-web exige `tipo: 'INDIVIDUAL'` escrito a mano en `inicio-sesion.ts:130`, `modal-inicio-sesion.ts:114` y `modal-productos.ts:39`. Una `PRESENTACIONES` se rechaza con "NoExisteLic".
2. **Vencimiento nulo.** La licencia 91 no tiene `LIC_FECHA_INICIO` ni `LIC_FECHA_FIN`. El login calcula `MAX(LIC_FECHA_FIN)`, que devuelve NULL, y esa fecha ausente bloquea el login offline del launcher.
3. **`PRO_VERSION` subió a 2 en 10 productos** por edición de metadata, lo que dispara borrado y re-descarga en los launchers instalados. Es independiente de este cambio y de mayor urgencia.
