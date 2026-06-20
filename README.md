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

## 🚀 cPanel Deployment (Git-based Setup)

DbNex uses an automated cPanel deployment workflow defined in `.cpanel.yml`:
- **Frontend** is built **locally** (to keep cPanel lightweight and avoid node_modules compiling overhead). The compiled static files (`frontend/dist/`) are committed to Git.
- **Backend** dependencies are installed directly on cPanel, Prisma Client is generated, and database schema is pushed.

### Deployment Steps:

1. **Configure local environment**:
   - Create `frontend/.env.production` and set:
     ```env
     VITE_API_URL=https://api.dbnex.vayunexsolution.com
     ```
   - In `backend/.env`, set production MySQL credentials, JWT secrets, and AES encryption key.

2. **Build frontend locally**:
   ```bash
   cd frontend
   npm run build
   ```
   This generates compiled production files under `frontend/dist/`.

3. **Commit & Push to GitHub**:
   ```bash
   git add .
   git commit -m "chore: build frontend for deployment"
   git push origin main
   ```
   *(Note: `frontend/dist/` is configured to be committed to Git so cPanel can deploy it directly).*

4. **cPanel Auto Deployment**:
   - Configure a **Git Version Control** repository in cPanel pointing to `https://github.com/vayunex-solution/DbNex.git`.
   - cPanel will pull the repository and trigger `.cpanel.yml` to automatically:
     1. Sync backend files to `/home/vayunexs/api.dbnex.vayunexsolution.com/`
     2. Install backend production dependencies
     3. Generate Prisma Client and run `npx prisma db push` (updates database schema without needing a shadow database)
     4. Seed the database with the default owner account
     5. Sync pre-built frontend files to `/home/vayunexs/dbnex.vayunexsolution.com/`

5. **Start backend on cPanel**:
   - Go to **Setup Node.js App** in cPanel.
   - Set Application root to `/home/vayunexs/api.dbnex.vayunexsolution.com/`
   - Set Application URL to `api.dbnex.vayunexsolution.com`
   - Set Startup file to `src/app.js`
   - Click **Run JS Script** or restart the app.


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
