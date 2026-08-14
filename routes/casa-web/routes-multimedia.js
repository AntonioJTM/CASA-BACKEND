const express = require('express');
const router = express.Router();

const multimediaController = require('../../controllers/casa-web/multimedia.controller');

module.exports = () => {
    router.post('/mostrarMultimedia', multimediaController.allMultimedia);
    router.post('/mostrarGradosSubtipo', multimediaController.allGradosSubtipo);
    router.post('/mostrarMultimediaSubtipo', multimediaController.allMultimediaSubtipo);
    router.post('/mostrarArItems', multimediaController.allArItems);
    router.post('/mostrarMaterias', multimediaController.allMaterias);
    router.post('/mostrarMultimediaPorMaterias', multimediaController.allMultimediaPorMaterias);
    router.post('/mostrarPorTipoMultimedia', multimediaController.allPorTipoMultimedia);
    router.post('/mostrarGradosPorLicencia', multimediaController.allGradosPorLicencia);
    router.post('/allMateriasPorLicenciaGrado', multimediaController.allMateriasPorLicenciaGrado);
    return router;
}