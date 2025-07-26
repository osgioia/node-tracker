# Node Tracker

Un BitTorrent Tracker privado desarrollado en Node.js con Express, Prisma y PostgreSQL.

## Características

- **BitTorrent Tracker completo** con soporte HTTP/UDP/WebSocket
- **API REST** para gestión de usuarios, torrents e IPs baneadas
- **Sistema de autenticación JWT** con roles de usuario
- **Sistema de invitaciones** para registro controlado
- **Rate limiting** para protección contra spam
- **Métricas de Prometheus** para monitoreo
- **Logging estructurado** con Winston
- **Base de datos PostgreSQL** con Prisma ORM

## Instalación

1. Clonar el repositorio:
```bash
git clone <repository-url>
cd node-tracker
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. Configurar la base de datos:
```bash
npm run build:dev
```

5. Iniciar el servidor:
```bash
npm start
```

## Configuración

### Variables de Entorno

```env
# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/tracker

# JWT
JWT_SECRET=tu_secreto_super_seguro
JWT_EXPIRES_IN=1h

# Servidor
PORT=3000
TRUST_PROXY=false

# Tracker
UDP=false
HTTP=true
WS=false
ANNOUNCE_INTERVAL=300
STATS=true
```

## Uso

### API REST

La API está documentada en [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

#### Ejemplo de uso:

1. **Registrar usuario:**
```bash
curl -X POST http://localhost:3000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuario123",
    "email": "usuario@example.com",
    "password": "password123"
  }'
```

2. **Login:**
```bash
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuario123",
    "password": "password123"
  }'
```

3. **Agregar torrent:**
```bash
curl -X POST http://localhost:3000/api/torrent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "infoHash": "abc123...",
    "name": "Mi Torrent",
    "category": "Películas"
  }'
```

### BitTorrent Tracker

El tracker está disponible en:
- **HTTP:** `http://localhost:3000/announce`
- **Scrape:** `http://localhost:3000/scrape`

## Estructura del Proyecto

```
src/
├── ipban/              # Gestión de IPs baneadas
│   ├── ipban.router.js
│   └── ipban.service.js
├── middleware/         # Middlewares
│   └── auth.js
├── torrent/           # Gestión de torrents
│   ├── torrent.router.js
│   └── torrent.service.js
├── user/              # Gestión de usuarios
│   ├── user.router.js
│   └── user.service.js
├── utils/             # Utilidades
│   ├── db.server.js
│   └── utils.js
└── router.js          # Router principal

prisma/
└── schema.prisma      # Esquema de base de datos
```

## Modelos de Base de Datos

- **User:** Usuarios del sistema con roles y sistema de invitaciones
- **Torrent:** Torrents con categorías, tags y estadísticas
- **Category:** Categorías de torrents
- **Tag:** Etiquetas para torrents
- **IPBan:** Rangos de IPs baneadas
- **Invite:** Sistema de invitaciones
- **Progress:** Progreso de descarga de usuarios
- **Bookmark:** Marcadores de usuarios

## Scripts

```bash
# Desarrollo
npm start                # Iniciar con nodemon
npm run build:dev       # Generar cliente Prisma + migrar DB (dev)
npm run build          # Generar cliente Prisma + migrar DB (prod)

# Testing
node test-api.js       # Probar la API
```

## Monitoreo

### Métricas de Prometheus
Disponibles en `http://localhost:3000/metrics`

### Health Check
Disponible en `http://localhost:3000/health`

### Logs
- **Consola:** Logs en tiempo real
- **Archivo:** `application.log`
- **HTTP:** `access.log` (en producción)

## Seguridad

- **Autenticación JWT** obligatoria para rutas protegidas
- **Rate limiting** en rutas críticas del tracker
- **Validación de entrada** con express-validator
- **Hashing de contraseñas** con bcrypt
- **Filtrado de torrents** no registrados
- **Sistema de baneos** por IP

## Roles de Usuario

- **USER:** Usuario normal, puede subir torrents y usar el tracker
- **MODERATOR:** Puede moderar contenido
- **ADMIN:** Acceso completo al sistema

## Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

Este proyecto está bajo la Licencia ISC.
