/**
 * Genera N licencias en CAS_LICENCIA vía procedimiento almacenado.
 * Soporta cantidades masivas con tope 400.000.
 * Progreso en tiempo real por Socket.IO si se envía sessionId en el body.
 * Al finalizar, genera un Excel con diseño y lo envía por socket (licencias-fin con excelBase64 y fileName)
 * para descarga automática en Angular.
 *
 * Body: tipoVenta, tipoLicencia, indicio, fechaInicio, cantidadLicencias, paquete,
 *       tiempoDias, fechaVencimiento, cantidadCaracteres, pedidoBitacora, solicitante,
 *       uadId (usuario que las genera; requerido salvo que el token lo aporte), [sessionId]
 *
 * Socket (progreso en tiempo real):
 * - Frontend debe unirse a la sala: socket.emit('join-license-room', sessionId)
 * - Eventos emitidos a esa sala: licencias-inicio, licencias-progreso, licencias-fin, licencias-error
 * - licencias-fin incluye: success, cantidad, mensaje, excelBase64, fileName (para descarga automática)
 *
 * Angular: escuchar 'licencias-fin' y descargar Excel automáticamente cuando venga excelBase64:
 *   this.socket.on('licencias-fin', (data) => {
 *     if (data.excelBase64 && data.fileName) {
 *       const byteCharacters = atob(data.excelBase64);
 *       const byteNumbers = new Array(byteCharacters.length);
 *       for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
 *       const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 *       const url = URL.createObjectURL(blob);
 *       const a = document.createElement('a'); a.href = url; a.download = data.fileName; a.click();
 *       URL.revokeObjectURL(url);
 *     }
 *   });
 */

const ExcelJS = require('exceljs');
const { fetchDistribucion } = require('./licenciasDistribucion.controller');

const TOPE_MAXIMO = 400000;
const TAMANO_LOTE = 10000;

/** Convierte ISO o cualquier fecha a YYYY-MM-DD para MySQL DATE. */
function toDateOnly(value) {
    if (value == null || value === '') return null;
    const s = value.toString().trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
}

/** Formatea un valor opcional para Excel: si es null/undefined/'' devuelve vacío. */
function formatOptional(value) {
    if (value == null || value === '') return '';
    const s = String(value).trim();
    return s || '';
}

/** Genera un buffer Excel con diseño a partir del listado de licencias.
 * opts: { fechaInicio, fechaFin, tiempo, licTipo } — pueden ser null/undefined (se valida y se muestra vacío si no vienen).
 */
function buildExcelLicencias(licencias, opts = {}) {

    const { fechaInicio, fechaFin, tiempo, licTipo } = opts;
    const hasFechaInicio = formatOptional(fechaInicio) !== '';
    const hasFechaFin = formatOptional(fechaFin) !== '';
    const hasTiempo = tiempo != null && tiempo !== '' && !Number.isNaN(Number(tiempo));
    const hasLicTipo = formatOptional(licTipo) !== '';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CASA Backend';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Licencias', {
        properties: { tabColor: { argb: 'FF2E5090' } },
        pageSetup: {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'portrait',
            margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
            printArea: 'A1:Z10000',
            showGridLines: true
        },
        views: [{ state: 'frozen', ySplit: 2, activeCell: 'A3', showGridLines: true }]
    });

    const headers = ['Licencia'];
    if (hasFechaInicio) headers.push('Fecha inicio');
    if (hasFechaFin) headers.push('Fecha fin');
    if (hasTiempo) headers.push('Tiempo (días)');
    if (hasLicTipo) headers.push('Lic tipo');

    const colWidths = headers.map((h) => (h === 'Licencia' ? 48 : (h.length > 12 ? 16 : 14)));
    sheet.columns = headers.map((h, i) => ({ header: h, key: `col${i}`, width: colWidths[i] }));

    const headerColor = 'FF2E5090';
    const headerBorder = 'FF1E3A6B';
    const titleBg = 'FFE8EEF7';
    const rowAlt = 'FFF2F2F2';
    const totalBg = 'FFD6DCE4';
    const borderThin = { style: 'thin', color: { argb: 'FFBDC0C4' } };
    const borderHeader = { style: 'medium', color: { argb: headerBorder } };

    let dataStartRow = 3;

    const titleRow = sheet.getRow(1);
    titleRow.height = 28;
    titleRow.getCell(1).value = 'Reporte de licencias generadas — CASA';
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF2E5090' } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: titleBg } };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
    sheet.mergeCells(1, 1, 1, headers.length);
    titleRow.getCell(1).border = {
        top: borderHeader,
        left: borderHeader,
        bottom: { style: 'thin', color: { argb: headerBorder } },
        right: borderHeader
    };

    const subtitleRow = sheet.getRow(2);
    subtitleRow.height = 20;
    subtitleRow.getCell(1).value = `Generado el ${new Date().toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' })} · Total: ${licencias.length} licencia(s)`;
    subtitleRow.getCell(1).font = { size: 9, color: { argb: 'FF6B6B6B' } };
    subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
    subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.mergeCells(2, 1, 2, headers.length);
    subtitleRow.getCell(1).border = {
        top: borderThin,
        left: borderHeader,
        bottom: borderThin,
        right: borderHeader
    };

    const headerRow = sheet.getRow(dataStartRow);
    headerRow.height = 24;
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            top: borderHeader,
            left: { style: 'thin', color: { argb: headerBorder } },
            bottom: borderHeader,
            right: { style: 'thin', color: { argb: headerBorder } }
        };
    });

    const fechaInicioStr = formatOptional(fechaInicio);
    const fechaFinStr = formatOptional(fechaFin);
    const tiempoNum = hasTiempo ? Number(tiempo) : '';
    const licTipoStr = formatOptional(licTipo);

    licencias.forEach((item, index) => {
        const rowValues = [item.licencia];
        if (hasFechaInicio) rowValues.push(fechaInicioStr);
        if (hasFechaFin) rowValues.push(fechaFinStr);
        if (hasTiempo) rowValues.push(tiempoNum);
        if (hasLicTipo) rowValues.push(licTipoStr);

        const r = dataStartRow + 1 + index;
        const row = sheet.getRow(r);
        row.values = rowValues;

        const isAlt = index % 2 === 1;
        row.height = 20;
        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: borderThin,
                left: borderThin,
                bottom: borderThin,
                right: borderThin
            };
            cell.fill = isAlt ? { type: 'pattern', pattern: 'solid', fgColor: { argb: rowAlt } } : undefined;
            cell.font = { size: 10, color: { argb: 'FF333333' } };
            const numCol = hasTiempo && colNumber === 2 + (hasFechaInicio ? 1 : 0) + (hasFechaFin ? 1 : 0);
            const dateCol = (hasFechaInicio && colNumber === 2) || (hasFechaFin && colNumber === (hasFechaInicio ? 3 : 2));
            if (numCol || dateCol) {
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
            }
        });
    });

    const totalRowIndex = dataStartRow + 1 + licencias.length;
    const totalRow = sheet.getRow(totalRowIndex);
    totalRow.height = 24;
    totalRow.getCell(1).value = `Total: ${licencias.length} licencia(s)`;
    totalRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF2E5090' } };
    totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalBg } };
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.mergeCells(totalRowIndex, 1, totalRowIndex, headers.length);
    totalRow.getCell(1).border = {
        top: borderHeader,
        left: borderHeader,
        bottom: borderHeader,
        right: borderHeader
    };
    for (let c = 2; c <= headers.length; c++) {
        totalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalBg } };
        totalRow.getCell(c).border = {
            top: borderHeader,
            left: borderThin,
            bottom: borderHeader,
            right: borderHeader
        };
    }

    if (licencias.length > 0) {
        sheet.autoFilter = {
            from: { row: dataStartRow, column: 1 },
            to: { row: dataStartRow + licencias.length, column: headers.length }
        };
    }

    return workbook.xlsx.writeBuffer();
}

exports.generarLicencias = (req, res) => {
    try {
        const {
            tipoVenta,
            tipoLicencia,
            indicio,
            fechaInicio,
            cantidadLicencias,
            paquete,
            tiempoDias,
            fechaVencimiento,
            cantidadCaracteres,
            pedidoBitacora,
            solicitante,
            uadId,
            sessionId,
            pedidoId
        } = req.body;

        const roomId = (sessionId && typeof sessionId === 'string' && sessionId.trim()) ? sessionId.trim() : null;
        const emitProgress = roomId && req.io;

        if (!tipoVenta || tipoVenta.toString().trim() === '') {
            return res.status(400).json({
                success: false,
                status: 'BAD_REQUEST',
                message: 'El campo tipoVenta es requerido'
            });
        }

        const cantidadSolicitada = Number(cantidadLicencias) || 0;
        if (cantidadSolicitada <= 0) {
            return res.status(400).json({
                success: false,
                status: 'BAD_REQUEST',
                message: 'cantidadLicencias debe ser un número mayor a 0'
            });
        }

        const cantidad = Math.min(cantidadSolicitada, TOPE_MAXIMO);
        const paqId = paquete != null && paquete !== '' ? Number(paquete) : null;
        const tiempo = tiempoDias != null && tiempoDias !== '' ? Number(tiempoDias) : null;
        const numCaracteres = cantidadCaracteres != null && cantidadCaracteres !== '' ? Number(cantidadCaracteres) : null;
        const fechaIni = toDateOnly(fechaInicio);
        const fechaFin = toDateOnly(fechaVencimiento);

        const indicioStr = (indicio != null && indicio !== '') ? indicio.toString().trim().substring(0, 12) : '';
        const tipoVentaStr = tipoVenta.toString().trim().substring(0, 45);
        const tipoLicenciaStr = (tipoLicencia != null && tipoLicencia !== '') 
            ? tipoLicencia.toString().trim().substring(0, 45) 
            : tipoVentaStr;
        
        const bitacora = (pedidoBitacora != null && pedidoBitacora !== '') ? Number(pedidoBitacora) : null;
        const solicitanteStr = (solicitante != null && solicitante !== '') 
            ? solicitante.toString().trim().substring(0, 100) 
            : '';
        
        /**
         * Creador de las licencias (y del pedido, si se crea uno): lo manda el front
         * con el usuario de la sesión, o sale del token si la ruta llevara middleware
         * de autenticación. Antes, al faltar ambos, caía en el ID 1 y todo quedaba
         * atribuido a ese usuario sin que se notara; ahora se rechaza la petición.
         */
        const uadIdNum = (uadId != null && uadId !== '') ? Number(uadId) : NaN;
        const licUadId = (Number.isInteger(uadIdNum) && uadIdNum > 0)
            ? uadIdNum
            : ((req.user && (req.user.userId ?? req.user.id)) || null);

        if (licUadId == null) {
            return res.status(400).json({
                success: false,
                status: 'BAD_REQUEST',
                message: 'El campo uadId es requerido: no se puede registrar quién generó las licencias'
            });
        }

        // Si viene pedidoId, es una ampliación: las licencias se cuelgan de ese pedido.
        const pedidoIdNum = pedidoId != null && pedidoId !== '' ? Number(pedidoId) : null;
        const pedidoExistenteId = Number.isInteger(pedidoIdNum) && pedidoIdNum > 0 ? pedidoIdNum : null;

        const resolveVenId = (cb) => {
            const num = Number(tipoVenta);
            if (!Number.isNaN(num) && Number.isInteger(num) && num > 0) {
                return cb(null, num);
            }
            req.db.query(
                'SELECT VEN_ID FROM CAS_VENTA WHERE VEN_TIPO = ? OR VEN_NOMBRE = ? LIMIT 1',
                [tipoVentaStr, tipoVentaStr],
                (error, rows) => {
                    if (error) return cb(error, null);
                    const id = rows && rows[0] ? rows[0].VEN_ID : null;
                    cb(null, id);
                }
            );
        };

        resolveVenId((err, licVenId) => {
            if (err) {
                console.error('Error al resolver LIC_VEN_ID:', err);
                return res.status(500).json({
                    success: false,
                    status: 'ERROR',
                    message: 'Error al resolver tipo de venta'
                });
            }

            const fechaRegistroPedido = new Date().toISOString().slice(0, 10);

            const insertarPedido = (cb) => {
                // Ampliación de un lote existente: se engancha al pedido que ya existe
                // en lugar de crear uno nuevo con la misma bitácora.
                if (pedidoExistenteId != null) {
                    return cb(null, pedidoExistenteId);
                }

                if (bitacora == null && solicitanteStr === '') {
                    return cb(null, null);
                }

                req.db.query(
                    'CALL sp_insertar_pedido(?, ?, ?, ?)',
                    [bitacora, solicitanteStr, licUadId, fechaRegistroPedido],
                    (error, results) => {
                        if (error) {
                            console.error('Error al insertar pedido:', error);
                            return cb(error, null);
                        }
                        let filas = [];
                        if (Array.isArray(results) && results.length > 0) {
                            filas = Array.isArray(results[0]) ? results[0] : results;
                        }
                        const pddId = filas && filas[0] ? filas[0].pdd_id : null;
                        cb(null, pddId);
                    }
                );
            };

            const emitirPedidoNuevo = (pddId, done) => {
                // En una ampliación el pedido ya existía: no hay pedido nuevo que anunciar.
                if (!pddId || !req.io || pedidoExistenteId != null) return done();
                req.db.query(
                    `SELECT 
                        p.PDD_ID AS id,
                        p.PDD_BITACORA AS bitacora,
                        p.PDD_SISTEMA AS sistema,
                        p.PDD_SOLICITANTE AS solicitante,
                        p.PDD_FECHA_REGISTRO AS fechaRegistro,
                        COALESCE(u.UAD_NOMBRE, 'Sin usuario') AS usuarioNombre,
                        p.PDD_UAD_ID AS uadId
                    FROM CAS_PEDIDO p
                    LEFT JOIN CAS_USUARIO_ADMIN u ON p.PDD_UAD_ID = u.UAD_ID
                    WHERE p.PDD_ID = ?`,
                    [pddId],
                    (err, rows) => {
                        if (!err && rows && rows[0]) {
                            req.io.emit('pedido-nuevo', { success: true, pedido: rows[0] });
                        }
                        done();
                    }
                );
            };

            insertarPedido((errPedido, pddId) => {
                if (errPedido) {
                    return res.status(500).json({
                        success: false,
                        status: 'ERROR',
                        message: 'Error al crear pedido',
                        detalle: errPedido.message
                    });
                }

                emitirPedidoNuevo(pddId, () => {});

                const sqlCall = 'CALL sp_generar_licencias_batch(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                const params = [
                    indicioStr,
                    licVenId,
                    fechaIni,
                    fechaFin,
                    paqId,
                    tiempo,
                    numCaracteres,
                    licUadId,
                    tipoVentaStr,
                    tipoLicenciaStr,
                    pddId,
                    0
                ];

            const licenciasGeneradas = [];
            let offset = 0;
            let errorGlobal = null;
            
            // Calculamos un tamaño de lote dinámico para tener aprox. 100 actualizaciones (1% por avance)
            const dynamicLote = Math.max(1, Math.min(TAMANO_LOTE, Math.ceil(cantidad / 100)));

            if (emitProgress) {
                req.io.to(roomId).emit('licencias-inicio', {
                    total: cantidad,
                    mensaje: `Generando ${cantidad} licencia(s)...`
                });
            }

            const ejecutarSiguienteLote = () => {
                if (offset >= cantidad) {
                    if (errorGlobal) {
                        if (emitProgress) {
                            req.io.to(roomId).emit('licencias-error', {
                                message: errorGlobal.message || 'Error al generar licencias'
                            });
                        }
                        return res.status(500).json({
                            success: false,
                            status: 'ERROR',
                            message: 'Error al generar licencias',
                            detalle: errorGlobal.message
                        });
                    }
                    const enviarFinYResponder = (excelPayload) => {
                        if (emitProgress) {
                            req.io.to(roomId).emit('licencias-fin', {
                                success: true,
                                cantidad: licenciasGeneradas.length,
                                mensaje: `Se generaron ${licenciasGeneradas.length} licencia(s)`,
                                ...excelPayload
                            });
                        }
                        if (req.io && licenciasGeneradas.length > 0) {
                            req.io.emit('licencias-nuevas', {
                                success: true,
                                cantidad: licenciasGeneradas.length,
                                mensaje: `Se generaron ${licenciasGeneradas.length} nueva(s) licencia(s)`
                            });
                            fetchDistribucion(req.db, (errDist, dist) => {
                                if (!errDist && dist) {
                                    req.io.emit('licencias-distribucion-actualizada', dist);
                                }
                            });
                        }
                        return res.status(201).json({
                            success: true,
                            message: `Se generaron ${licenciasGeneradas.length} licencia(s)`,
                            data: {
                                cantidad: licenciasGeneradas.length,
                                licencias: licenciasGeneradas
                            }
                        });
                    };
                    if (licenciasGeneradas.length === 0) {
                        return enviarFinYResponder({});
                    }
                    const fileName = `licencias_${new Date().toISOString().slice(0, 10)}_${Date.now()}.xlsx`;
                    const excelOpts = {
                        fechaInicio: fechaIni,
                        fechaFin: fechaFin,
                        tiempo: tiempo,
                        licTipo: tipoLicenciaStr
                    };
                    buildExcelLicencias(licenciasGeneradas, excelOpts)
                        .then((buffer) => {
                            const excelBase64 = buffer.toString('base64');
                            enviarFinYResponder({ excelBase64, fileName });
                        })
                        .catch((errExcel) => {
                            console.error('Error al generar Excel de licencias:', errExcel);
                            enviarFinYResponder({
                                excelError: true,
                                message: 'Licencias generadas pero falló la generación del Excel'
                            });
                        });
                    return;
                }

                const lote = Math.min(dynamicLote, cantidad - offset);
                params[11] = lote;

                req.db.query(sqlCall, params, (error, results) => {
                    if (error) {
                        errorGlobal = error;
                        console.error('Error en sp_generar_licencias_batch:', error);
                        offset = cantidad;
                        return ejecutarSiguienteLote();
                    }

                    let filas = [];
                    if (Array.isArray(results) && results.length > 0) {
                        filas = Array.isArray(results[0]) ? results[0] : results;
                    }
                    filas.forEach(row => {
                        licenciasGeneradas.push({
                            id: row.id,
                            licencia: row.licencia
                        });
                    });

                    offset += lote;

                    if (emitProgress) {
                        const generadas = licenciasGeneradas.length;
                        const porcentaje = cantidad > 0 ? Math.round((100 * generadas) / cantidad) : 100;
                        req.io.to(roomId).emit('licencias-progreso', {
                            total: cantidad,
                            generadas,
                            porcentaje,
                            mensaje: `${generadas} / ${cantidad} (${porcentaje}%)`
                        });
                    }

                    ejecutarSiguienteLote();
                });
            };

            ejecutarSiguienteLote();
            });
        });
    } catch (err) {
        console.error('Error en generarLicencias:', err);
        res.status(500).json({
            success: false,
            status: 'ERROR',
            message: 'Error en el servidor'
        });
    }
};
