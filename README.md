# Node Tracker

> ⚠️ **WORK IN PROGRESS** - Este proyecto está actualmente en desarrollo activo. Algunas funcionalidades pueden estar incompletas o experimentar cambios. Los tests están siendo actualizados y la documentación puede no reflejar el estado actual del código.

Un tracker BitTorrent privado y completo, desarrollado en Node.js, Express y Prisma, con autenticación, sistema de invitaciones, métricas y API REST para gestión avanzada.

---

## 🚀 Características principales

- **Tracker BitTorrent** (HTTP/UDP/WebSocket opcional)
- **API RESTful** para usuarios, torrents, invitaciones y baneos
- **Autenticación JWT** y control de roles (USER, MODERATOR, ADMIN)
- **Sistema de invitaciones** para registro controlado
- **Rate limiting** y validaciones de seguridad
- **Métricas Prometheus** y logging estructurado
- **Base de datos PostgreSQL** gestionada con Prisma ORM

---

## 🛠️ Instalación rápida

1. **Clona el repositorio:**

```bash
git clone <repository-url>
cd node-tracker
```

2. **Instala las dependencias:**

```bash
npm install
```

3. **Configura las variables de entorno:**

```bash
cp .env.example .env
# Edita .env con tus datos (DB, JWT, etc)
```

4. **Prepara la base de datos:**

```bash
npm run build:dev
```

5. **Inicia la aplicación:**

```bash
npm start
```

---

## ⚙️ Configuración

Edita el archivo `.env` para definir los parámetros de conexión y seguridad:

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/tracker
JWT_SECRET=tu_secreto_super_seguro
JWT_EXPIRES_IN=1h
PORT=3000
TRUST_PROXY=false
UDP=false
HTTP=true
WS=false
ANNOUNCE_INTERVAL=300
STATS=true
```

---

## 📚 Uso básico

### 1. **Registro y login de usuario**

```bash
curl -X POST http://localhost:3000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"username": "usuario123", "email": "usuario@example.com", "password": "password123"}'

curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username": "usuario123", "password": "password123"}'
```

### 2. **Agregar un torrent**

```bash
curl -X POST http://localhost:3000/api/torrent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"infoHash": "abc123...", "name": "Mi Torrent", "category": "Películas"}'
```

### 3. **Usar el tracker**

- Anuncia: `http://localhost:3000/announce`
- Scrape: `http://localhost:3000/scrape`

---

## 🧩 ¿Cómo funciona el sistema?

### Flujo general

1. **Registro controlado:** Solo se pueden registrar usuarios mediante invitación (invite). Un usuario existente con permisos puede generar invitaciones para otros.
2. **Autenticación:** Los usuarios inician sesión con usuario y contraseña. Se utiliza JWT para autenticar y autorizar cada petición.
3. **Gestión de torrents:** Los usuarios autenticados pueden agregar, buscar y administrar torrents. Los administradores pueden ver y gestionar todos los torrents.
4. **Roles y permisos:**
   - **USER:** Puede usar el tracker, subir torrents y ver los suyos.
   - **MODERATOR:** Puede moderar contenido y gestionar usuarios/torrents.
   - **ADMIN:** Control total sobre el sistema, usuarios, invitaciones y configuración.
5. **Seguridad:**
   - Rate limiting, validación de datos, hashing de contraseñas y baneos de IP.
   - Acceso a rutas críticas solo para roles autorizados.
6. **Monitoreo:** Métricas Prometheus y logs para auditar y monitorear el sistema.

---

### 🔗 ¿Cómo funciona el sistema de invitaciones?

El sistema de invitaciones permite controlar quién puede registrarse en el tracker. Así funciona:

1. **Generación de invitaciones:**

   - Solo usuarios autenticados (usualmente ADMIN o MODERATOR) pueden crear invitaciones desde la API (`POST /api/invitations`).
   - Se puede especificar un email, motivo y una expiración opcional (días de validez).
   - Cada invitación genera un código único (inviteKey) que se envía al invitado.

2. **Registro con invitación:**

   - El usuario invitado debe registrarse usando el código de invitación recibido.
   - El sistema valida que la invitación esté activa, no usada y no expirada.
   - Al completar el registro, la invitación se marca como usada y no puede reutilizarse.

3. **Control y auditoría:**
   - Los administradores pueden listar, revocar o eliminar invitaciones.
   - Todas las invitaciones quedan registradas con su estado (usada, activa, expirada).

**Ventajas:**

- Permite mantener la comunidad cerrada y segura.
- Evita registros masivos o automatizados.
- Da trazabilidad sobre quién invitó a quién.

---

## 🗂️ Estructura del proyecto

```
src/
├── auth/           # Autenticación y login
├── invitations/    # Sistema de invitaciones
├── ip-bans/        # Baneo de IPs
├── ipban/          # Alternativa de baneo de IPs
├── middleware/     # Middlewares (auth, etc)
├── torrent/        # Gestión de torrents
├── torrents/       # API de torrents
├── user/           # Gestión de usuarios
├── users/          # API de usuarios
├── utils/          # Utilidades y DB
└── router.js       # Router principal
prisma/
└── schema.prisma   # Esquema de base de datos
```

---

## 🗄️ Modelos principales

- **User:** Usuarios, roles, invitaciones
- **Torrent:** Torrents, categorías, tags, estadísticas
- **IPBan:** IPs baneadas
- **Invite:** Invitaciones
- **Bookmark, Progress:** Favoritos y progreso de usuario

---

## 🔒 Seguridad y buenas prácticas

- Autenticación JWT obligatoria en rutas protegidas
- Rate limiting en endpoints críticos
- Validación de datos con express-validator
- Contraseñas hasheadas con bcrypt
- Baneo de IPs y control de acceso por roles

---

## 📊 Monitoreo y logs

- **Métricas Prometheus:** `http://localhost:3000/metrics`
- **Health check:** `http://localhost:3000/health`
- **Logs:** consola y archivos (`application.log`, `access.log`)

---

## 🧪 Testing

- Ejecuta todos los tests:
  ```bash
  npm test
  ```
- Prueba la API manualmente:

```bash
  node test-api.js
```

---

## 🤝 Contribuir

1. Haz fork del proyecto
2. Crea una rama (`git checkout -b feature/NuevaFeature`)
3. Haz commit de tus cambios
4. Haz push a tu rama
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

---

## 📖 Documentación de la API

Una vez que inicies la aplicación, puedes acceder a la documentación interactiva de Swagger en:

**🔗 [http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

La documentación de Swagger incluye:

- Todos los endpoints disponibles
- Esquemas de request/response
- Ejemplos interactivos
- Autenticación JWT integrada
- Posibilidad de probar la API directamente desde el navegador

> **Nota:** También puedes consultar [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) para referencia adicional, aunque Swagger es la fuente más actualizada.
