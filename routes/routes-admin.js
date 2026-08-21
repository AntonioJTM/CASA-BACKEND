const express = require('express');
const router = express.Router();

const filtros = require('../controllers/ADMIN/multimedia/filtros.controllers');
const multimedia = require('../controllers/ADMIN/multimedia/multimedia.controller');
const uploadController = require('../controllers/ADMIN/multimedia/upload.controller');
const uploadProd = require('../controllers/ADMIN/multimedia/uploadprod.controllers');
const { getProductos, updateProducto, addFilesToProducto, deleteFileFromProducto }  = require('../controllers/ADMIN/multimedia/viewProductos.controller');
const { getArchivosEnCarpeta } = require('../controllers/ADMIN/multimedia/productosFiles');
const { deleteMultimedia } = require('../controllers/ADMIN/multimedia/deleteMultimedia.controller');
const { deleteProducto } = require('../controllers/ADMIN/multimedia/deleteProducto.controller');
const { updateStatus } = require('../controllers/ADMIN/multimedia/updateStatus.controller');
const { registrarVenta } = require('../controllers/ventas/venta/registrarVenta.controller');
const { getTiposVenta } = require('../controllers/ventas/venta/tiposVenta.controller');
const { getVentas } = require('../controllers/ventas/venta/ventas.controller');
const { deleteVenta } = require('../controllers/ventas/venta/deleteVenta.controller');
const { getCountabs } = require('../controllers/ADMIN/multimedia/countTabs');
const { registrarPaquete } = require('../controllers/ventas/paquete/registrarPaquete.controller');
const { getPaquetes } = require('../controllers/ventas/paquete/paquetes.controller');
const { getPaquetesCompletos } = require('../controllers/ventas/paquete/paquetesCompletos.controller');
const { updatePaquete } = require('../controllers/ventas/paquete/updatePaquete.controller');
const { deletePaquete } = require('../controllers/ventas/paquete/deletePaquete.controller');
const { generarLicencias } = require('../controllers/ventas/licencia/generarLicencias.controller');
const { getLicenciasCompletas } = require('../controllers/ventas/licencia/licenciasCompletas.controller');
const { updateLicenciaStatus } = require('../controllers/ventas/licencia/updateLicenciaStatus.controller');
const { getLicenciasDistribucion } = require('../controllers/ventas/licencia/licenciasDistribucion.controller');
const { exportarLicencias } = require('../controllers/ventas/licencia/exportarLicencias.controller');
const { getPedidosCompletos } = require('../controllers/ventas/pedido/pedidosCompletos.controller');
const { getPlantillaLicenciaPedido } = require('../controllers/ventas/pedido/plantillaLicenciaPedido.controller');
const materiasController = require('../controllers/ADMIN/multimedia/materias.controllers');

module.exports = () => {

    router.post('/registrar-venta', registrarVenta);
    router.get('/tipos-venta', getTiposVenta);
    router.get('/ventas', getVentas);
    router.delete('/ventas/:id', deleteVenta);

    router.post('/registrar-paquete', registrarPaquete);
    router.get('/paquetes', getPaquetes);
    router.get('/paquetes-completos', getPaquetesCompletos);
    router.put('/paquetes/:id', updatePaquete);
    router.delete('/paquetes/:id', deletePaquete);

    router.post('/licencias', generarLicencias);
    router.get('/licencias-completas', getLicenciasCompletas);
    router.get('/licencias-distribucion', getLicenciasDistribucion);
    // Antes de '/licencias/:id/status' no hay conflicto, pero mantenerla arriba evita
    // que una futura ruta con parámetro capture 'exportar'.
    router.get('/licencias/exportar', exportarLicencias);
    router.put('/licencias/:id/status', updateLicenciaStatus);

    router.get('/pedidos-completos', getPedidosCompletos);
    router.get('/pedidos/:id/plantilla-licencia', getPlantillaLicenciaPedido);

    router.get('/filter-grados', filtros.getGradosFilter);
    router.get('/filter-subtipos', filtros.getSubtipoFilter);
    router.get('/filter-subsistemas', filtros.getSubsistemasFilter);
    router.get('/filter-materias', filtros.getMateriasFilter);
    router.get('/countabs', getCountabs);

    router.get('/update-status', updateStatus);

    router.get('/productos', getProductos);
    router.get('/materias', materiasController.getTodasMaterias);
    router.post('/materias', materiasController.subirPortada, materiasController.addMateria);
    router.put('/materias/:id', materiasController.subirPortada, materiasController.updateMateria);
    router.delete('/materias/:id', materiasController.deleteMateria);

    
    router.get('/productos/archivos', (req, res) => {
        const proFiles = req.query.pro_files;
        if (!proFiles || typeof proFiles !== 'string') {
            return res.status(400).json({ detalle: 'Query pro_files es requerido (ej: ?pro_files=/productos/generador-de-interrogacion)' });
        }
        const archivos = getArchivosEnCarpeta(proFiles);
        res.json({ pro_files: proFiles, archivos });
    });


    router.put('/productos/:id', updateProducto);
    router.post('/productos/:id/archivos', addFilesToProducto);
    router.delete('/productos/:id/archivos/:filename', deleteFileFromProducto);
    router.delete('/delete-productos/:id', deleteProducto);

    router.post('/upload',
        (req, res, next) => {
            const tipo = req.query.type;
    
            if (!tipo) {
                return res.status(400).json({
                    error: 'Tipo de contenido requerido',
                    detalle: 'Debes especificar el tipo de contenido en el query parameter ?type='
                });
            }
    
            const tipoStr = tipo.toString();
            console.log('📤 Tipo de contenido recibido:', tipoStr);
    
            const fileTypes = ['Audios', 'Word', 'Excel', 'PDF', 'AR'];
            
            if (fileTypes.includes(tipoStr)) {
                uploadController.uploadFile(req, res, (err) => {
                    if (err) {
                        return res.status(400).json({
                            error: err.message || 'Error al procesar el archivo',
                            detalle: err.message
                        });
                    }
                    next();
                });
            } else {
                // Para Videos y otros tipos: usar handleFormData (puede tener URL de YouTube o archivo)
                uploadController.handleFormData(req, res, (err) => {
                    if (err) {
                        return res.status(400).json({
                            error: err.message || 'Error al procesar el formulario',
                            detalle: err.message
                        });
                    }
                    next();
                });
            }
        },
        uploadController.handleUpload
    );

    router.post('/upload-prod', uploadProd.uploadProd);

    router.get('/multimedia', multimedia.getMultimedia);
    router.delete('/delete-multimedia', deleteMultimedia);

    return router;
}