# CASA-BACKEND

Backend API desarrollado con Node.js y Express para el sistema CASA. Incluye comunicación en tiempo real mediante Socket.IO, conexión a base de datos MySQL y un sistema robusto de manejo de errores.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Tecnologías](#tecnologías)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Uso](#uso)
- [API Endpoints](#api-endpoints)
- [Socket.IO Events](#socketio-events)
- [Seguridad](#seguridad)
- [Manejo de Errores](#manejo-de-errores)
- [Scripts Disponibles](#scripts-disponibles)

## ✨ Características

- **API RESTful** con Express.js
- **Comunicación en tiempo real** mediante Socket.IO
- **Conexión a MySQL** con pool de conexiones
- **Seguridad mejorada** con Helmet, CORS y rate limiting
- **Manejo robusto de errores** a nivel global
- **Compresión de respuestas** para mejor rendimiento
- **Soporte para múltiples entornos** (desarrollo/producción)
- **Logging de peticiones** con Morgan
- **Validación de datos** con express-validator

## 🛠 Tecnologías

### Dependencias Principales

- **express** (^5.2.1) - Framework web para Node.js
- **socket.io** (^4.8.3) - Biblioteca para comunicación en tiempo real
- **mysql** (^2.18.1) - Cliente MySQL para Node.js
- **helmet** (^8.1.0) - Middleware de seguridad HTTP
- **cors** (^2.8.5) - Middleware para habilitar CORS
- **express-rate-limit** (^8.2.1) - Limitador de tasa de solicitudes
- **express-validator** (^7.3.1) - Validación de datos
- **compression** (^1.8.1) - Compresión de respuestas HTTP
- **morgan** (^1.10.1) - Logger de peticiones HTTP
- **dotenv** (^17.2.3) - Gestión de variables de entorno

### Dependencias de Desarrollo

- **nodemon** (^3.1.11) - Reinicio automático del servidor
- **eslint** (^9.39.2) - Linter de código
- **prettier** (^3.7.4) - Formateador de código

## 📦 Requisitos Previos

- Node.js (versión 14 o superior)
- npm o yarn
- MySQL (versión 5.7 o superior)
- Acceso a la base de datos MySQL configurada

## 🚀 Instalación

1. **Clonar el repositorio**

```bash
git clone <url-del-repositorio>
cd CASA-BACKEND
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Servidor
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Base de Datos - Desarrollo
CASA_HOST_DEV=localhost
CASA_PORT_DEV=3306
CASA_DATABASE_DEV=casa_db_dev
CASA_USERNAME_DEV=usuario
CASA_PASSWORD_DEV=contraseña
CASA_DIALECT_DEV=mysql

# Base de Datos - Producción
CASA_HOST=localhost
CASA_PORT=3306
CASA_DATABASE=casa_db
CASA_USERNAME=usuario
CASA_PASSWORD=contraseña
CASA_DIALECT=mysql
```

## ⚙️ Configuración

### Variables de Entorno

El proyecto utiliza diferentes configuraciones según el entorno (`NODE_ENV`):

- **development**: Usa las variables con sufijo `_DEV`
- **production**: Usa las variables sin sufijo

### CORS y Orígenes Permitidos

Los orígenes permitidos se configuran mediante la variable `ALLOWED_ORIGINS` separados por comas. Estos orígenes se aplican tanto para CORS como para Socket.IO.

### Rate Limiting

El API tiene un limitador de tasa configurado:
- **Ventana**: 15 minutos
- **Máximo de solicitudes**: 1000 por ventana

## 📁 Estructura del Proyecto

```
CASA-BACKEND/
├── config/
│   ├── config.js          # Configuración de base de datos
│   └── pool.js            # Pool de conexiones MySQL
├── middlewares/
│   ├── dbMiddleware.js    # Middleware para inyectar pool de DB
│   └── sockets.js         # Configuración de Socket.IO
├── routes/
│   ├── routes-admin.js    # Rutas de administración
│   ├── routes-login.js    # Rutas de autenticación
│   └── routes-users.js    # Rutas de usuarios
├── index.js               # Archivo principal del servidor
├── package.json           # Dependencias y scripts
└── README.md             # Este archivo
```

## 🎯 Uso

### Modo Desarrollo

```bash
npm start
```

El servidor se iniciará con `nodemon` para reinicio automático en cambios.

### Modo Producción

```bash
NODE_ENV=production node index.js
```

## 🔌 API Endpoints

### Base URL

Todas las rutas están prefijadas con `/casa/v1/`

### Rutas Disponibles

#### Autenticación
- **Base**: `/casa/v1/login/`
- Rutas definidas en `routes/routes-login.js`

#### Usuarios
- **Base**: `/casa/v1/users/`
- Rutas definidas en `routes/routes-users.js`

#### Administración
- **Base**: `/casa/v1/admin/`
- Rutas definidas en `routes/routes-admin.js`

### Archivos Estáticos

Los archivos estáticos se sirven desde:
- **Ruta**: `/FILES/static`
- **Directorio**: `/var/www/html` (configurable)

## 🔒 Seguridad

### Medidas Implementadas

1. **Helmet**: Configurado con políticas de seguridad HTTP personalizadas
   - Content Security Policy
   - Cross-Origin Opener Policy
   - Permissions Policy

2. **CORS**: Configurado con orígenes permitidos específicos

3. **Rate Limiting**: Protección contra abuso de API

4. **Validación**: Express-validator para validar datos de entrada

5. **Compresión**: Respuestas comprimidas para mejor rendimiento

### Configuración de Seguridad

- Los orígenes permitidos se configuran mediante `ALLOWED_ORIGINS`
- El rate limiting permite 1000 solicitudes por 15 minutos
- Las políticas de seguridad están configuradas para permitir iframes desde orígenes permitidos

## 🛡️ Manejo de Errores

El proyecto incluye un sistema completo de manejo de errores:

### Niveles de Manejo

1. **Errores Síncronos Críticos** (`uncaughtException`)
   - Se registran y el proceso se cierra después de 1 segundo

2. **Promesas Rechazadas** (`unhandledRejection`)
   - Se registran pero el proceso continúa

3. **Advertencias** (`warning`)
   - Se registran para monitoreo

4. **Errores del Servidor HTTP**
   - Manejo de errores de puerto en uso
   - Manejo de errores de cliente HTTP

5. **Errores de Socket.IO**
   - Manejo de errores de conexión
   - Manejo de errores del motor de Socket.IO

6. **Errores de Express**
   - Middleware global de manejo de errores
   - Respuestas JSON estructuradas
   - Stack traces en modo desarrollo

### Formato de Errores

Las respuestas de error siguen este formato:

```json
{
  "success": false,
  "status": 500,
  "message": "Mensaje de error",
  "stack": "Stack trace (solo en desarrollo)"
}
```

## 📜 Scripts Disponibles

### `npm start`
Inicia el servidor en modo desarrollo con `nodemon` para reinicio automático.

### `npm test`
Script de prueba (actualmente no implementado).

## 🔧 Configuración de Base de Datos

### Pool de Conexiones

El proyecto utiliza un pool de conexiones MySQL con las siguientes características:

- **Reintentos automáticos**: Si la conexión falla, se reintenta cada 5 segundos
- **Gestión automática**: Las conexiones se liberan automáticamente
- **Configuración por entorno**: Diferentes configuraciones para desarrollo y producción

### Middleware de Base de Datos

Todas las rutas utilizan el middleware `dbMiddleware` que inyecta el pool de conexiones en el objeto `req.db`:

```javascript
// En cualquier ruta
req.db.query('SELECT * FROM tabla', (err, results) => {
  // Manejo de resultados
});
```

## 📝 Notas Adicionales

- El servidor escucha en el puerto especificado en `PORT` (variable de entorno)
- Los archivos estáticos se sirven desde `/var/www/html` (configurable)
- Socket.IO está configurado con recuperación de estado de conexión (hasta 2 minutos)
- Las rutas no encontradas devuelven un error 404 con formato JSON

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

---

**Versión**: 1.0.0
