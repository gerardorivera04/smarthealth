# SmartHealth

A health dashboard application with a React frontend and Express.js backend.

## Tech Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4, React Router 7
- **Backend:** Express 5, SQLite (better-sqlite3), JWT authentication, bcryptjs

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/gerardorivera04/smarthealth.git
cd smarthealth
```

### 2. Set up the backend

```bash
cd UserServer
npm install
```

### 3. Set up the frontend

```bash
cd UserDashboard
npm install
```

### 4. Run the application

Start both the backend and frontend in separate terminals:

**Terminal 1 — Backend (port 3001):**

```bash
cd UserServer
npm run dev
```

**Terminal 2 — Frontend (port 5173):**

```bash
cd UserDashboard
npm run dev
```

The frontend proxies API requests to the backend, so both must be running. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend server port |
| `JWT_SECRET` | `smarthealth-dev-secret-change-in-production` | Secret for signing JWTs (change in production) |

## Available Scripts

### UserDashboard

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

### UserServer

| Command | Description |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with file watching |

## Project Structure

```
smarthealth/
├── UserDashboard/       # React frontend
│   ├── src/
│   │   ├── pages/       # Landing, Login, Signup, Dashboard
│   │   ├── App.jsx      # Router and route protection
│   │   ├── main.jsx     # Entry point
│   │   └── index.css    # Tailwind styles
│   ├── vite.config.js
│   └── package.json
├── UserServer/          # Express backend
│   ├── index.js         # Server, routes, and database setup
│   └── package.json
└── README.md
```