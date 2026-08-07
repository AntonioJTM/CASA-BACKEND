/**
 * Normalización del color de identidad de un paquete (PAQ_COLOR).
 *
 * El color es un dato de presentación: aquí solo se valida y se guarda.
 * Elegir la paleta y decidir qué mostrar cuando no hay color es cosa del front.
 */

/** Acepta '#RGB' o '#RRGGBB' (con o sin '#') y devuelve '#RRGGBB' en mayúsculas, o null. */
function normalizarColorHex(valor) {
    if (valor == null || valor === '') return null;

    const s = String(valor).trim().replace(/^#/, '');

    if (/^[0-9a-fA-F]{3}$/.test(s)) {
        const [r, g, b] = s.split('');
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    if (/^[0-9a-fA-F]{6}$/.test(s)) {
        return `#${s}`.toUpperCase();
    }
    return null;
}

module.exports = { normalizarColorHex };
