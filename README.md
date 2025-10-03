# Node Tracker

> ⚠️ **IN DEVELOPMENT** - This project is actively being developed. Some features may be incomplete or subject to changes. Tests are being updated and documentation may not reflect the current state of the code.

A complete BitTorrent Tracker built with Node.js, Express, and Prisma, featuring authentication, invitation system, metrics, and REST API for advanced management.

---

## 🚀 Main Features

- **BitTorrent Tracker** (HTTP/UDP/WebSocket optional)
- **REST API** for users, torrents, invitations, and IP bans
- **JWT Authentication** with role-based access control (USER, MODERATOR, ADMIN)
- **Ratio System** tracking uploads/downloads and automatic calculation
- **Advanced User Ban System** with temporary and permanent bans
- **Invitation System** for controlled registration
- **Rate Limiting** and security validations
- **Prometheus Metrics** and structured logging
- **PostgreSQL Database** managed with Prisma ORM
- **Code Quality** with ESLint integration and testing infrastructure

---

## 🛠️ Quick Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Setup Steps

1. **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd node-tracker
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Configure environment variables:**

    ```bash
    cp .env.example .env
    # Edit .env with your configuration (DB, JWT, etc)
    ```

4. **Set up the database:**

    ```bash
    npm run build:dev
    ```

5. **Start the application:**

    ```bash
    npm start
    ```

    The tracker will be available at `http://localhost:3000`

---

## ⚙️ Configuration

Edit the `.env` file to configure connection and security parameters:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/tracker

# JWT Configuration
JWT_SECRET=your_super_secure_secret_key_here
JWT_EXPIRES_IN=1h

# Server Configuration
PORT=3000
TRUST_PROXY=false

# Tracker Configuration
UDP=false
HTTP=true
WS=false
ANNOUNCE_INTERVAL=300
STATS=true

# Security
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### Environment Variables Reference

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | Secret key for JWT tokens | Required |
| `JWT_EXPIRES_IN` | JWT expiration time | `1h` |
| `PORT` | Server port | `3000` |
| `TRUST_PROXY` | Trusted proxy headers | `false` |
| `UDP` | Enable UDP tracker | `false` |
| `HTTP` | Enable HTTP tracker | `true` |
| `WS` | Enable WebSocket tracker | `false` |
| `ANNOUNCE_INTERVAL` | Announce interval in seconds | `300` |

---

## 🧪 Testing

The project includes comprehensive test coverage. Run:

## 📚 API Documentation

The API is fully documented using OpenAPI 3.0 specification.

- **Access**: `http://localhost:3000/api-docs` (requires authentication)
- **Format**: YAML specification in `/swagger.yaml`
- **Guide**: See `/docs/swagger-guide.md` for documentation maintenance

### Available Endpoints

- **Authentication**: `/api/auth/*` - User login/logout
- **Users**: `/api/users/*` - User management (admin)
- **Torrents**: `/api/torrents/*` - Torrent CRUD operations
- **Invitations**: `/api/invitations/*` - Invitation system
- **User Bans**: `/api/user-bans/*` - User ban management
- **IP Bans**: `/api/ip-bans/*` - IP ban management
- **Security**: `/api/security/*` - Security endpoints
- **Monitoring**: `/health`, `/metrics` - Health checks and metrics

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test:watch

# Run linting
npm run lint
```

---

---

## 🚀 Docker Deployment

The project includes a `docker-compose.yml` file for Docker deployment:

```bash
docker-compose up -d
```

### Environment Variables for Docker

```bash
docker-compose up -d --env-file .env
