# API Documentation - Swagger YAML

This project uses a static `swagger.yaml` file to document the Node Tracker REST API.

## 📁 Location

- **Main file**: `/swagger.yaml` (project root)
- **Configuration**: `/src/config/swagger.js`

## 🔧 Configuration

The Swagger configuration has been migrated from JSDoc to a static YAML file for the following advantages:

- **Performance**: No need to parse JSDoc comments at runtime
- **Maintainability**: Centralized documentation that's easier to maintain
- **Standards**: Fully compliant with OpenAPI 3.0 standard
- **Tooling**: Compatible with external OpenAPI tools
- **Clean code**: Removal of redundant JSDoc comments from code files
- **Language**: All documentation in English for international compatibility

⚠️ **Note**: JSDoc `@swagger` comments have been removed from all router files to avoid redundancy. Documentation is maintained exclusively in the `swagger.yaml` file.

## 📝 Estructura del archivo YAML

```yaml
openapi: 3.0.0
info:              # General API information
servers:           # Servers where the API is deployed
components:        # Reusable components
  securitySchemes: # Authentication schemes
  schemas:         # Data models
tags:              # Tags to group endpoints
paths:             # Definition of all endpoints
```

## 🔄 Documentation Updates

### Agregar un nuevo endpoint

1. Define el endpoint en la sección `paths`:

```yaml
paths:
  /api/nuevo-endpoint:
    get:
      summary: Descripción del endpoint
      tags: [NombreTag]
      security:
        - bearerAuth: []
      parameters:
        - in: query
          name: parametro
          schema:
            type: string
      responses:
        200:
          description: Respuesta exitosa
```

2. Si necesitas nuevos schemas, agrégalos en `components.schemas`:

```yaml
components:
  schemas:
    NuevoModelo:
      type: object
      properties:
        id:
          type: integer
        nombre:
          type: string
```

### Actualizar un endpoint existente

1. Busca el endpoint en la sección `paths`
2. Modifica los parámetros, respuestas o descripción según sea necesario
3. Actualiza los schemas relacionados si es necesario

## 🏷️ Tags disponibles

- `Auth`: Autenticación de usuarios
- `Users`: Gestión de usuarios
- `Torrents`: Gestión de torrents
- `Invitations`: Gestión de invitaciones
- `IP Bans`: Gestión de IPs baneadas
- `UserBans`: Gestión de baneos de usuarios
- `Security`: Endpoints de seguridad
- `Health`: Health checks
- `Monitoring`: Métricas

## 🔐 Authentication Schemes

- **bearerAuth**: JWT Bearer token para la mayoría de endpoints protegidos

## 🧪 Validation

Para validar que el archivo YAML es correcto:

```bash
# Validar sintaxis YAML y configuración
npm run validate:swagger

# Limpiar comentarios JSDoc de Swagger (si es necesario)
npm run clean:swagger-jsdoc

# Validar sintaxis YAML manualmente
node --input-type=module -e "
import { readFileSync } from 'fs';
import YAML from 'yaml';

try {
  const swaggerYamlContent = readFileSync('./swagger.yaml', 'utf8');
  const specs = YAML.parse(swaggerYamlContent);
  console.log('✅ YAML válido!');
  console.log('Paths:', Object.keys(specs.paths).length);
  console.log('Schemas:', Object.keys(specs.components.schemas).length);
} catch (error) {
  console.error('❌ Error:', error.message);
}
"
```

## 🌐 Access to Documentation

Una vez que el servidor esté ejecutándose:

- **URL**: `http://localhost:3000/api-docs`
- **Autenticación**: Requiere token JWT válido
- **Rate Limit**: 50 requests por 15 minutos

## 📚 Useful Resources

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger Editor](https://editor.swagger.io/)
- [OpenAPI Generator](https://openapi-generator.tech/)

## ⚠️ Notas importantes

1. **Comentarios JSDoc eliminados** - Los comentarios `@swagger` han sido removidos de todos los routers para evitar redundancia
2. **Mantén sincronizada** la documentación YAML con los cambios en el código
3. **Valida siempre** el YAML después de hacer cambios con `npm run validate:swagger`
4. **Usa referencias** (`$ref`) para evitar duplicación de schemas
5. **Documentación única** - Solo el archivo `swagger.yaml` contiene la documentación de la API