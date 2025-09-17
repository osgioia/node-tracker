import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Node Tracker API',
      version: '1.0.0',
      description: 'API REST para un BitTorrent Tracker privado con gestión de usuarios, torrents e IPs baneadas.',
      contact: {
        name: 'API Support',
        email: 'support@nodetracker.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único del usuario'
            },
            username: {
              type: 'string',
              description: 'Nombre de usuario'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email del usuario'
            },
            role: {
              type: 'string',
              enum: ['USER', 'MODERATOR', 'ADMIN'],
              description: 'Rol del usuario'
            },
            banned: {
              type: 'boolean',
              description: 'Si el usuario está baneado'
            },
            emailVerified: {
              type: 'boolean',
              description: 'Si el email está verificado'
            },
            created: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación'
            },
            uploaded: {
              type: 'integer',
              description: 'Total de bytes subidos por el usuario'
            },
            downloaded: {
              type: 'integer',
              description: 'Total de bytes descargados por el usuario'
            },
            seedtime: {
              type: 'integer',
              description: 'Tiempo total de seed en segundos'
            },
            ratio: {
              type: 'number',
              format: 'float',
              description: 'Ratio de subida/descarga (uploaded/downloaded)'
            }
          }
        },
        Torrent: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único del torrent'
            },
            name: {
              type: 'string',
              description: 'Nombre del torrent'
            },
            description: {
              type: 'string',
              description: 'Descripción del torrent'
            },
            infoHash: {
              type: 'string',
              description: 'Hash único del torrent'
            },
            size: {
              type: 'integer',
              description: 'Tamaño en bytes'
            },
            completed: {
              type: 'integer',
              description: 'Número de descargas completadas'
            },
            downloads: {
              type: 'integer',
              description: 'Número total de descargas'
            },
            anonymous: {
              type: 'boolean',
              description: 'Si el torrent es anónimo'
            },
            freeleech: {
              type: 'boolean',
              description: 'Si el torrent es freeleech'
            }
          }
        },
        IPBan: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único del ban'
            },
            fromIP: {
              type: 'string',
              description: 'IP de inicio del rango (como BigInt string)'
            },
            toIP: {
              type: 'string',
              description: 'IP de fin del rango (como BigInt string)'
            },
            reason: {
              type: 'string',
              description: 'Razón del ban'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensaje de error'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Username o email'
            },
            password: {
              type: 'string',
              description: 'Contraseña'
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Nombre de usuario'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email del usuario'
            },
            password: {
              type: 'string',
              description: 'Contraseña'
            },
            inviteKey: {
              type: 'string',
              description: 'Clave de invitación (opcional)'
            }
          }
        },
        IPBanRequest: {
          type: 'object',
          required: ['fromIP', 'toIP'],
          properties: {
            fromIP: {
              type: 'string',
              description: 'IP de inicio del rango'
            },
            toIP: {
              type: 'string',
              description: 'IP de fin del rango'
            },
            reason: {
              type: 'string',
              description: 'Razón del ban'
            }
          }
        },
        Invitation: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único de la invitación'
            },
            inviteKey: {
              type: 'string',
              description: 'Clave única de invitación'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email del invitado'
            },
            reason: {
              type: 'string',
              description: 'Razón de la invitación'
            },
            expires: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de expiración'
            },
            used: {
              type: 'boolean',
              description: 'Si la invitación ha sido usada'
            },
            inviter: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer'
                },
                username: {
                  type: 'string'
                }
              }
            }
          }
        },
        Category: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único de la categoría'
            },
            name: {
              type: 'string',
              description: 'Nombre de la categoría'
            }
          }
        },
        Tag: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único del tag'
            },
            name: {
              type: 'string',
              description: 'Nombre del tag'
            }
          }
        },
        UserBan: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID único del baneo'
            },
            userId: {
              type: 'integer',
              description: 'ID del usuario baneado'
            },
            reason: {
              type: 'string',
              description: 'Razón del baneo'
            },
            bannedBy: {
              type: 'string',
              description: 'Username del admin/moderador que aplicó el ban'
            },
            bannedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha y hora del baneo'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Fecha de expiración (null para ban permanente)'
            },
            active: {
              type: 'boolean',
              description: 'Si el ban está activo'
            },
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer'
                },
                username: {
                  type: 'string'
                },
                email: {
                  type: 'string',
                  format: 'email'
                }
              }
            }
          }
        },
        UserBanRequest: {
          type: 'object',
          required: ['userId', 'reason'],
          properties: {
            userId: {
              type: 'integer',
              minimum: 1,
              description: 'ID del usuario a banear'
            },
            reason: {
              type: 'string',
              minLength: 5,
              maxLength: 500,
              description: 'Razón del baneo'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de expiración (opcional, null para permanente)'
            }
          }
        },
        QuickBanRequest: {
          type: 'object',
          required: ['userId', 'reason'],
          properties: {
            userId: {
              type: 'integer',
              minimum: 1,
              description: 'ID del usuario a banear'
            },
            reason: {
              type: 'string',
              minLength: 5,
              maxLength: 500,
              description: 'Razón del baneo'
            }
          }
        },
        CustomBanRequest: {
          type: 'object',
          required: ['userId', 'reason', 'days'],
          properties: {
            userId: {
              type: 'integer',
              minimum: 1,
              description: 'ID del usuario a banear'
            },
            reason: {
              type: 'string',
              minLength: 5,
              maxLength: 500,
              description: 'Razón del baneo'
            },
            days: {
              type: 'integer',
              minimum: 1,
              maximum: 365,
              description: 'Número de días del ban'
            }
          }
        },
        UserBanStatus: {
          type: 'object',
          properties: {
            userId: {
              type: 'integer',
              description: 'ID del usuario'
            },
            isBanned: {
              type: 'boolean',
              description: 'Si el usuario está baneado'
            }
          }
        },
        CleanupResult: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Mensaje de resultado'
            },
            cleaned: {
              type: 'integer',
              description: 'Número de bans limpiados'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/**/*.js']
};

const specs = swaggerJsdoc(options);

export { specs, swaggerUi };