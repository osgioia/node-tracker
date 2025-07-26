# Testing Documentation - Node Tracker

## Descripción

Este proyecto incluye una suite completa de tests unitarios e integración usando Jest. Los tests cubren todas las funcionalidades principales del BitTorrent Tracker.

## Estructura de Tests

```
src/
├── __tests__/
│   └── integration.test.js     # Tests de integración completos
├── user/__tests__/
│   ├── user.service.test.js    # Tests del servicio de usuarios
│   └── user.router.test.js     # Tests del router de usuarios
├── torrent/__tests__/
│   └── torrent.service.test.js # Tests del servicio de torrents
├── ipban/__tests__/
│   └── ipban.service.test.js   # Tests del servicio de IP bans
├── middleware/__tests__/
│   └── auth.test.js            # Tests del middleware de autenticación
└── utils/__tests__/
    └── utils.test.js           # Tests de utilidades
```

## Configuración

### Archivos de configuración:
- `jest.config.js` - Configuración principal de Jest
- `jest.setup.js` - Setup global para mocks y utilidades
- `test-runner.js` - Script personalizado para ejecutar tests

### Dependencias de testing:
```json
{
  "jest": "^29.7.0",
  "supertest": "^7.0.0"
}
```

## Ejecutar Tests

### Comandos básicos:

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests con cobertura
npm run test:coverage

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests con output detallado
npm run test:verbose
```

### Script personalizado:

```bash
# Ejecutar todos los tests con reporte detallado
node test-runner.js

# Ejecutar en modo watch
node test-runner.js --watch

# Solo tests unitarios
node test-runner.js --unit

# Solo tests de integración
node test-runner.js --integration

# Solo reporte de cobertura
node test-runner.js --coverage

# Ver ayuda
node test-runner.js --help
```

## Cobertura de Tests

### Módulos cubiertos:

#### 🔧 User Service (`user.service.js`)
- ✅ Registro de usuarios
- ✅ Autenticación con JWT
- ✅ Gestión de perfiles
- ✅ Sistema de invitaciones
- ✅ Roles y permisos
- ✅ Estadísticas de usuario
- ✅ Baneos de usuarios

#### 🌐 User Router (`user.router.js`)
- ✅ Endpoints públicos (registro/login)
- ✅ Endpoints protegidos (perfil, actualización)
- ✅ Endpoints de admin (listado, baneos)
- ✅ Validación de entrada
- ✅ Manejo de errores
- ✅ Control de acceso

#### 📁 Torrent Service (`torrent.service.js`)
- ✅ Agregar torrents
- ✅ Buscar torrents
- ✅ Actualizar torrents
- ✅ Eliminar torrents
- ✅ Generación de magnet URIs
- ✅ Gestión de categorías y tags

#### 🚫 IPBan Service (`ipban.service.js`)
- ✅ Listar IP bans
- ✅ Crear IP bans
- ✅ Actualizar IP bans
- ✅ Eliminar IP bans
- ✅ Creación masiva de bans

#### 🔐 Auth Middleware (`auth.js`)
- ✅ Validación de tokens JWT
- ✅ Extracción de headers
- ✅ Manejo de tokens inválidos
- ✅ Manejo de tokens expirados
- ✅ Control de acceso

#### 🛠️ Utils (`utils.js`)
- ✅ Verificación de torrents
- ✅ Verificación de IPs baneadas
- ✅ Generación de tokens JWT
- ✅ Logging estructurado
- ✅ Conversión de IPs

#### 🔗 Integration Tests
- ✅ Flujo completo de autenticación
- ✅ Gestión completa de torrents
- ✅ Gestión completa de IP bans
- ✅ Manejo de errores
- ✅ Control de acceso y autorización
- ✅ Seguridad y rate limiting

## Mocking Strategy

### Dependencias mockeadas:

#### Base de datos (Prisma):
```javascript
const mockDb = {
  user: { findFirst, findUnique, create, update, delete, count },
  torrent: { findFirst, create, update, delete },
  iPBan: { findMany, create, update, delete, createMany },
  invite: { findFirst, create, update },
  inviteTreeNode: { create }
};
```

#### Librerías externas:
- `bcrypt` - Hash y comparación de contraseñas
- `jsonwebtoken` - Generación y verificación de JWT
- `magnet-uri` - Generación de magnet links
- `winston` - Sistema de logging
- `prom-client` - Métricas de Prometheus

## Casos de Test

### Tests Unitarios:

#### User Service:
- ✅ Crear usuario exitosamente
- ✅ Manejar usuarios duplicados
- ✅ Validar invitaciones
- ✅ Autenticar credenciales válidas
- ✅ Rechazar credenciales inválidas
- ✅ Obtener perfiles de usuario
- ✅ Actualizar información de usuario
- ✅ Gestionar baneos
- ✅ Crear invitaciones
- ✅ Calcular estadísticas

#### Torrent Service:
- ✅ Agregar torrents con categorías y tags
- ✅ Buscar torrents por infoHash
- ✅ Generar magnet URIs
- ✅ Actualizar información de torrents
- ✅ Eliminar torrents
- ✅ Manejar errores de base de datos

#### IPBan Service:
- ✅ Listar todos los bans
- ✅ Crear bans individuales
- ✅ Crear bans masivos
- ✅ Actualizar bans existentes
- ✅ Eliminar bans
- ✅ Manejar errores de operación

### Tests de Integración:

#### Flujos completos:
- ✅ Registro → Login → Acceso a perfil
- ✅ Agregar → Buscar → Actualizar → Eliminar torrent
- ✅ Listar → Crear → Actualizar → Eliminar IP ban
- ✅ Validación de entrada en todos los endpoints
- ✅ Manejo de errores de base de datos
- ✅ Control de acceso basado en roles

## Métricas de Cobertura

### Objetivos de cobertura:
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

### Generar reporte:
```bash
npm run test:coverage
```

El reporte se genera en:
- `coverage/lcov-report/index.html` - Reporte HTML
- `coverage/lcov.info` - Formato LCOV
- Terminal - Resumen de cobertura

## Debugging Tests

### Ejecutar test específico:
```bash
npx jest src/user/__tests__/user.service.test.js
```

### Ejecutar con debugging:
```bash
npx jest --detectOpenHandles --forceExit
```

### Ver output detallado:
```bash
npx jest --verbose --no-coverage
```

## Continuous Integration

### GitHub Actions ejemplo:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Mejores Prácticas

### Estructura de tests:
1. **Arrange** - Configurar mocks y datos
2. **Act** - Ejecutar la función a testear
3. **Assert** - Verificar resultados

### Naming conventions:
- Archivos: `*.test.js`
- Describe blocks: Nombre del módulo/función
- Test cases: "should [expected behavior] when [condition]"

### Mocking guidelines:
- Mock solo dependencias externas
- Usar mocks específicos por test cuando sea necesario
- Limpiar mocks entre tests con `jest.clearAllMocks()`

### Coverage guidelines:
- Priorizar casos de uso críticos
- Incluir casos de error y edge cases
- Mantener tests simples y enfocados

## Troubleshooting

### Problemas comunes:

#### Tests colgados:
```bash
npx jest --detectOpenHandles --forceExit
```

#### Mocks no funcionan:
- Verificar orden de imports
- Usar `jest.unstable_mockModule()` para ES modules
- Limpiar mocks entre tests

#### Errores de timeout:
```javascript
// En jest.config.js
testTimeout: 10000
```

#### Problemas con ES modules:
```javascript
// En jest.config.js
extensionsToTreatAsEsm: ['.js']
```