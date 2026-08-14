/**
 * Exporta licencias en cualquier momento, con los mismos filtros de la tabla.
 * GET /licencias/exportar?formato=xlsx|csv&tipo=&status=&pedidoId=&ventaId=&paqueteId=&q=&desde=&hasta=&sep=
 *
 * Por omisión entrega un Excel con diseño (encabezados, bandeado, estatus a color,
 * autofiltro y fila de totales). `formato=csv` entrega el mismo contenido en texto plano.
 *
 * En ambos casos las filas se escriben conforme llegan de la base, para soportar
 * lotes de cientos de miles de licencias sin cargar el resultado en memoria.
 */

const { SELECT_LICENCIAS, buildFiltrosLicencias } = require('./licenciasQuery');
const { COLUMNAS, crearReporteExcel } = require('./licenciasReporte');

/** Excel en español interpreta ';' como separador de columnas; ',' queda disponible por query. */
const SEPARADOR_POR_DEFECTO = ';';
const BOM_UTF8 = '﻿';

const TIPO_MIME = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv; charset=utf-8'
};

function formatearFechaCsv(value) {
    if (value == null || value === '') return '';
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return '';
        // Fecha local, no UTC: evita que un DATE se recorra un día por zona horaria.
        const mes = String(value.getMonth() + 1).padStart(2, '0');
        const dia = String(value.getDate()).padStart(2, '0');
        return `${value.getFullYear()}-${mes}-${dia}`;
    }
    const s = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

/** Escapa un valor según RFC 4180 y neutraliza fórmulas (=, +, -, @) para evitar CSV injection. */
function escaparCampo(value, separador) {
    if (value == null) return '';
    let s = String(value);
    if (s === '') return '';
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    if (s.includes(separador) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function nombreArchivo(filtros, extension) {
    const fecha = new Date().toISOString().slice(0, 10);
    if (filtros.pedidoId) return `licencias_pedido_${filtros.pedidoId}_${fecha}.${extension}`;
    if (filtros.tipo) {
        // `tipo` puede traer varios valores; se unen con guion para el nombre del archivo.
        const etiqueta = String(filtros.tipo).toLowerCase().split(',').map((t) => t.trim()).filter(Boolean).join('-');
        return `licencias_${etiqueta}_${fecha}.${extension}`;
    }
    return `licencias_${fecha}.${extension}`;
}

/** Escritor CSV: cabecera con BOM y una línea por licencia. */
function crearEscritorCsv(res, separador) {
    const linea = (campos) => campos.join(separador) + '\r\n';

    res.write(BOM_UTF8 + linea(COLUMNAS.map((c) => escaparCampo(c.header, separador))));

    return {
        agregarFila: (row) =>
            res.write(
                linea(
                    COLUMNAS.map((col) => {
                        const raw = col.tipo === 'fecha' ? formatearFechaCsv(row[col.key]) : row[col.key];
                        return escaparCampo(raw, separador);
                    })
                )
            ),
        cerrar: async () => res.end()
    };
}

exports.exportarLicencias = (req, res) => {
    const formato = req.query.formato === 'csv' ? 'csv' : 'xlsx';
    const separador = req.query.sep === ',' ? ',' : SEPARADOR_POR_DEFECTO;
    const { whereClause, params } = buildFiltrosLicencias(req.query);

    req.db.getConnection((errConn, connection) => {
        if (errConn) {
            console.error('Error al obtener conexión para exportar licencias:', errConn);
            return res.status(500).json({
                success: false,
                status: 'ERROR',
                message: 'Error al exportar licencias'
            });
        }

        let liberada = false;
        const liberar = () => {
            if (liberada) return;
            liberada = true;
            connection.release();
        };

        let escritor = null;

        const query = connection.query(
            `${SELECT_LICENCIAS}
            ${whereClause}
            ORDER BY l.LIC_ID DESC`,
            params
        );

        query.on('error', (error) => {
            console.error('Error al exportar licencias:', error);
            liberar();
            if (!escritor) {
                return res.status(500).json({
                    success: false,
                    status: 'ERROR',
                    message: 'Error al exportar licencias'
                });
            }
            // La descarga ya empezó: el archivo quedaría corrupto, solo se puede cortar.
            res.end();
        });

        // 'fields' llega en cuanto la consulta es válida, incluso sin resultados:
        // es el punto seguro para enviar cabeceras y abrir el archivo.
        query.on('fields', () => {
            res.setHeader('Content-Type', TIPO_MIME[formato]);
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${nombreArchivo(req.query, formato)}"`
            );
            res.setHeader('Cache-Control', 'no-store');

            escritor = formato === 'csv'
                ? crearEscritorCsv(res, separador)
                : crearReporteExcel(res, req.query);
        });

        query.on('result', (row) => {
            escritor.agregarFila(row);
            if (res.writableNeedDrain) {
                // Contrapresión: pausamos la lectura hasta que el socket se vacíe.
                connection.pause();
                res.once('drain', () => connection.resume());
            }
        });

        query.on('end', () => {
            liberar();
            Promise.resolve(escritor && escritor.cerrar()).catch((error) => {
                console.error('Error al cerrar el reporte de licencias:', error);
                if (!res.writableEnded) res.end();
            });
        });

        // Si el cliente aborta la descarga, destruimos la conexión: devolverla al pool a
        // media consulta dejaría filas pendientes y contaminaría al siguiente que la use.
        res.on('close', () => {
            if (!res.writableEnded && !liberada) {
                liberada = true;
                connection.destroy();
            }
        });
    });
};
