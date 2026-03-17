# Migration Guide: WordPress Plugin → Standalone Webapp + Daily Log Blogging Platform

## Executive Summary

This document outlines a phased approach to:
1. **Decouple** the mentorship platform from WordPress
2. **Migrate** data and auth to a standalone backend (Node.js/Express or similar)
3. **Integrate** a robust blogging platform for daily location-based logs
4. **Preserve** existing functionality during transition

**Timeline**: 6–10 weeks (depending on team size)  
**Complexity**: High (database migration, auth rewrite, data integrity)  
**Risk**: Medium (requires careful data migration & testing)

---

## Phase 1: Analysis & Planning (1 week)

### Step 1.1: Audit Current State

**Objective**: Document all WordPress dependencies and data structures.

**Tasks**:
- [ ] List all WP dependencies in plugin code:
  - `wp_*` functions used (get_post, get_user, update_user_meta, etc.)
  - WP hooks (actions/filters registered)
  - WP REST API usage
  - WP capabilities/roles used
  - WP tables used (wp_posts, wp_users, wp_postmeta, wp_usermeta, wp_pg_user_metadata)
  
- [ ] Document data structure:
  - Custom post types: mp_request, mp_goal, mp_initiative, mp_task, mp_meeting, mp_update
  - Custom user meta: _mentor_opt_in, _skills, _bio_details, _experience, _linkedin_url, _custom_links, _tagline, _is_portfolio, _receiver_id, _status, _mentorship_id, _goal_id
  - Custom table: wp_pg_user_metadata (archived, employee_id, job_title, etc.)
  - Any custom taxonomies?
  
- [ ] Inventory of integrations:
  - BuddyBoss usage (if any)
  - Email hooks
  - Cron jobs
  - Admin settings (if any WordPress settings stored)

**Deliverable**: `CURRENT_STATE_AUDIT.md` (list of all WP functions/hooks/data)

---

### Step 1.2: Design Target Architecture

**Objective**: Decide the new tech stack and data model.

**Recommended Stack**:
- **Backend**: Node.js + Express (familiar to many, good ecosystem)
  - Alternatively: Django/Python, Ruby on Rails, or Go (depends on team)
- **Database**: PostgreSQL (more robust than MySQL for this use case, better performance)
  - Keep user management local or integrate with OAuth provider (Auth0, Google, etc.)
- **Frontend**: Keep React + TypeScript (no changes needed)
- **Blogging Platform**: 
  - Option A: Build custom (full control, ~4 weeks)
  - Option B: Use headless CMS (Strapi, Hygraph, Sanity — reduces work to ~1–2 weeks)
  - Option C: Use library (e.g., Tiptap, Lexical, Slate) + custom backend (middle ground, ~2–3 weeks)
- **Hosting**: AWS ECS/Fargate, Heroku, DigitalOcean, or Render (serverless options best for scaling)

**Decision matrix**:

| Component | Build Custom | Use Library/Headless CMS | Pros | Cons |
|-----------|--------------|-------------------------|------|------|
| Blogging | Full custom | Strapi/Sanity | Full control | More time |
| Auth | Custom JWT | Auth0/Firebase | Delegated, secure | Cost, vendor lock-in |
| Database | PostgreSQL | PostgreSQL | Familiar, robust | Setup required |
| Deployment | Docker + K8s | Docker + Heroku/ECS | Scalable | More ops |

**Deliverable**: `ARCHITECTURE.md` (stack diagram, DB schema, auth flow, deployment model)

---

### Step 1.3: Plan Data Migration

**Objective**: Design migration scripts to move WordPress data to new backend.

**Tasks**:
- [ ] Design new PostgreSQL schema (mirror WP structure but optimize for non-WP world):
  ```sql
  -- Example new schema (pseudo)
  users (id, email, password_hash, first_name, last_name, avatar_url, created_at)
  user_profiles (user_id, tagline, bio_details, experience, linkedin_url, mentor_opt_in)
  mentorships (id, mentee_id, mentor_id, status, created_at)
  goals (id, mentorship_id, title, description, status, is_portfolio, created_at)
  logs (id, user_id, title, content, location, category, created_at, updated_at)  # NEW!
  log_categories (id, name, icon, color)  # For consistent log locations
  ...
  ```

- [ ] Write migration scripts (Node.js + Database library like Sequelize or Prisma):
  - Export data from WP (via REST API or direct DB dump)
  - Transform to new schema
  - Validate data integrity
  - Handle missing/orphaned records
  - Import into new DB

- [ ] Plan password migration:
  - Option A: Users reset password on first login (safest)
  - Option B: Migrate hashes if compatible (riskier)
  - Option C: Use temporary tokens to set password

**Deliverable**: `MIGRATION_SCRIPTS.md` + sample scripts in `scripts/migrate/`

---

## Phase 2: Backend Setup & Data Migration (2–3 weeks)

### Step 2.1: Set Up New Backend Project

**Objective**: Create standalone Node.js + Express app with new DB schema.

**Tasks**:
```bash
# 1. Create project
mkdir mentorship-platform-api
cd mentorship-platform-api

# 2. Initialize Node project
npm init -y
npm install express cors dotenv pg sequelize # or Prisma

# 3. Create folder structure
mkdir -p src/{models,controllers,routes,middleware,utils,services}
mkdir migrations
mkdir tests
```

**Sample `src/models/User.js`** (using Sequelize):
```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    passwordHash: DataTypes.STRING,
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    avatarUrl: DataTypes.STRING,
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: DataTypes.DATE,
  });
  return User;
};
```

**Sample `.env.example`**:
```
DATABASE_URL=postgres://user:password@localhost:5432/mentorship_platform
JWT_SECRET=your-secret-key
JWT_EXPIRY=7d
NODE_ENV=development
PORT=3001
REACT_APP_API_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:5173 # or production URL
```

**Tasks**:
- [ ] Set up PostgreSQL locally and create database
- [ ] Define all models (User, Mentorship, Goal, Update, Log, LogCategory, etc.)
- [ ] Set up migrations folder and version control for schema changes
- [ ] Create seed data for testing
- [ ] Set up logging (e.g., Winston or Pino)

**Deliverable**: Working `mentorship-platform-api` repo with skeleton endpoints returning 200

---

### Step 2.2: Implement Auth & User Management

**Objective**: Replace WP auth with JWT + local or OAuth.

**Approach**: JWT + local auth (simplest for migration)

**Tasks**:
- [ ] Create `auth` middleware and utilities:
  ```typescript
  // src/middleware/auth.ts
  import jwt from 'jsonwebtoken';
  
  export const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
  ```

- [ ] Create login/register endpoints:
  ```typescript
  // src/routes/auth.ts
  POST /auth/register - register new user
  POST /auth/login - login user, return JWT
  POST /auth/refresh - refresh JWT
  ```

- [ ] Hash passwords with bcrypt:
  ```typescript
  import bcrypt from 'bcrypt';
  const hash = await bcrypt.hash(password, 10);
  ```

- [ ] Create user profile endpoints:
  ```typescript
  GET /users/me - get current user
  GET /users/:id - get user profile
  PUT /users/:id - update profile
  ```

**Deliverable**: Auth endpoints working; users can register/login and receive JWT

---

### Step 2.3: Migrate WordPress Data

**Objective**: Extract all WP data and load into new PostgreSQL.

**Tasks**:
- [ ] Write export scripts (run against WP database):
  ```bash
  # src/scripts/export-wp-data.js
  # Connects to WP DB, exports users, mentorships, goals, updates as JSON
  ```

- [ ] Write transformation layer:
  ```bash
  # src/scripts/transform-data.js
  # Reads JSON, transforms to new schema, validates
  ```

- [ ] Write import scripts:
  ```bash
  # src/scripts/import-data.js
  # Reads transformed JSON, inserts into new PostgreSQL
  ```

- [ ] Validation & reconciliation:
  - Run row count checks (WP users count vs new users count)
  - Spot-check random records
  - Verify foreign key relationships
  - Test logins with migrated accounts

**Run locally first**:
```bash
node src/scripts/export-wp-data.js > wp-export.json
node src/scripts/transform-data.js < wp-export.json > transformed.json
node src/scripts/import-data.js < transformed.json
# Verify counts and sample records
```

**Deliverable**: All data migrated; row counts match; spot-checks pass

---

### Step 2.4: Implement Core REST Endpoints

**Objective**: Build backend endpoints to match current WordPress REST API.

**Tasks**:
- [ ] Rewrite core endpoints (port from `includes/api-routes.php`):
  ```
  GET  /api/v1/mentors - list mentors
  GET  /api/v1/directory - mentor directory with filters
  GET  /api/v1/users/:id - get user profile
  PUT  /api/v1/users/:id - update profile
  POST /api/v1/requests - request mentorship
  GET  /api/v1/requests - get my requests
  GET  /api/v1/requests/:id - get request details
  PUT  /api/v1/requests/:id/status - accept/reject
  POST /api/v1/goals - create goal
  PUT  /api/v1/goals/:id - update goal
  GET  /api/v1/portfolio-directory - public portfolios
  ... (and all others from Phase 1 audit)
  ```

- [ ] Ensure endpoints have:
  - Input validation (e.g., `express-validator`)
  - Proper permission checks (user owns record or is admin)
  - Error handling with consistent response format
  - Pagination for large endpoints

**Example endpoint** (rewritten from WP):
```typescript
// GET /api/v1/directory (replaces /mentorship-platform/v1/directory)
router.get('/directory', async (req, res) => {
  try {
    const mentors = await User.findAll({
      where: { mentorOptIn: true },
      include: [{ model: UserProfile }],
      limit: 50,
      offset: (req.query.page - 1) * 50,
    });
    res.json({ mentors, total: await User.count({ where: { mentorOptIn: true } }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Deliverable**: All core endpoints working; frontend tests pass against new API

---

## Phase 3: Blogging Platform Integration (2–3 weeks)

### Step 3.1: Design Log & Category Schema

**Objective**: Plan the blogging/daily log system with location tagging.

**Data Model**:
```sql
-- Log Categories (for "consistent but custom locations")
CREATE TABLE log_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,  -- e.g., "Beach", "Pool", "Classroom", "Office"
  icon VARCHAR(50),  -- emoji or icon name
  color VARCHAR(20),  -- hex color for UI
  order INTEGER,  -- display order
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Daily Logs (blog posts)
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES log_categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,  -- rich HTML or Markdown
  summary VARCHAR(500),  -- optional excerpt for list views
  mood VARCHAR(50),  -- optional: happy, neutral, challenging, etc.
  tags JSONB,  -- array of tag strings for searching
  is_public BOOLEAN DEFAULT FALSE,  -- visible to mentors/team
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  published_at TIMESTAMP
);

-- Comments on logs (mentor feedback, mentee notes)
CREATE TABLE log_comments (
  id SERIAL PRIMARY KEY,
  log_id INTEGER NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- Reactions/emoji (optional: heart, celebrate, etc.)
CREATE TABLE log_reactions (
  id SERIAL PRIMARY KEY,
  log_id INTEGER NOT NULL REFERENCES logs(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  reaction VARCHAR(50),  -- emoji or name
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(log_id, user_id, reaction)
);
```

**Deliverable**: Migrations written; tables created in dev DB

---

### Step 3.2: Implement Log CRUD Endpoints

**Objective**: Build blogging platform API.

**Endpoints**:
```
POST   /api/v1/logs - create new log
GET    /api/v1/logs - list user's logs (paginated)
GET    /api/v1/logs/:id - get single log
PUT    /api/v1/logs/:id - update log
DELETE /api/v1/logs/:id - delete log

GET    /api/v1/logs/:id/comments - list comments
POST   /api/v1/logs/:id/comments - add comment
DELETE /api/v1/logs/:id/comments/:commentId - delete comment

POST   /api/v1/logs/:id/reactions - add reaction
DELETE /api/v1/logs/:id/reactions/:reactionId - remove reaction

GET    /api/v1/categories - list user's log categories
POST   /api/v1/categories - create category
PUT    /api/v1/categories/:id - update category
DELETE /api/v1/categories/:id - delete category
```

**Sample endpoint**:
```typescript
// POST /api/v1/logs - Create a new daily log
router.post('/logs', authMiddleware, async (req, res) => {
  const { title, content, categoryId, mood, tags, isPublic } = req.body;
  
  // Validate input
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content required' });
  }
  
  try {
    const log = await Log.create({
      userId: req.userId,
      categoryId,
      title,
      content,
      mood,
      tags,
      isPublic,
      publishedAt: new Date(),
    });
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/logs - List user's logs with category filter
router.get('/logs', authMiddleware, async (req, res) => {
  const { page = 1, limit = 20, categoryId, mood } = req.query;
  const where = { userId: req.userId };
  if (categoryId) where.categoryId = categoryId;
  if (mood) where.mood = mood;
  
  const logs = await Log.findAll({
    where,
    include: [{ model: LogCategory }, { model: User, attributes: ['id', 'firstName', 'lastName'] }],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: (page - 1) * limit,
  });
  
  const total = await Log.count({ where });
  res.json({ logs, total, page, limit });
});
```

**Deliverable**: All log endpoints working; can create, read, update, delete logs and categories

---

### Step 3.3: Build Log UI Components (React)

**Objective**: Create frontend components for the blogging platform.

**New components in `src/components/`**:
- `DailyLogList.tsx` - list of user's logs with filters
- `DailyLogForm.tsx` - create/edit log form (rich text editor)
- `DailyLogDetail.tsx` - view single log, comments, reactions
- `LogCategoryManager.tsx` - CRUD for categories
- `LogComments.tsx` - nested comment display and form
- `LogMoodTracker.tsx` - mood trends over time (optional)

**Sample `DailyLogForm.tsx`**:
```tsx
import React, { useState } from 'react';
import { createLog } from '@/services/api';
import RichTextEditor from '@/components/RichTextEditor';
import CategorySelect from '@/components/CategorySelect';

const DailyLogForm: React.FC<{ onSave: () => void }> = ({ onSave }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [mood, setMood] = useState('neutral');
  const [isPublic, setIsPublic] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLog({ title, content, categoryId, mood, isPublic });
      onSave();
      setTitle('');
      setContent('');
    } catch (err) {
      console.error('Failed to save log:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6">
      <input 
        type="text" 
        placeholder="Log title..." 
        value={title} 
        onChange={(e) => setTitle(e.target.value)}
        className="w-full mb-4 p-2 border rounded"
      />
      <CategorySelect value={categoryId} onChange={setCategoryId} />
      <div className="mb-4">
        <label>Mood:</label>
        <select value={mood} onChange={(e) => setMood(e.target.value)} className="p-2 border rounded">
          <option>happy</option>
          <option>neutral</option>
          <option>challenging</option>
        </select>
      </div>
      <RichTextEditor value={content} onChange={setContent} />
      <label className="flex items-center my-4">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        <span className="ml-2">Share with mentors</span>
      </label>
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Save Log</button>
    </form>
  );
};

export default DailyLogForm;
```

**Key features**:
- Rich text editor for content (use existing Tiptap setup)
- Category dropdown (custom locations)
- Mood tracker
- Public/private toggle (for sharing with mentors)
- Inline comments
- Reactions (emoji)

**Deliverable**: Users can create, read, update, delete logs in UI; categories visible; can filter by mood/category

---

## Phase 4: Frontend Migration (1–2 weeks)

### Step 4.1: Update API Service to Use New Backend

**Objective**: Point React app to new Node backend instead of WordPress.

**In `src/services/api.ts`**:
```typescript
// OLD: pointing to WordPress
const API_URL = 'https://example.com/wp-json/mentorship-platform/v1';

// NEW: pointing to Node backend
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

// Update auth to use JWT instead of WordPress nonce
export const configureApiService = (baseUrl: string, token: string) => {
  apiRoot = baseUrl;
  authToken = token;  // JWT token instead of nonce
};

// Fetch helper now uses Authorization header
const fetchApi = async (path: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  // ... rest of fetch logic
};
```

**Tasks**:
- [ ] Update `getPortfolioDirectory`, `getMentorDirectory`, `getMyMentorships`, etc. to match new endpoint URLs
- [ ] Replace WordPress user meta calls with new User model fields
- [ ] Update auth flow to use JWT (login endpoint returns token, store in localStorage/sessionStorage)
- [ ] Update permission/capability checks (no more WP capabilities, use roles/flags from new DB)

**Sample `src/App.tsx` auth update**:
```tsx
const handleLogin = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { token, user } = await response.json();
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    configureApiService(API_URL, token);
    setCurrentUser(user);
  } catch (err) {
    console.error('Login failed:', err);
  }
};
```

**Deliverable**: React app points to new backend; login/logout works; API calls succeed

---

### Step 4.2: Integrate Daily Log UI

**Objective**: Add log components to app navigation and routes.

**In `src/App.tsx`**:
```tsx
import DailyLogList from '@/components/DailyLogList';
import DailyLogForm from '@/components/DailyLogForm';
import LogCategoryManager from '@/components/LogCategoryManager';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* ... existing routes ... */}
        
        {/* New daily log routes */}
        <Route path="/logs" element={<DailyLogList />} />
        <Route path="/logs/new" element={<DailyLogForm onSave={() => navigate('/logs')} />} />
        <Route path="/logs/:id" element={<DailyLogDetail />} />
        <Route path="/settings/categories" element={<LogCategoryManager />} />
      </Routes>
    </Router>
  );
};
```

**Update navigation**:
```tsx
<nav>
  <Link to="/">Home</Link>
  <Link to="/mentors">Mentors</Link>
  <Link to="/goals">Goals</Link>
  <Link to="/logs">Daily Logs</Link>  {/* NEW */}
  <Link to="/settings">Settings</Link>
</nav>
```

**Deliverable**: Users can access daily log views; full CRUD functional

---

## Phase 5: Testing & Deployment (1–2 weeks)

### Step 5.1: Data Integrity & Reconciliation Testing

**Objective**: Ensure all data migrated correctly and no data loss.

**Tasks**:
- [ ] Run comprehensive data validation:
  ```bash
  # scripts/validate-migration.js
  # Compare row counts, checksums, specific records between WP and new DB
  ```
  
- [ ] Test all user journeys:
  - [ ] User logs in (test migrated account)
  - [ ] User can view their mentorship relationships
  - [ ] User can create/edit/delete goals
  - [ ] User can create/update/delete daily logs
  - [ ] User can search/filter by category/mood
  - [ ] Public portfolios display correctly
  - [ ] Mentors can see mentee logs (if permission set)
  
- [ ] Load testing (if expected high traffic):
  - Simulate 100+ concurrent users
  - Check DB connection pooling
  - Monitor server CPU/memory

**Deliverable**: Test report; all journeys validated; no data loss confirmed

---

### Step 5.2: Set Up Hosting & CI/CD

**Objective**: Deploy new backend and frontend to production.

**Option A: Heroku (simplest)**
```bash
# Deploy Node backend
cd mentorship-platform-api
heroku create mentorship-platform-api
heroku addons:create heroku-postgresql:standard-0
git push heroku main

# Set env vars
heroku config:set JWT_SECRET=your-secret-key
heroku config:set DATABASE_URL=<auto-set by Postgres addon>

# Deploy React frontend (to Vercel or Netlify)
cd mentorship-platform-ui
npm run build
# Push to Vercel/Netlify (auto-deploys on git push)
```

**Option B: AWS ECS + RDS**
```bash
# Create RDS PostgreSQL database
# Create ECR repo for Docker image
# Build and push Docker image
docker build -t mentorship-platform-api .
docker tag mentorship-platform-api:latest <ECR_URL>/mentorship-platform-api:latest
docker push <ECR_URL>/mentorship-platform-api:latest

# Create ECS service, configure load balancer, auto-scaling
# Deploy React frontend to CloudFront + S3
```

**Set up CI/CD pipeline** (GitHub Actions example):
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build backend Docker image
        run: docker build -t mentorship-platform-api:${{ github.sha }} .
      
      - name: Push to ECR
        run: |
          docker tag mentorship-platform-api:${{ github.sha }} <ECR_URL>:${{ github.sha }}
          docker push <ECR_URL>:${{ github.sha }}
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster mentorship-prod --service api --force-new-deployment
      
      - name: Build and deploy frontend
        run: |
          npm run build
          aws s3 sync build/ s3://mentorship-platform-frontend/
```

**Deliverable**: Backend running on production URL; frontend deployed; CI/CD pipeline working

---

### Step 5.3: Cutover Plan (Zero-downtime migration)

**Objective**: Migrate users from WordPress to new platform with minimal disruption.

**Strategy: Dual-write/Dual-read**

1. **Phase A (1 week before cutover)**: Enable dual writes
   - New React app sends writes to BOTH WordPress API AND new Node API
   - Reads come from WordPress (old truth)
   - Allows users to test new platform without risk

2. **Phase B (cutover day)**:
   - Announce scheduled maintenance window (e.g., 2–4 AM)
   - Lock WordPress database (read-only mode)
   - Run final data sync
   - Switch reads to new API
   - Monitor for issues

3. **Phase C (1 week post-cutover)**: Rollback plan ready
   - If critical bug, roll back to WordPress (revert frontend API URL)
   - Have database snapshots ready
   - Keep WordPress running in read-only mode for 2–4 weeks

**Communication**:
- Email users 1 week before: "Mentorship platform maintenance"
- Share link to new feature (daily logs) to generate excitement
- Post-cutover: blog post about new features

**Deliverable**: Migration runbook; communication templates; rollback procedures documented

---

## Phase 6: Post-Launch & Optimization (ongoing)

### Step 6.1: Monitoring & Observability

**Objective**: Catch issues early and track usage.

**Set up**:
- [ ] Error tracking: Sentry or Rollbar (capture bugs in prod)
- [ ] Logging: Structured logs to CloudWatch or ELK stack
- [ ] APM: NewRelic or DataDog (performance monitoring)
- [ ] Analytics: Segment or Mixpanel (track feature usage, user engagement)

**Sample instrumentation**:
```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// Wrap components
export default Sentry.withProfiler(App);

// Log events
Sentry.captureMessage('User created daily log', 'info');
```

**Deliverable**: Dashboards set up; alerts configured for errors/slowness

---

### Step 6.2: Feature Enhancements

**Post-launch ideas**:
- [ ] Log analytics dashboard (mood trends, most-used categories, insights)
- [ ] Export logs as PDF or Markdown
- [ ] AI-powered log summaries (using OpenAI API)
- [ ] Integration with calendar (view logs by date)
- [ ] Mobile app (React Native) sharing same backend
- [ ] Email digest (weekly summary of logs/mentorships)
- [ ] Advanced search (full-text search across logs)
- [ ] Dark mode for night logging
- [ ] Notifications (mentor feedback on logs, mentorship requests)

---

## Appendix A: Migration Checklist

**Pre-Migration**:
- [ ] Current state audit complete
- [ ] Target architecture decided
- [ ] Data model designed and reviewed
- [ ] Migration scripts written and tested locally
- [ ] Backend code 100% complete
- [ ] Frontend API service updated
- [ ] All endpoints tested
- [ ] Database indexes created
- [ ] Backups of WordPress database taken
- [ ] Rollback plan documented

**Migration Day**:
- [ ] Announce maintenance window
- [ ] Lock WordPress database
- [ ] Export final data
- [ ] Run migration scripts
- [ ] Validate data integrity
- [ ] Switch frontend to new API
- [ ] Smoke tests pass
- [ ] Monitor server health

**Post-Migration**:
- [ ] Users report no issues (1 day)
- [ ] Keep WordPress running in read-only mode (2–4 weeks)
- [ ] Archive old WordPress backups safely
- [ ] Decommission old WordPress infrastructure (after 30 days)

---

## Appendix B: Estimated Timeline & Effort

| Phase | Task | Effort | Timeline |
|-------|------|--------|----------|
| 1 | Analysis & Planning | M | 1 week |
| 2 | Backend Setup | M | 1 week |
| 2 | Auth & User Mgmt | M | 3–4 days |
| 2 | Data Migration | M–L | 3–5 days |
| 2 | Core Endpoints | L | 5–7 days |
| 3 | Log Schema Design | S | 1 day |
| 3 | Log Endpoints | M | 5–7 days |
| 3 | Log UI Components | M | 5–7 days |
| 4 | Frontend Migration | M | 3–5 days |
| 5 | Testing & QA | M–L | 5–7 days |
| 5 | Deployment & CI/CD | S–M | 3–5 days |
| 5 | Cutover | S | 1 day |
| 6 | Post-launch Monitoring | S | Ongoing |
| **Total** | | | **6–10 weeks** |

**Team composition**:
- 1–2 Backend engineers (Node/DB)
- 1 Frontend engineer (React)
- 1 DevOps/Infrastructure engineer (optional, helps with deployment)
- 1 QA engineer (testing & validation)

---

## Appendix C: Example Backend Folder Structure

```
mentorship-platform-api/
├── src/
│   ├── models/                 # Database models
│   │   ├── User.js
│   │   ├── Mentorship.js
│   │   ├── Goal.js
│   │   ├── Log.js
│   │   ├── LogCategory.js
│   │   ├── LogComment.js
│   │   └── index.js            # Sequelize instance & associations
│   ├── controllers/            # Route handlers
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── mentorshipController.js
│   │   ├── goalController.js
│   │   ├── logController.js
│   │   └── categoryController.js
│   ├── routes/                 # Express routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── mentorships.js
│   │   ├── goals.js
│   │   ├── logs.js
│   │   └── index.js            # Main router
│   ├── middleware/             # Custom middleware
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── validation.js
│   ├── services/               # Business logic
│   │   ├── authService.js
│   │   ├── userService.js
│   │   ├── logService.js
│   │   └── emailService.js
│   ├── utils/                  # Utilities
│   │   ├── logger.js
│   │   ├── validators.js
│   │   └── constants.js
│   └── app.js                  # Express app setup
├── migrations/                 # Database migrations
│   ├── 001-create-users.js
│   ├── 002-create-mentorships.js
│   ├── 003-create-logs.js
│   └── ...
├── scripts/
│   ├── migrate/
│   │   ├── export-wp-data.js
│   │   ├── transform-data.js
│   │   └── import-data.js
│   └── validate-migration.js
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── index.js                    # Entry point
└── README.md
```

---

## Appendix D: Key Decisions & Trade-offs

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Language | Node/Express, Python/Django, Go, Ruby | Node.js + Express | Familiar to JS team, quick dev, rich npm ecosystem |
| Database | PostgreSQL, MySQL, MongoDB | PostgreSQL | Better performance, JSONB support, powerful queries |
| Auth | JWT, OAuth (Auth0), Session-based | JWT + local | Flexibility, no vendor lock-in, simpler migration |
| Blogging | Custom build, Strapi, Sanity, WordPress-as-headless | Custom (lightweight) | Full control, already have rich text editor (Tiptap), minimal overhead |
| Hosting | Heroku, AWS ECS, DigitalOcean, Render | Start with Heroku, migrate to AWS if scale | Heroku: simplest, AWS: more control & better pricing at scale |
| Frontend | Keep React, rewrite in Vue/Svelte | Keep React | No need to rewrite; codebase is mature |

---

## Appendix E: Rollback & Safety

**If cutover fails**:
1. Immediately revert frontend API_URL to WordPress
2. Users will continue to see old app (zero data loss)
3. Troubleshoot new backend offline
4. Reschedule cutover for next week

**Database safety**:
- Before migration: Full dump of both WordPress and new PostgreSQL
- Keep WordPress live for 30 days (read-only) in case we need to rollback
- After 30 days: Archive backups and decommission

**User communication**:
- "We're upgrading the platform! During maintenance, the app will be briefly unavailable."
- Post-upgrade: "Welcome new features: Daily logs with custom locations, improved performance, and better mobile experience!"

---

## Next Steps

1. **Schedule kickoff meeting** with team to review this plan and align on tech stack
2. **Create Jira/Linear tickets** for each phase
3. **Set up development environment** (local Node + PostgreSQL setup guide)
4. **Assign ownership** (who leads each phase?)
5. **Begin Phase 1**: Start the audit

**Questions to resolve**:
- Should daily logs be visible to all team members or only mentors?
- Do you want to keep the WordPress install as a CMS for announcements, or fully sunset it?
- Should there be a mobile app (React Native sharing backend)?
- Any third-party integrations to migrate (Slack, email, calendars)?

---

**End of Migration Guide**

*Last Updated: November 13, 2025*  
*Version: 1.0*
