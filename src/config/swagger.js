import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load Swagger YAML file from project root
// This file contains all API documentation in OpenAPI 3.0 format
const swaggerYamlPath = join(__dirname, '../../swagger.yaml');
const swaggerYamlContent = readFileSync(swaggerYamlPath, 'utf8');
const specs = YAML.parse(swaggerYamlContent);

export { specs, swaggerUi };