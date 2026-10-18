# CivicPulse AI — AI-Powered Urban Intelligence Platform

CivicPulse AI is an AI-powered urban response system designed for the **BrainWave 2026** hackathon. It allows citizens to report local civic issues (potholes, garbage, water leaks, etc.) via image captures, descriptions, and maps. The backend analyzes the report using Google Gemini AI, groups duplicates within 100 meters, computes a deterministic priority score, and displays incidents on an authority dashboard map for worker dispatch and resolution tracking.

---

## Supabase Integration

CivicPulse AI is integrated with **Supabase** for:
1. **Authentication**: User registration, login, and role-based permissions (`civilian`, `admin`, `crew`) via Supabase Auth and `public.profiles`.
2. **Storage**: Citizen issue photos and crew resolution evidence photos are securely uploaded and hosted in the `civicpulse-uploads` Supabase Storage bucket.
3. **Database**: PostgreSQL tables for `incidents`, `reports`, `incident_status_history`, and `profiles`, with automated synchronization and Row-Level Security (RLS) policies.

### One-Time Supabase Setup (SQL Editor)
1. Open your Supabase Dashboard: [Supabase SQL Editor](https://supabase.com/dashboard/project/wpqybcukijxmfpzzdykt/sql)
2. Open [`supabase-schema.sql`](./supabase-schema.sql) in this repository.
3. Copy all contents, paste them into the SQL Editor, and click **Run**.
4. This will create:
   - `public.profiles` with automatic trigger on new auth signups
   - `public.incidents` table with coordinates, priority score, and lifecycle tracking
   - `public.reports` table for citizen submissions
   - `public.incident_status_history` audit trail table
   - `civicpulse-uploads` public storage bucket and access policies

---

## TinyFish (tinyfish.ai) Autonomous Agent Integration

CivicPulse AI integrates **TinyFish Autonomous Browser Agents** (`@tiny-fish/sdk`) to automate external municipal grievance lodging across government portals:
1. **Multi-Portal Dispatch**: Automatically routes high-severity incidents to official external portals based on category:
   - **MCD 311**: Road potholes, sanitation, illegal dumping, garbage
   - **Delhi Jal Board (DJB)**: Pipeline bursts, water leakages, sewage overflow
   - **PWD Delhi**: Bridges, flyovers, arterial highways
   - **NDMC Smart City**: Broken streetlights, unlit dark zones, hazardous open wiring
   - **Delhi Traffic Police**: Signal light failures, major intersections
2. **Autonomous Grievance Form Filling**: Navigates external portal workflows, fills out coordinates, priority score, and citizen descriptions, and secures confirmation ticket reference numbers.
3. **Audit Trail**: Every TinyFish agent run is logged in `incident_status_history` and synced in real-time to Supabase PostgreSQL.
4. **Configuration**: Add your API key to `.env`:
   ```bash
   TINYFISH_API_KEY=your_tinyfish_api_key_here
   ```
   *(Note: If no API key is present or when dry-run is toggled, a high-fidelity safe simulation mode executes so judging and testing work out of the box).*

---

## Workspace Structure

- `supabase-schema.sql`: Complete PostgreSQL database schema, triggers, and storage bucket configuration.
- `backend/`: Node.js Express server.
  - `supabase.js`: Supabase server-side client, token validator, and storage uploader.
  - `supabaseSync.js`: Real-time synchronization layer mirroring all database mutations to Supabase PostgreSQL.
  - `db.js`: Local SQLite caching layer and migration queries.
  - `routes/`: Auth, reports, incidents, and demo seeder REST endpoints.
  - `uploads/`: Static image folder for local fallback.
- `frontend/`: React Vite client.
  - `src/supabaseClient.js`: Supabase client and storage upload utilities.
  - `src/components/`: Map components, landing pages, civilian portals, and admin consoles.
  - `src/index.css`: Custom vanilla dark-theme CSS design system.

---

## Local Installation & Startup

### Prerequisites
- Node.js v22.5.0 or higher.

### 1. Unified Dev Server (Recommended)
You can run both backend and frontend together:
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

### 2. Separate Terminal Startup (Optional)
**Backend**:
```bash
cd backend
npm install
npm run dev
```
Runs on `http://localhost:5000`.

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`.

---

## Quick Demo Seeding (Judging Instructions)

For instant judging evaluation:
1. Open the login screen (`/login`).
2. Scroll to the bottom and click **Seed Delhi Demo Incidents**.
3. The database will automatically reset and seed 10 distinct, realistic civic incidents centered in Delhi into both local and Supabase databases.
4. Use the provided demo login credentials shown on-screen to access civilian portals or administrative command dashboards instantly:
   - **Admin**: `admin@gmail.com` / `31102006`
   - **Crew**: `crew@gmail.com` / `311102006`
   - **Citizen**: `citizen@gmail.com` / `31102006`

