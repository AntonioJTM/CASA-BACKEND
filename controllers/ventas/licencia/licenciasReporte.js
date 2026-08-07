/**
 * Definición de columnas y escritura del reporte de licencias.
 *
 * El Excel se arma con el escritor en streaming de ExcelJS (WorkbookWriter): las filas
 * se serializan y se sueltan conforme llegan de la base, de modo que un reporte de
 * cientos de miles de licencias no se acumula en memoria.
 */

const ExcelJS = require('exceljs');

/** Paleta del reporte, alineada con el Excel que se entrega al generar un lote. */
const AZUL = 'FF2E5090';
const AZUL_BORDE = 'FF1E3A6B';
const FONDO_TITULO = 'FFE8EEF7';
const FONDO_SUBTITULO = 'FFF8F9FA';
const FILA_ALTERNA = 'FFF2F7FF';
const FONDO_TOTAL = 'FFD6DCE4';
const GRIS_TEXTO = 'FF333333';

const BORDE_FINO = { style: 'thin', color: { argb: 'FFBDC0C4' } };
const BORDE_FUERTE = { style: 'medium', color: { argb: AZUL_BORDE } };

const FORMATO_FECHA = 'yyyy-mm-dd';

/**
 * Columnas del reporte. `tipo` define alineación y formato:
 * 'texto' (izquierda), 'numero' (derecha), 'fecha' (centro), 'codigo' (monoespaciado).
 */
const COLUMNAS = [
    { header: 'ID', key: 'id', width: 10, tipo: 'numero' },
    { header: 'Licencia', key: 'licencia', width: 20, tipo: 'codigo' },
    { header: 'Indicio', key: 'indicio', width: 14, tipo: 'texto' },
    { header: 'Fecha inicio', key: 'fechaInicio', width: 14, tipo: 'fecha' },
    { header: 'Fecha fin', key: 'fechaFin', width: 14, tipo: 'fecha' },
    { header: 'Tiempo (días)', key: 'tiempo', width: 13, tipo: 'numero' },
    { header: 'Caracteres', key: 'numCaracteres', width: 12, tipo: 'numero' },
    { header: 'Tipo', key: 'tipo', width: 14, tipo: 'texto' },
    { header: 'Estatus', key: 'statusLabel', width: 14, tipo: 'estatus' },
    { header: 'Tipo de venta', key: 'tipoVentaNombre', width: 20, tipo: 'texto' },
    // Se pinta con el color de identidad del paquete (PAQ_COLOR), si tiene uno.
    { header: 'Paquete', key: 'paqueteNombre', width: 24, tipo: 'paquete' },
    { header: 'Pedido', key: 'pedidoId', width: 10, tipo: 'numero' },
    { header: 'Bitácora', key: 'pedidoBitacora', width: 14, tipo: 'texto' },
    { header: 'Solicitante', key: 'pedidoSolicitante', width: 26, tipo: 'texto' },
    { header: 'Usuario', key: 'usuarioNombre', width: 18, tipo: 'texto' }
];

/** Color del texto de la píldora de estatus. */
const COLOR_ESTATUS = {
    'Activa': { texto: 'FF15803D', fondo: 'FFDCFCE7' },
    'Vencida': { texto: 'FFB91C1C', fondo: 'FFFEE2E2' },
    'Desactivada': { texto: 'FFB45309', fondo: 'FFFEF3C7' }
};

const ALINEACION = {
    texto: 'left',
    codigo: 'left',
    numero: 'right',
    fecha: 'center',
    estatus: 'center',
    paquete: 'left'
};

/** '#RRGGBB' -> 'FFRRGGBB' (ARGB de ExcelJS), o null si no es un hexadecimal válido. */
function aArgb(hex) {
    if (!hex) return null;
    const s = String(hex).trim().replace(/^#/, '');
    return /^[0-9a-fA-F]{6}$/.test(s) ? `FF${s.toUpperCase()}` : null;
}

/**
 * Versión clara del color, para usarlo como fondo sin que el texto se pierda:
 * mezcla el tono con blanco al 88%, el equivalente al fondo tenue de la tabla.
 */
function tonoSuave(hex) {
    const argb = aArgb(hex);
    if (!argb) return null;
    const mezclar = (c) => Math.round(c + (255 - c) * 0.88);
    const r = mezclar(parseInt(argb.slice(2, 4), 16));
    const g = mezclar(parseInt(argb.slice(4, 6), 16));
    const b = mezclar(parseInt(argb.slice(6, 8), 16));
    return `FF${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Convierte el valor de fecha del driver a un Date sin hora (o null si no aplica). */
function aFecha(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? null
            : new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function aNumero(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

/** Valor listo para la celda, según el tipo de columna. */
function valorCelda(row, columna) {
    const raw = row[columna.key];
    if (raw == null || raw === '') return null;
    if (columna.tipo === 'fecha') return aFecha(raw);
    if (columna.tipo === 'numero') return aNumero(raw);
    return String(raw);
}

/** Frase legible con los filtros aplicados, para el subtítulo del reporte. */
function describirFiltros(filtros = {}) {
    const partes = [];
    if (filtros.tipo) partes.push(`Tipo: ${filtros.tipo}`);
    if (filtros.status && String(filtros.status).toLowerCase() !== 'todas') {
        partes.push(`Estatus: ${filtros.status}`);
    }
    if (filtros.pedidoId) partes.push(`Pedido #${filtros.pedidoId}`);
    if (filtros.ventaId) partes.push(`Tipo de venta #${filtros.ventaId}`);
    if (filtros.paqueteId) partes.push(`Paquete #${filtros.paqueteId}`);
    if (filtros.desde) partes.push(`Desde ${filtros.desde}`);
    if (filtros.hasta) partes.push(`Hasta ${filtros.hasta}`);
    if (filtros.q) partes.push(`Búsqueda: "${filtros.q}"`);
    return partes.length ? partes.join(' · ') : 'Todas las licencias';
}

/**
 * Abre un reporte Excel que se escribe directamente sobre `stream`.
 * Devuelve { agregarFila, cerrar }: `agregarFila` serializa una licencia y
 * `cerrar` remata con la fila de totales y cierra el archivo.
 */
function crearReporteExcel(stream, filtros = {}) {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream,
        useStyles: true,
        // Sin tabla de cadenas compartidas: se evita acumular todos los textos en memoria.
        useSharedStrings: false
    });
    workbook.creator = 'CASA Backend';

    const sheet = workbook.addWorksheet('Licencias', {
        properties: { tabColor: { argb: AZUL } },
        pageSetup: {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'landscape',
            margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }
        },
        // Se congelan las 3 primeras filas: título, subtítulo y encabezados.
        views: [{ state: 'frozen', ySplit: 3, activeCell: 'A4' }]
    });

    sheet.columns = COLUMNAS.map((c) => ({ key: c.key, width: c.width }));

    const ultimaColumna = COLUMNAS.length;

    // Fila 1 — título
    const filaTitulo = sheet.getRow(1);
    filaTitulo.height = 30;
    const celdaTitulo = filaTitulo.getCell(1);
    celdaTitulo.value = 'Reporte de licencias — CASA';
    celdaTitulo.font = { bold: true, size: 15, color: { argb: AZUL } };
    celdaTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FONDO_TITULO } };
    celdaTitulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    for (let c = 1; c <= ultimaColumna; c++) {
        const celda = filaTitulo.getCell(c);
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FONDO_TITULO } };
        celda.border = {
            top: BORDE_FUERTE,
            bottom: { style: 'thin', color: { argb: AZUL_BORDE } },
            left: c === 1 ? BORDE_FUERTE : undefined,
            right: c === ultimaColumna ? BORDE_FUERTE : undefined
        };
    }
    sheet.mergeCells(1, 1, 1, ultimaColumna);
    filaTitulo.commit();

    // Fila 2 — subtítulo con la fecha y los filtros aplicados
    const filaSubtitulo = sheet.getRow(2);
    filaSubtitulo.height = 20;
    const celdaSubtitulo = filaSubtitulo.getCell(1);
    const generadoEl = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
    celdaSubtitulo.value = `Generado el ${generadoEl} · ${describirFiltros(filtros)}`;
    celdaSubtitulo.font = { size: 9, italic: true, color: { argb: 'FF6B6B6B' } };
    celdaSubtitulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    for (let c = 1; c <= ultimaColumna; c++) {
        const celda = filaSubtitulo.getCell(c);
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FONDO_SUBTITULO } };
        celda.border = {
            bottom: BORDE_FINO,
            left: c === 1 ? BORDE_FUERTE : undefined,
            right: c === ultimaColumna ? BORDE_FUERTE : undefined
        };
    }
    sheet.mergeCells(2, 1, 2, ultimaColumna);
    filaSubtitulo.commit();

    // Fila 3 — encabezados
    const filaEncabezado = sheet.getRow(3);
    filaEncabezado.height = 26;
    COLUMNAS.forEach((col, i) => {
        const celda = filaEncabezado.getCell(i + 1);
        celda.value = col.header;
        celda.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
        celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        celda.border = {
            top: BORDE_FUERTE,
            bottom: BORDE_FUERTE,
            left: { style: 'thin', color: { argb: AZUL_BORDE } },
            right: { style: 'thin', color: { argb: AZUL_BORDE } }
        };
    });
    filaEncabezado.commit();

    let total = 0;

    const agregarFila = (datos) => {
        total += 1;
        const fila = sheet.getRow(3 + total);
        fila.height = 18;

        COLUMNAS.forEach((col, i) => {
            const celda = fila.getCell(i + 1);
            celda.value = valorCelda(datos, col);
            celda.border = { top: BORDE_FINO, left: BORDE_FINO, bottom: BORDE_FINO, right: BORDE_FINO };
            celda.alignment = { vertical: 'middle', horizontal: ALINEACION[col.tipo] || 'left' };
            celda.font = { size: 10, color: { argb: GRIS_TEXTO } };

            if (col.tipo === 'fecha') celda.numFmt = FORMATO_FECHA;
            if (col.tipo === 'codigo') celda.font = { size: 10, name: 'Consolas', color: { argb: GRIS_TEXTO } };

            if (col.tipo === 'estatus') {
                const paleta = COLOR_ESTATUS[celda.value];
                if (paleta) {
                    celda.font = { size: 10, bold: true, color: { argb: paleta.texto } };
                    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: paleta.fondo } };
                    return;
                }
            }

            // El paquete se pinta con su color de identidad, el mismo que en el dashboard.
            if (col.tipo === 'paquete') {
                const fondo = tonoSuave(datos.paqueteColor);
                const texto = aArgb(datos.paqueteColor);
                if (fondo && texto) {
                    celda.font = { size: 10, bold: true, color: { argb: texto } };
                    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } };
                    return;
                }
            }

            // Bandeado: solo si la celda no pintó ya su propio color de estatus.
            if (total % 2 === 0) {
                celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILA_ALTERNA } };
            }
        });

        fila.commit();
    };

    const cerrar = async () => {
        const filaTotalIdx = 3 + total + 1;
        const filaTotal = sheet.getRow(filaTotalIdx);
        filaTotal.height = 24;
        filaTotal.getCell(1).value = `Total: ${total} licencia(s)`;
        filaTotal.getCell(1).font = { bold: true, size: 11, color: { argb: AZUL } };
        filaTotal.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        for (let c = 1; c <= ultimaColumna; c++) {
            const celda = filaTotal.getCell(c);
            celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FONDO_TOTAL } };
            celda.border = {
                top: BORDE_FUERTE,
                bottom: BORDE_FUERTE,
                left: c === 1 ? BORDE_FUERTE : BORDE_FINO,
                right: c === ultimaColumna ? BORDE_FUERTE : undefined
            };
        }
        sheet.mergeCells(filaTotalIdx, 1, filaTotalIdx, ultimaColumna);
        filaTotal.commit();

        if (total > 0) {
            sheet.autoFilter = {
                from: { row: 3, column: 1 },
                to: { row: 3 + total, column: ultimaColumna }
            };
        }

        sheet.commit();
        await workbook.commit();
    };

    return { agregarFila, cerrar };
}

module.exports = {
    COLUMNAS,
    crearReporteExcel,
    describirFiltros
};
