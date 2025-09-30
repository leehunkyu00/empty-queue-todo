# Empty-Queue Productivity MVP

Empty-Queue is a gamified productivity web app that helps families or teams separate deep focus work from lightweight admin tasks, power through both in dedicated blocks, and stay engaged with level-ups, coins, and badges. This repo contains a full-stack implementation built with an Express/MongoDB backend and a Vite + React frontend.

## Features

- **Two primary queues** – Deep Work and Admin – enforcing focus-oriented planning and execution.
- **Gamification loop** – XP, coins, streak tracking, and unlockable badges for motivation.
- **Household profiles** – create sub-accounts (e.g., kids or teammates) and assign tasks to each member.
- **Hamburger navigation** – switch between 메인, 코인 사용처, 히스토리(차트) 뷰로 빠르게 이동.
- **Coin usage ledger** – log how rewards are spent per profile while safeguarding available balances.
- **History charts** – visualize recent task clears per profile for momentum tracking.
- **Task management essentials** – create, reorder (drag-style via arrows), complete, and delete tasks per queue.
- **Progress insights** – dashboard with queue stats, streak status, badges, and spotlighted focus tasks.
- **Secure auth** – email/password registration with bcrypt hashing plus JWT-based session handling.

## Tech Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT, Day.js
- **Frontend:** Vite, React, vanilla CSS (utility-inspired styling)
- **Tooling:** Nodemon for API dev, Vite dev server for UI, npm scripts

## Project Structure

```
empty-queue-todo/
├── server/        # Express API + MongoDB models/controllers
├── client/        # React single-page app (Vite powered)
├── docs/          # Original product specification
└── README.md
```

## Prerequisites

- Node.js 18+ (Vite warns below 20 but still builds/run on 18)
- npm 8+
- Running MongoDB instance (default URL is `mongodb://127.0.0.1:27017/empty_queue`)

## Setup

### 1. Backend API

```bash
cd server
cp .env.example .env   # adjust values if needed
npm install
npm run start          # or npm run dev for live reload
```

API listens on `http://localhost:4000` by default.

### 2. Frontend Web App

```bash
cd client
cp .env.example .env   # set VITE_API_URL if the API runs elsewhere
npm install
npm run dev            # launches Vite dev server (default http://localhost:5173)
```

For production assets: `npm run build` creates `client/dist`.

## Key Environment Variables

Backend (`server/.env`):

```
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/empty_queue
JWT_SECRET=replace-with-strong-secret
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Frontend (`client/.env`):

```
VITE_API_URL=http://localhost:4000
```

## Running the Experience

1. Start MongoDB.
2. Launch the API (`npm run start` in `server/`).
3. Start the client (`npm run dev` in `client/`).
4. Visit `http://localhost:5173`, create an account, and begin managing queues.

## API Overview

All secured endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint                       | Description |
|--------|---------------------------------|-------------|
| POST   | `/api/auth/register`            | Register and receive JWT |
| POST   | `/api/auth/login`               | Log in |
| GET    | `/api/auth/me`                  | Current user profile |
| GET    | `/api/queues`                   | Pending queues, recent completions, profiles |
| POST   | `/api/tasks`                    | Create task (`queue`, `title`, `difficulty`, `assignedProfileId`) |
| PATCH  | `/api/tasks/:taskId`            | Update details or reassign |
| POST   | `/api/tasks/:taskId/complete`   | Complete task and trigger rewards |
| DELETE | `/api/tasks/:taskId`            | Remove task |
| POST   | `/api/queues/reorder`           | Reorder tasks within a queue |
| GET    | `/api/dashboard`                | Gamified stats + queue summary |
| GET    | `/api/household`                | List household members |
| POST   | `/api/household`                | Add member |
| PATCH  | `/api/household/:profileId`     | Update member preferences |
| DELETE | `/api/household/:profileId`     | Remove member (except primary) |

## Frontend Highlights

- Responsive, desktop-first layout with mobile fallbacks.
- Queue columns include inline creation form, difficulty, assignee selection, and reordering controls.
- Focus banner spotlights the next task in each queue for quick context switching.
- Household manager simplifies sub-account lifecycle (add, preference tweak, remove).
- Toast feedback surfaces XP/coin gains, level ups, and badge unlocks in real time.

## Verification Performed

- `server`: `npm run start` (with timeout) to ensure the API boots and connects to MongoDB.
- `client`: `npm run build` to confirm the React app compiles successfully against the API contracts.

## Next Steps

- Harden the API with integration tests (e.g., Jest + Supertest) and add optimistic UI updates.
- Expand gamification (quest chains, coin redemption flows) and scheduling (calendar integrations).
- Containerize for deployment (Docker Compose with Mongo) and add CI for automated quality gates.

Enjoy emptying the queue!
