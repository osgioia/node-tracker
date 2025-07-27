# Node Tracker

> ⚠️ **WORK IN PROGRESS** - This project is currently under active development. Some features may be incomplete or subject to change. Tests are being updated and documentation may not reflect the current state of the code.

A complete private BitTorrent tracker built with Node.js, Express, and Prisma, featuring authentication, invitation system, metrics, and REST API for advanced management.

---

## 🚀 Key Features

- **BitTorrent Tracker** (HTTP/UDP/WebSocket optional)
- **RESTful API** for users, torrents, invitations, and IP bans
- **JWT Authentication** with role-based access control (USER, MODERATOR, ADMIN)
- **Invitation System** for controlled registration
- **Rate Limiting** and security validations
- **Prometheus Metrics** and structured logging
- **PostgreSQL Database** managed with Prisma ORM
- **Code Quality** with ESLint integration

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

Edit the `.env` file to configure connection parameters and security settings:

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

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | Secret key for JWT tokens | Required |
| `JWT_EXPIRES_IN` | JWT token expiration time | `1h` |
| `PORT` | Server port | `3000` |
| `TRUST_PROXY` | Trust proxy headers | `false` |
| `UDP` | Enable UDP tracker | `false` |
| `HTTP` | Enable HTTP tracker | `true` |
| `WS` | Enable WebSocket tracker | `false` |
| `ANNOUNCE_INTERVAL` | Announce interval in seconds | `300` |

---

## 📚 Usage Guide

### Initial Setup

1. **Create the first admin user:**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "secure_password_123",
    "inviteKey": "bootstrap"
  }'
```

2. **Login to get authentication token:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "secure_password_123"
  }'
```

### User Management

#### Create an invitation:

```bash
curl -X POST http://localhost:3000/api/invitations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "email": "newuser@example.com",
    "reason": "New community member",
    "expiresInDays": 7
  }'
```

#### Register with invitation:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "user_password_123",
    "inviteKey": "<invitation_key_received>"
  }'
```

### Torrent Management

#### Add a torrent:

```bash
curl -X POST http://localhost:3000/api/torrents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "infoHash": "abcdef1234567890abcdef1234567890abcdef12",
    "name": "My Awesome Torrent",
    "category": "Movies",
    "description": "A great movie torrent",
    "tags": ["action", "2024"]
  }'
```

#### Search torrents:

```bash
curl "http://localhost:3000/api/torrents?search=awesome&category=Movies" \
  -H "Authorization: Bearer <your_token>"
```

### Tracker Usage

#### BitTorrent Client Configuration:

- **Announce URL:** `http://localhost:3000/announce`
- **Scrape URL:** `http://localhost:3000/scrape`

#### Manual announce (for testing):

```bash
curl "http://localhost:3000/announce?info_hash=<20_byte_hash>&peer_id=<20_byte_peer_id>&port=6881&uploaded=0&downloaded=0&left=1000000&event=started"
```

---

## 🧩 How the System Works

### General Flow

1. **Controlled Registration:** Users can only register through invitations. Existing users with permissions can generate invitations for others.

2. **Authentication:** Users log in with username and password. JWT tokens are used to authenticate and authorize each request.

3. **Torrent Management:** Authenticated users can add, search, and manage torrents. Administrators can view and manage all torrents.

4. **Role-based Permissions:**
   - **USER:** Can use the tracker, upload torrents, and view their own content
   - **MODERATOR:** Can moderate content and manage users/torrents
   - **ADMIN:** Full system control, users, invitations, and configuration

5. **Security Features:**
   - Rate limiting, data validation, password hashing, and IP banning
   - Access to critical routes restricted by role authorization

6. **Monitoring:** Prometheus metrics and structured logging for system auditing and monitoring

### Invitation System Deep Dive

The invitation system controls who can register on the tracker:

1. **Invitation Generation:**
   - Only authenticated users (usually ADMIN or MODERATOR) can create invitations via API (`POST /api/invitations`)
   - You can specify email, reason, and optional expiration (days of validity)
   - Each invitation generates a unique code (inviteKey) sent to the invitee

2. **Registration with Invitation:**
   - The invited user must register using the received invitation code
   - The system validates that the invitation is active, unused, and not expired
   - Upon successful registration, the invitation is marked as used and cannot be reused

3. **Control and Auditing:**
   - Administrators can list, revoke, or delete invitations
   - All invitations are logged with their status (used, active, expired)

**Benefits:**
- Maintains a closed and secure community
- Prevents mass or automated registrations
- Provides traceability of who invited whom

---

## 🗂️ Project Structure

```
src/
├── auth/              # Authentication and login
├── config/            # Configuration files
├── invitations/       # Invitation system
├── ip-bans/          # IP banning system
├── middleware/        # Middleware (auth, security, etc)
├── security/          # Security utilities
├── torrents/          # Torrent management and API
├── users/             # User management and API
├── utils/             # Utilities and database
└── router.js          # Main router

prisma/
├── migrations/        # Database migrations
└── schema.prisma      # Database schema

scripts/
├── security-audit.js  # Security auditing script
├── test-api.js       # API testing script
└── test-runner.js    # Test runner utility
```

---

## 🗄️ Database Models

### Core Models

- **User:** User accounts, roles, authentication
- **Torrent:** Torrent metadata, categories, statistics
- **Invite:** Invitation system management
- **IPBan:** IP address banning
- **Bookmark:** User bookmarks/favorites
- **Progress:** User download progress tracking

### Relationships

- Users can have multiple torrents
- Users can create and use invitations
- Torrents can be bookmarked by users
- Progress tracks user interaction with torrents

---

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with configurable expiration
- Role-based access control (RBAC)
- Secure password hashing with bcrypt
- Protected routes with middleware validation

### Rate Limiting & Protection
- Configurable rate limiting on critical endpoints
- IP-based banning system
- Request validation with express-validator
- CORS and security headers with Helmet

### Data Validation
- Input sanitization and validation
- SQL injection prevention with Prisma ORM
- XSS protection
- CSRF protection for state-changing operations

---

## 📊 Monitoring & Observability

### Metrics (Prometheus)
Access metrics at: `http://localhost:3000/metrics`

Available metrics:
- HTTP request duration and count
- Active connections
- Database query performance
- Custom business metrics

### Health Checks
- **Health endpoint:** `http://localhost:3000/health`
- **Database connectivity check**
- **System resource monitoring**

### Logging
- Structured logging with Winston
- Multiple log levels (error, warn, info, debug)
- File-based logging (`application.log`)
- Request logging with Morgan

---

## 🧪 Testing & Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

### Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Check for linting issues (strict mode)
npm run lint:check
```

### API Testing

```bash
# Manual API testing script
node scripts/test-api.js

# Security audit
node scripts/security-audit.js
```

### Development Scripts

```bash
# Start with auto-reload
npm start

# Database operations
npm run build:dev    # Generate Prisma client + run migrations (dev)
npm run build        # Generate Prisma client + deploy migrations (prod)
```

---

## 🚀 Deployment

### Production Setup

1. **Environment Configuration:**
```bash
# Set production environment variables
export NODE_ENV=production
export DATABASE_URL=postgresql://user:pass@prod-db:5432/tracker
export JWT_SECRET=your_production_secret
```

2. **Database Migration:**
```bash
npm run build
```

3. **Start Production Server:**
```bash
npm start
```

### Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Reverse Proxy Configuration (Nginx)

```nginx
server {
    listen 80;
    server_name your-tracker.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Make your changes and add tests**
4. **Run the linter:** `npm run lint:fix`
5. **Run tests:** `npm test`
6. **Commit your changes:** `git commit -m 'Add amazing feature'`
7. **Push to your branch:** `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style (enforced by ESLint)
- Write tests for new features
- Update documentation as needed
- Use meaningful commit messages
- Keep PRs focused and atomic

---

## 📖 API Documentation

### Interactive Documentation

Once you start the application, access the interactive Swagger documentation at:

**🔗 [http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

The Swagger documentation includes:
- All available endpoints with examples
- Request/response schemas
- Interactive API testing
- Integrated JWT authentication
- Real-time API exploration

### API Endpoints Overview

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/auth/login` | POST | User authentication | No |
| `/api/auth/register` | POST | User registration | No |
| `/api/users` | GET | List users | Yes (Admin) |
| `/api/users/:id` | GET/PUT/DELETE | User management | Yes |
| `/api/torrents` | GET/POST | Torrent operations | Yes |
| `/api/torrents/:id` | GET/PUT/DELETE | Torrent management | Yes |
| `/api/invitations` | GET/POST | Invitation management | Yes (Moderator+) |
| `/api/ip-bans` | GET/POST/DELETE | IP ban management | Yes (Admin) |
| `/announce` | GET | BitTorrent announce | No |
| `/scrape` | GET | BitTorrent scrape | No |
| `/metrics` | GET | Prometheus metrics | No |
| `/health` | GET | Health check | No |

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

### What this means:

- ✅ **Freedom to use:** You can use this software for any purpose
- ✅ **Freedom to study:** You can examine and modify the source code
- ✅ **Freedom to share:** You can redistribute the software
- ✅ **Freedom to improve:** You can distribute modified versions

### Requirements:

- 📋 **Source disclosure:** If you distribute this software, you must provide the source code
- 📋 **License preservation:** You must include the original license and copyright notices
- 📋 **Network use:** If you run this software on a server and users interact with it over a network, you must provide the source code to those users
- 📋 **Same license:** Any derivative works must be licensed under AGPL-3.0

### Why AGPL-3.0?

The AGPL-3.0 license ensures that improvements to this tracker remain open source and benefit the entire community, even when the software is used as a web service. This promotes collaboration and prevents proprietary forks that don't contribute back to the community.

For the full license text, see the [LICENSE](LICENSE) file in this repository or visit: https://www.gnu.org/licenses/agpl-3.0.html

---

## 🆘 Support & Community

- **Issues:** Report bugs and request features on [GitHub Issues](https://github.com/your-repo/node-tracker/issues)
- **Discussions:** Join community discussions on [GitHub Discussions](https://github.com/your-repo/node-tracker/discussions)
- **Security:** Report security vulnerabilities privately to [security@your-domain.com]

---

## 🙏 Acknowledgments

- Built with [Node.js](https://nodejs.org/) and [Express](https://expressjs.com/)
- Database management with [Prisma](https://www.prisma.io/)
- Authentication powered by [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)
- Code quality ensured by [ESLint](https://eslint.org/)
- Testing with [Jest](https://jestjs.io/)
- Metrics with [prom-client](https://github.com/siimon/prom-client)

---

*Made with ❤️ for the open source community*
