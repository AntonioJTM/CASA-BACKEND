/**
 * SQL compartido para el listado y la exportación de licencias.
 * Mantener aquí el SELECT evita que la tabla del dashboard y el CSV se desincronicen.
 */

/** Expresión que traduce LIC_STATUS numérico a la etiqueta que ve el usuario. */
const STATUS_LABEL_SQL = `
    CASE l.LIC_STATUS
        WHEN 1 THEN 'Activa'
        WHEN 2 THEN 'Desactivada'
        WHEN 3 THEN 'Vencida'
        ELSE 'Otro'
    END`;

const SELECT_LICENCIAS = `
    SELECT
        l.LIC_ID AS id,
        l.LIC_LICENCIA AS licencia,
        l.LIC_INDICIO AS indicio,
        l.LIC_FECHA_INICIO AS fechaInicio,
        l.LIC_FECHA_FIN AS fechaFin,
        l.LIC_TIEMPO AS tiempo,
        l.LIC_NUM_LICENCIAS AS numLicencias,
        l.LIC_NUM_CARACTERES AS numCaracteres,
        l.LIC_STATUS AS status,
        ${STATUS_LABEL_SQL} AS statusLabel,
        l.LIC_TIPO AS tipo,
        COALESCE(u.UAD_NOMBRE, 'Sin usuario') AS usuarioNombre,
        l.LIC_UAD_ID AS uadId,
        COALESCE(v.VEN_NOMBRE, 'Sin tipo de venta') AS tipoVentaNombre,
        l.LIC_VEN_ID AS venId,
        COALESCE(paq.PAQ_NOMBRE, 'Sin paquete') AS paqueteNombre,
        paq.PAQ_COLOR AS paqueteColor,
        l.LIC_PAQ_ID AS paqId,
        ped.PDD_BITACORA AS pedidoBitacora,
        ped.PDD_SISTEMA AS pedidoSistema,
        ped.PDD_SOLICITANTE AS pedidoSolicitante,
        l.LIC_PDD_ID AS pedidoId
    FROM CAS_LICENCIA l
    LEFT JOIN CAS_USUARIO_ADMIN u ON l.LIC_UAD_ID = u.UAD_ID
    LEFT JOIN CAS_VENTA v ON l.LIC_VEN_ID = v.VEN_ID
    LEFT JOIN CAS_PAQUETE paq ON l.LIC_PAQ_ID = paq.PAQ_ID
    LEFT JOIN CAS_PEDIDO ped ON l.LIC_PDD_ID = ped.PDD_ID`;

/** Etiqueta de estatus -> valor de LIC_STATUS. Acepta también el número directo. */
const STATUS_A_NUMERO = {
    'activa': 1,
    'desactivada': 2,
    'bloqueada': 2,
    'vencida': 3
};

function normalizarStatus(status) {
    if (status == null || status === '') return null;
    const s = String(status).trim().toLowerCase();
    if (s === 'todas' || s === 'todos') return null;
    if (STATUS_A_NUMERO[s] != null) return STATUS_A_NUMERO[s];
    const n = Number(s);
    return Number.isInteger(n) && n >= 1 && n <= 3 ? n : null;
}

function normalizarFecha(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function normalizarId(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Construye el WHERE a partir de los filtros de la UI.
 * Filtros soportados: tipo, status, pedidoId, ventaId, paqueteId, q, desde, hasta.
 * `q` replica la búsqueda de la tabla (id, licencia, tipo, usuario, estatus, solicitante).
 * `desde`/`hasta` acotan por LIC_FECHA_INICIO.
 */
function buildFiltrosLicencias(filtros = {}) {
    const condiciones = [];
    const params = [];

    if (filtros.tipo != null && filtros.tipo !== '') {
        condiciones.push('l.LIC_TIPO = ?');
        params.push(String(filtros.tipo).trim());
    }

    const status = normalizarStatus(filtros.status);
    if (status != null) {
        condiciones.push('l.LIC_STATUS = ?');
        params.push(status);
    }

    const pedidoId = normalizarId(filtros.pedidoId);
    if (pedidoId != null) {
        condiciones.push('l.LIC_PDD_ID = ?');
        params.push(pedidoId);
    }

    const ventaId = normalizarId(filtros.ventaId);
    if (ventaId != null) {
        condiciones.push('l.LIC_VEN_ID = ?');
        params.push(ventaId);
    }

    const paqueteId = normalizarId(filtros.paqueteId);
    if (paqueteId != null) {
        condiciones.push('l.LIC_PAQ_ID = ?');
        params.push(paqueteId);
    }

    const desde = normalizarFecha(filtros.desde);
    if (desde != null) {
        condiciones.push('l.LIC_FECHA_INICIO >= ?');
        params.push(desde);
    }

    const hasta = normalizarFecha(filtros.hasta);
    if (hasta != null) {
        condiciones.push('l.LIC_FECHA_INICIO <= ?');
        params.push(hasta);
    }

    const q = filtros.q != null ? String(filtros.q).trim() : '';
    if (q !== '') {
        const like = `%${q}%`;
        condiciones.push(`(
            CAST(l.LIC_ID AS CHAR) LIKE ?
            OR l.LIC_LICENCIA LIKE ?
            OR l.LIC_TIPO LIKE ?
            OR u.UAD_NOMBRE LIKE ?
            OR ped.PDD_SOLICITANTE LIKE ?
            OR ${STATUS_LABEL_SQL} LIKE ?
        )`);
        params.push(like, like, like, like, like, like);
    }

    const whereClause = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return { whereClause, params };
}

module.exports = {
    SELECT_LICENCIAS,
    STATUS_LABEL_SQL,
    buildFiltrosLicencias
};
