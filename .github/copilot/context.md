
# Node Tracker Context Document

## Project Overview
- **Name**: Node Tracker
- **Description**: Semi-private BitTorrent tracker built with Node.js
- **License**: AGPL-3.0
- **Entry Point**: [`index.js`](index.js:1)
- **Database**: PostgreSQL with Prisma ORM

## Key Features
- BitTorrent tracker (HTTP/UDP/WebSocket)
- JWT authentication with RBAC (USER, MODERATOR, ADMIN)
- User ratio tracking (upload/download)
- Advanced ban system (temporary/permanent bans)
- Invitation-based registration
- Prometheus metrics and structured logging
- Comprehensive REST API

## Core Technologies
- **Runtime**: Node.js 18+
- **Web Framework**: Express
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Metrics**: Prometheus
- **Testing**: Jest

## Project Structure
```
src/
├── auth/              # Authentication logic
├── config/            # Configuration files
├── invitations/       # Invitation system
├── ip-bans/           # IP banning functionality
├── middleware/        # Express middleware
├── security/          # Security utilities
├── torrents/          # Torrent management
├── tracker/           # BitTorrent tracker implementations
├── users/             # User management and bans
├── utils/             # Utilities and helpers
└── router.js          # Main API router
```

## Key Environment Variables
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/tracker
JWT_SECRET=your_secret_key
PORT=3000
UDP=true/false          # Enable UDP tracker
HTTP=true/false         # Enable HTTP tracker
WS=true/false           # Enable WebSocket tracker
ANNOUNCE_INTERVAL=300   # Tracker announce interval
```

## Setup Commands
```bash
npm install             # Install dependencies
npm run build:dev       # Generate Prisma client + run migrations
npm run seed            # Seed database
npm start               # Start development server
```

## API Endpoints
- **Authentication**: `/api/auth/login`, `/api/auth/register`
- **Users**: `/api/users`, `/api/users/me`
- **Bans**: `/api/user-bans`, `/api/user-bans/cleanup`
- **Torrents**: `/api/torrents`
- **Invitations**: `/api/invitations`
- **Tracker**: `/announce`, `/scrape`

## Testing
```bash
npm test                # Run all tests
npm run test:coverage   # Run tests with coverage
npm run lint            # Run linter
```

## Key Files
1. [`prisma/schema.prisma`](prisma/schema.prisma) - Database schema
2. [`src/tracker/tracker-filter.js`](src/tracker/tracker-filter.js) - Tracker filtering logic
3. [`src/middleware/auth.js`](src/middleware/auth.js) - Authentication middleware
4. [`src/users/users.service.js`](src/users/users.service.js) - User service with ratio logic
5. [`src/utils/db.server.js`](src/utils/db.server.js) - Database connection

## Monitoring
- **Metrics**: `http://localhost:3000/metrics`
- **Health Check**: `http://localhost:3000/health`
- **API Docs**: `http://localhost:3000/api-docs`
## Code Conventions

### General Guidelines
- **Formatting**: Use Prettier for code formatting. Configuration can be found in [`eslint.config.js`](eslint.config.js:1)
- **Indentation**: 2 spaces
- **Quotes**: Single quotes for string literals
- **Line Length**: Maximum 120 characters per line
- **Naming**: Use camelCase for variables and functions, PascalCase for classes and constants
- **Comments**: Use // for single-line comments. For multi-line comments, use /* ... */. Write clear and concise comments for complex logic.

### Testing Standards
- Write tests using Jest. Ensure coverage with `npm run test:coverage`

### Security Practices
- Follow OWASP guidelines for secure coding
- Use environment variables for sensitive data