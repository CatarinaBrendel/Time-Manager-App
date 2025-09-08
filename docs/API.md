
# Time Manager Dashboard — API.md

**Status:** v0.1 (local-first) — 2025-09-07  
**Scope:** Data contracts and behaviors for Projects, Tasks, Time Entries, Pomodoro Sessions, and a Daily Report.  
**Modes:**
- **In-process API (default):** No HTTP server; the Electron app calls functions that implement these contracts.
- **HTTP mode (optional):** Same contracts over HTTP. Useful later if you expose an API.

---

## Contents
- [Design Principles](#design-principles)
- [Base URLs & Modes](#base-urls--modes)
- [Auth](#auth)
- [Conventions](#conventions)
  - [Content Type](#content-type)
  - [IDs](#ids)
  - [Dates & Timezones](#dates--timezones)
  - [Pagination](#pagination)
  - [Errors](#errors)
- [Resources](#resources)
  - [Projects](#projects)
  - [Tasks](#tasks)
  - [Time Entries](#time-entries)
  - [Pomodoro Sessions](#pomodoro-sessions)
  - [Reports](#reports)
- [Example Flows](#example-flows)
- [Change Management & Versioning](#change-management--versioning)
- [HTTP Examples (optional mode)](#http-examples-optional-mode)
- [TypeScript Usage (in-process mode)](#typescript-usage-in-process-mode)
- [Source of Truth](#source-of-truth)

---

## Design Principles
- **Local-first:** All reads/writes are local (SQLite).  
- **Contract-first:** Types mirror the OpenAPI 3.1 schema in `packages/shared-types/openapi.yaml`.  
- **Forward-compatible:** You can flip to HTTP mode later without changing data shapes.

---

## Base URLs & Modes

### In-process (default)
Call the app’s API module (e.g., `import { api } from '@/api'`) that returns/accepts the exact shapes defined below. No HTTP involved.

### HTTP mode (optional)
If/when you enable an HTTP server:

- **Local (dev):** `http://localhost:5173/v1`
- **Development:** `https://dev.api.timemanager.app/v1`
- **Production:** `https://api.timemanager.app/v1`

> All endpoints shown below assume `/v1` as a prefix in HTTP mode.

---

## Auth
- **Local-only default:** no auth needed (single user profile stored locally).
- **HTTP mode (future):** Bearer JWT (Authorization: `Bearer <token>`).
- Endpoints that would require auth are noted in OpenAPI; for now, the in-process layer bypasses that.

---

## Conventions

### Content Type
- `application/json; charset=utf-8`

### IDs
- UUIDv4 strings unless noted.

### Dates & Timezones
- Timestamps: ISO-8601 with timezone, e.g. `2025-09-07T10:15:30.000Z`.
- Dates (no time): `YYYY-MM-DD`.
- Store in UTC; render in user’s timezone (e.g., `Europe/Berlin`).

### Pagination
- Query params: `page` (default `1`), `pageSize` (default `25`, max `100`).
- Responses include:
  ```json
  {
    "data": [/* items */],
    "meta": { "page": 1, "pageSize": 25, "total": 123 }
  }
  ```

### Errors
Uniform error body:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Title is required",
  "details": [
    { "path": "body.title", "message": "Title is required" }
  ]
}
```

---

## Resources

### Projects

#### Model
```ts
type Project = {
  id: string;               // uuid
  name: string;
  color?: string;           // hex, e.g. "#6C5CE7"
  archived: boolean;
  createdAt: string;        // ISO datetime
  updatedAt: string;        // ISO datetime
}
```

#### List Projects
- **In-process:** `api.projects.list({ page?, pageSize?, q? })`
- **HTTP:** `GET /projects?page=1&pageSize=25&q=design`
- **Response:** `{ data: Project[], meta }`

#### Create Project
- **In-process:** `api.projects.create({ name, color? })`
- **HTTP:** `POST /projects`
  ```json
  { "name": "Client A", "color": "#6C5CE7" }
  ```
- **201 →** `Project`

#### Get Project
- **In-process:** `api.projects.get(projectId)`
- **HTTP:** `GET /projects/{projectId}`
- **200 →** `Project`

#### Update Project
- **In-process:** `api.projects.update(projectId, { name?, color?, archived? })`
- **HTTP:** `PATCH /projects/{projectId}`
- **200 →** `Project`

#### Delete Project
- **In-process:** `api.projects.remove(projectId)`
- **HTTP:** `DELETE /projects/{projectId}`
- **204**

---

### Tasks

#### Model
```ts
type TaskStatus = "todo" | "in_progress" | "done" | "archived";

type Task = {
  id: string;                 // uuid
  projectId?: string | null;  // uuid
  title: string;
  description?: string | null;
  status: TaskStatus;
  effort?: number | null;     // optional points/mins
  dueDate?: string | null;    // YYYY-MM-DD
  tags?: string[];
  createdAt: string;          // ISO datetime
  updatedAt: string;          // ISO datetime
}
```

#### List Tasks
- **In-process:** `api.tasks.list({ page?, pageSize?, projectId?, status?, q? })`
- **HTTP:** `GET /tasks?projectId=...&status=todo&q=...`
- **Response:** `{ data: Task[], meta }`

#### Create Task
- **In-process:** `api.tasks.create({ title, projectId?, description?, effort?, dueDate?, tags? })`
- **HTTP:** `POST /tasks`
- **201 →** `Task`

#### Get / Update / Delete
- `GET /tasks/{taskId}` → `Task`
- `PATCH /tasks/{taskId}` → `Task`
- `DELETE /tasks/{taskId}` → `204`

---

### Time Entries

#### Model
```ts
type TimeEntry = {
  id: string;                 // uuid
  userId: string;             // uuid
  projectId?: string | null;  // uuid
  taskId?: string | null;     // uuid
  startedAt: string;          // ISO datetime
  endedAt: string;            // ISO datetime
  seconds: number;
  note?: string | null;
  source: "manual" | "pomodoro";
}
```

#### List Time Entries
- **In-process:** `api.time.list({ page?, pageSize?, from?, to?, projectId?, taskId? })`
- **HTTP:** `GET /time/entries?from=...&to=...`
- **Response:** `{ data: TimeEntry[], meta }`

#### Create (manual or from Pomodoro)
- **In-process:** `api.time.create({ startedAt, endedAt, projectId?, taskId?, note?, source? })`
- **HTTP:** `POST /time/entries`
- **201 →** `TimeEntry`

#### Update / Delete
- `PATCH /time/entries/{entryId}` → `TimeEntry`
- `DELETE /time/entries/{entryId}` → `204`

---

### Pomodoro Sessions

#### Model
```ts
type PomodoroSession = {
  id: string;                 // uuid
  userId: string;             // uuid
  projectId?: string | null;  // uuid
  taskId?: string | null;     // uuid
  startedAt: string;          // ISO datetime
  endedAt?: string | null;    // ISO datetime
  state: "running" | "stopped";
  focusMinutes: number;
  breakMinutes?: number | null;
}
```

#### Start Session
- **In-process:** `api.pomodoro.start({ projectId?, taskId?, focusMinutes? })`
- **HTTP:** `POST /pomodoro/sessions`
  ```json
  { "projectId": "…", "taskId": "…", "focusMinutes": 25 }
  ```
- **201 →** `PomodoroSession`

#### Stop Session (optionally create TimeEntry)
- **In-process:** `api.pomodoro.stop(sessionId, { createTimeEntry?: true, note?: string })`
- **HTTP:** `POST /pomodoro/sessions/{sessionId}/stop`
- **200 →**
  ```json
  {
    "session": { /* PomodoroSession */ },
    "timeEntry": { /* TimeEntry */ }   // or null
  }
  ```

---

### Reports

#### Daily Report
- **In-process:** `api.reports.daily({ date, projectId? })`
- **HTTP:** `GET /reports/daily?date=2025-09-07&projectId=...`
- **200 →**
```ts
type DailyReport = {
  date: string;  // YYYY-MM-DD
  totals: {
    seconds: number;
    byProject: { projectId?: string | null; seconds: number }[];
    byTask:    { taskId?: string | null; seconds: number }[];
  };
  pomodoro: {
    sessions: number;
    totalFocusMinutes: number;
  };
}
```

---

## Example Flows

### A) Project → Task → Pomodoro → Time Entry
1. **Create project**  
   - `api.projects.create({ name: "Client A", color: "#6C5CE7" })`
2. **Create task**  
   - `api.tasks.create({ title: "Implement timer UI", projectId })`
3. **Start Pomodoro**  
   - `api.pomodoro.start({ taskId, focusMinutes: 25 })`
4. **Stop Pomodoro & log time**  
   - `api.pomodoro.stop(sessionId, { createTimeEntry: true, note: "Deep focus" })`

### B) Manual Time Entry
- `api.time.create({ startedAt, endedAt, projectId?, taskId?, note: "Manual log" })`

---

## Change Management & Versioning
- **SemVer** for app versions.
- **Non-breaking changes** (add fields/endpoints) are preferred.  
- **Breaking changes** require:
  - Migrator + pre-migration backup of `app.sqlite`  
  - Changelog entry under **Data Notes**  
  - Feature-flagged UI if behavior changes

---

## HTTP Examples (optional mode)

> Only if you enable the HTTP server. Otherwise use the in-process methods above.

**List tasks**
```bash
curl -s "http://localhost:5173/v1/tasks?page=1&pageSize=25"
```

**Create task**
```bash
curl -s -X POST "http://localhost:5173/v1/tasks"   -H "Content-Type: application/json"   -d '{ "title": "Wire Pomodoro start button", "projectId": "a6f1…" }'
```

**Stop Pomodoro session**
```bash
curl -s -X POST "http://localhost:5173/v1/pomodoro/sessions/3b3a…/stop"   -H "Content-Type: application/json"   -d '{ "createTimeEntry": true, "note": "Session complete" }'
```

---

## TypeScript Usage (in-process mode)
```ts
import api from "@/api"; // your app's API module using the shared types

// Create a task
const task = await api.tasks.create({
  title: "Build settings panel",
  projectId: "b7b6c6e2-…"
});

// Start & stop a Pomodoro, logging time
const session = await api.pomodoro.start({ taskId: task.id, focusMinutes: 25 });
const result = await api.pomodoro.stop(session.id, { createTimeEntry: true, note: "Great focus" });

// Daily report
const report = await api.reports.daily({ date: "2025-09-07" });
```

---

## Source of Truth
- **OpenAPI:** `packages/shared-types/openapi.yaml`  
- **Generated Types/Clients:** Generated from OpenAPI to keep frontend and logic in sync.  
- **Migrations:** Each release that changes schema ships with a migration script and pre-migration backup.
