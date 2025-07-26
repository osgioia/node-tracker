# API Documentation - Node Tracker

## Descripción
API REST para un BitTorrent Tracker privado con gestión de usuarios, torrents e IPs baneadas.

## Autenticación
La mayoría de endpoints requieren autenticación JWT. Incluir el token en el header:
```
Authorization: Bearer <token>
```

## Endpoints

### Usuarios

#### Registro (Público)
```http
POST /api/user/register
Content-Type: application/json

{
  "username": "usuario123",
  "email": "usuario@example.com",
  "password": "password123",
  "inviteKey": "inv_1234567890_abc123def" // Opcional
}
```

#### Login (Público)
```http
POST /api/user/login
Content-Type: application/json

{
  "username": "usuario123", // o email
  "password": "password123"
}
```

**Respuesta:**
```json
{
  "message": "Login exitoso",
  "user": {
    "id": 1,
    "username": "usuario123",
    "email": "usuario@example.com",
    "role": "USER",
    "emailVerified": false
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Obtener Perfil (Protegido)
```http
GET /api/user/profile
Authorization: Bearer <token>
```

#### Obtener Usuario por ID (Protegido)
```http
GET /api/user/:id
Authorization: Bearer <token>
```

#### Actualizar Usuario (Protegido)
```http
PUT /api/user/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "nuevoUsername",
  "email": "nuevo@example.com",
  "password": "nuevaPassword"
}
```

#### Crear Invitación (Protegido)
```http
POST /api/user/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "invitado@example.com",
  "reason": "Amigo de confianza",
  "expiresInDays": 7
}
```

#### Listar Usuarios (Solo Admin)
```http
GET /api/user?page=1&limit=20
Authorization: Bearer <token>
```

#### Banear/Desbanear Usuario (Solo Admin)
```http
PATCH /api/user/:id/ban
Authorization: Bearer <token>
Content-Type: application/json

{
  "banned": true,
  "reason": "Violación de reglas"
}
```

### Torrents

#### Obtener Torrent por InfoHash (Protegido)
```http
GET /api/torrent/:infoHash
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "magnetUri": "magnet:?xt=urn:btih:abc123...&dn=Nombre+del+Torrent&tr=http://localhost:3000/announce"
}
```

#### Agregar Torrent (Protegido)
```http
POST /api/torrent
Authorization: Bearer <token>
Content-Type: application/json

{
  "infoHash": "abc123def456...",
  "name": "Nombre del Torrent",
  "category": "Películas",
  "tags": "acción, 2023, hd"
}
```

#### Actualizar Torrent (Protegido)
```http
PUT /api/torrent/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Nuevo nombre",
  "description": "Nueva descripción"
}
```

#### Eliminar Torrent (Protegido)
```http
DELETE /api/torrent/:id
Authorization: Bearer <token>
```

### IP Bans

#### Listar IPs Baneadas (Protegido)
```http
GET /api/ipban
Authorization: Bearer <token>
```

#### Agregar IP Ban (Protegido)
```http
POST /api/ipban
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromIP": "192.168.1.1",
  "toIP": "192.168.1.255",
  "reason": "Spam"
}
```

#### Actualizar IP Ban (Protegido)
```http
PUT /api/ipban/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromIP": "192.168.1.1",
  "toIP": "192.168.1.100",
  "reason": "Spam actualizado"
}
```

#### Eliminar IP Ban (Protegido)
```http
DELETE /api/ipban/:id
Authorization: Bearer <token>
```

#### Agregar IPs en Lote (Protegido)
```http
POST /api/ipban/bulk
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "fromIP": "10.0.0.1",
    "toIP": "10.0.0.255",
    "reason": "Red corporativa"
  },
  {
    "fromIP": "172.16.0.1",
    "toIP": "172.16.255.255",
    "reason": "Red privada"
  }
]
```

## Endpoints del Tracker

### Announce (Público)
```http
GET /announce?info_hash=<hash>&peer_id=<id>&port=<port>&uploaded=<bytes>&downloaded=<bytes>&left=<bytes>
```

### Scrape (Público)
```http
GET /scrape?info_hash=<hash>
```

## Métricas y Monitoreo

### Métricas de Prometheus
```http
GET /metrics
```

### Health Check
```http
GET /health
```

## Códigos de Estado HTTP

- `200` - OK
- `201` - Creado
- `204` - Sin contenido
- `400` - Solicitud incorrecta
- `401` - No autorizado
- `403` - Prohibido
- `404` - No encontrado
- `500` - Error interno del servidor

## Roles de Usuario

- `USER` - Usuario normal
- `MODERATOR` - Moderador
- `ADMIN` - Administrador

## Variables de Entorno

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tracker
JWT_SECRET=tu_secreto_jwt
JWT_EXPIRES_IN=1h
PORT=3000
UDP=false
HTTP=true
WS=false
ANNOUNCE_INTERVAL=300
TRUST_PROXY=false
STATS=true
```