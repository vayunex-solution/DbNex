# DbNex — Database Intelligence Platform
## by Vayunex Solution

> Compare, Analyze & Synchronize SQL Server Databases

---

## 🏗️ Monorepo Structure

```
dbnex/
├── backend/              # Node.js + Express + Prisma + MySQL
│   ├── prisma/
│   │   ├── schema.prisma # Full DB schema (Org → User → Project → History → Logs → Audit)
│   │   └── seed.js       # Default org & admin user
│   └── src/
│       ├── app.js        # Express entry point
│       ├── config/       # Prisma client
│       ├── controllers/  # auth, project, compare, execute
│       ├── middleware/   # JWT auth, error handler, 404
│       ├── routes/       # All route files
│       ├── services/     # ExtractorService, ComparatorService, RiskAnalyzerService, ScriptRunnerService, AuditService
│       └── utils/        # Logger, AppError, AES encryption
├── frontend/             # React 18 + Vite + Tailwind + Zustand + Monaco
│   └── src/
│       ├── layouts/      # AppLayout, AuthLayout
│       ├── pages/        # All 9 pages
│       ├── components/   # Sidebar, Header, MobileDrawer
│       ├── stores/       # authStore, themeStore, compareStore
│       └── lib/          # Axios instance with interceptors
├── .cpanel.yml           # cPanel deployment config
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, etc.

npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173  
API:  http://localhost:5000

**Default Login:**
- Email: `admin@vayunexsolution.com`
- Password: `Admin@DbNex123`

---

## ⚙️ Environment Variables (Backend)

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string for Prisma |
| `JWT_SECRET` | 64+ char secret for access tokens |
| `JWT_REFRESH_SECRET` | 64+ char secret for refresh tokens |
| `ENCRYPTION_KEY` | 32 char key for AES-256 credential encryption |
| `FRONTEND_URL` | CORS origin (frontend URL) |
| `PORT` | API port (default 5000) |

---

## 🛡️ Security Features

- **AES-256-GCM** encryption for all stored MSSQL credentials
- **JWT** with rotating refresh tokens
- **Role-based access** (OWNER / ADMIN / MEMBER / VIEWER)
- **Rate limiting** on all API endpoints
- **Helmet.js** HTTP security headers
- **Risk Analysis** before any script execution
- **Full Audit Trail** for enterprise compliance

---

## 🗄️ Database Schema (MySQL via Prisma)

| Table | Purpose |
|---|---|
| `organizations` | Multi-tenant isolation |
| `users` | Users with roles |
| `refresh_tokens` | JWT refresh token rotation |
| `projects` | Saved MSSQL connection pairs |
| `compare_history` | Compare run history |
| `execution_logs` | Script execution logs with batch details |
| `audit_logs` | Full enterprise audit trail |

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/test-connection` | Test MSSQL connection |
| POST | `/api/compare` | Run schema comparison |
| GET | `/api/history` | Compare history |
| POST | `/api/execute/analyze` | Analyze script risk |
| POST | `/api/execute/run` | Execute sync script |
| GET | `/api/execute/logs` | Execution logs |
| GET | `/api/audit` | Audit trail (Admin/Owner only) |
| GET | `/api/organizations/stats` | Dashboard stats |

---

## 🚀 cPanel Deployment

1. Upload the `dbnex` folder to your server
2. Create MySQL database in cPanel
3. Upload `.env` with production values
4. Set Node.js app root to `backend/` in cPanel Node.js App Manager
5. Set startup file to `src/app.js`
6. Run `npm install` and `npx prisma migrate deploy`
7. Build frontend: `npm run build` in `frontend/`
8. Point domain to `frontend/dist/` as document root
9. Configure reverse proxy for `/api` → `localhost:5000`

---

## 🗺️ Future Roadmap (DbNex Ecosystem)

| Module | Status |
|---|---|
| DbNex Compare | ✅ v1.0 (Current) |
| DbNex Sync | 🔄 Q3 2025 |
| DbNex Deploy | 🔄 Q4 2025 |
| DbNex Audit | 📅 2026 |
| DbNex Backup | 📅 2026 |
| DbNex Monitor | 📅 2026 |

---

© 2025 Vayunex Solution. All rights reserved.
