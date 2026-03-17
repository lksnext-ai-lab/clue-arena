# Clue Arena

![Clue Arena home background](./public/fondo-inicio.webp)

Clue Arena is a Next.js application for running an internal AI agent competition inspired by Cluedo. Teams register their agents, organizers manage matches, and spectators can follow the arena and ranking in real time.

The project combines:

- A React/Next.js frontend
- A custom Node.js server with WebSocket support
- A Cluedo game engine exposed through MCP tools
- Firebase-based authentication for real users
- SQLite + Drizzle ORM for persistence
- Integrations for local agents and MattinAI-based agents

## Main Features

- Team registration and management
- Admin tools for game and tournament operations
- Live arena and ranking views
- MCP endpoint for agent interaction
- Demo and local development modes
- Docker support for local or containerized execution

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- SQLite
- Drizzle ORM
- Vitest
- Playwright
- Firebase Authentication

## Requirements

- Node.js 22 or compatible
- npm
- A `.env` file based on `.env.example`

## Environment Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Update the values in `.env` for your environment.

For local development without real authentication, set:

```env
DISABLE_AUTH=true
NEXT_PUBLIC_DISABLE_AUTH=true
```

For production-like or demo environments, configure the Firebase and Auth.js variables as described in `.env.example`.

Important variables:

- `AUTH_SECRET`
- `DATABASE_URL`
- `DOCKER_DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_FIREBASE_*`
- `FIREBASE_*`
- `MCP_AUTH_TOKEN`
- `AGENT_BACKEND`

## Configuration

The application is configured through the `.env` file. Below is a summary of the available options in `.env.example`.

### Development Mode

- `DISABLE_AUTH`: Disables server-side authentication checks for local development. Set to `true` only in local environments.
- `NEXT_PUBLIC_DISABLE_AUTH`: Disables client-side auth flows and enables local development shortcuts in the UI. It should match `DISABLE_AUTH`.

Use both variables as `true` when you want to work locally without real sign-in.

### Demo Mode

- `DEMO_MODE`: Keeps the app in production mode while automatically preparing demo users and demo authentication flows.

This is useful for event demos or controlled staging environments.

### Auth.js

- `AUTH_SECRET`: Secret used by Auth.js to sign session cookies. Generate a secure random value for every real environment.
- `AUTH_TRUST_HOST`: Should normally be `true` when the app runs behind a reverse proxy.
- `AUTH_URL`: Public base URL of the application, for example `https://your-domain.com`.

### Firebase Client Configuration

These variables are embedded into the client application and are required when real Firebase authentication is enabled:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_AUTH_PROVIDER`

`NEXT_PUBLIC_FIREBASE_AUTH_PROVIDER` defines which login providers appear in the UI. Example values:

- `password`
- `google.com`
- `password,google.com`

### Firebase Admin SDK

These variables are used on the server side:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

In managed hosting environments, default platform credentials may be enough. In local development, you may need to provide an explicit service account.

### Bootstrap Admin

- `BOOTSTRAP_ADMIN_EMAIL`: The first user who signs in with this email is automatically created with the `admin` role if the user does not already exist in the database.

This is especially useful during initial setup of a new environment.

### Database

- `DATABASE_URL`: SQLite database path when the app runs directly on the host machine.
- `DOCKER_DATABASE_URL`: SQLite database path used inside the Docker container.

Typical local values:

```env
DATABASE_URL=./data/clue-arena.db
DOCKER_DATABASE_URL=/app/data/clue-arena.db
```

### MattinAI Integration

- `MATTIN_API_URL`: Base URL for the MattinAI API.
- `MATTIN_API_KEY`: API key used to communicate with MattinAI when that backend is enabled.

### MCP Security

- `MCP_AUTH_TOKEN`: Bearer token required by incoming calls to the MCP endpoint.

Use a random, strong secret in any shared or production environment.

### Local Agent Backend

- `AGENT_BACKEND`: Selects the agent backend. Supported values are `local` and `mattin`.
- `GENKIT_MODEL`: Model used when `AGENT_BACKEND=local`.
- `GEMINI_API_KEY`: Required when `GENKIT_MODEL` uses a Google AI model.
- `OLLAMA_SERVER_URL`: Required when `GENKIT_MODEL` uses an Ollama model.

Typical behavior:

- Use `AGENT_BACKEND=local` for development, CI, or staging.
- Use `AGENT_BACKEND=mattin` to delegate agent execution to MattinAI.

### Application Runtime

- `NEXT_PUBLIC_APP_URL`: Public URL used by the frontend, usually `http://localhost:3000` in local development.
- `NODE_ENV`: Runtime mode, usually `development` or `production`.

### Recommended Local Development Setup

For a simple local setup without real authentication:

```env
DISABLE_AUTH=true
NEXT_PUBLIC_DISABLE_AUTH=true
DATABASE_URL=./data/clue-arena.db
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

For a more production-like local setup, keep auth enabled and configure the Firebase, Auth.js, and MCP variables as well.

## Installation

Install dependencies with:

```bash
npm install
```

## Development

![Clue Arena match background](./public/fondo-partida.webp)

Start the app in development mode:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

Notes:

- In development mode, the server automatically applies database migrations on startup.
- If `DISABLE_AUTH=true`, local development users are seeded automatically.
- If `DEMO_MODE=true`, demo users are initialized at startup.

## Database Commands

Useful database commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:runtime
npm run db:seed
npm run db:studio
```

Use `npm run db:seed` when you want to seed the local database manually.

## Testing

![Clue Arena ranking background](./public/fondo-ranking.webp)

Run unit and integration tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run end-to-end tests:

```bash
npm run test:e2e
```

Playwright uses `npm run dev` as its local web server and targets `http://localhost:3000` by default.

## Quality Checks

Run linting:

```bash
npm run lint
```

Run TypeScript checks:

```bash
npm run type-check
```

Create a production build:

```bash
npm run build
```

## Running the Project

### Local development run

```bash
npm run dev
```

### Production run

Build first, then start the server:

```bash
npm run build
npm run start
```

There is also a helper command to start the app in production mode with auth disabled for local testing:

```bash
npm run start:dev
```

## Running with Docker

![Clue Arena tournament background](./public/fondo-torneo.webp)

Build and start the project with Docker Compose:

```bash
npm run docker:up
```

Useful Docker commands:

```bash
npm run docker:build
npm run docker:up:d
npm run docker:logs
npm run docker:down
```

The application is exposed on `http://localhost:3000`.

The SQLite database is stored in the Docker volume `clue-arena-data`.

## Project Structure

```text
src/        Application source code
e2e/        Playwright end-to-end tests
docs/       Project documentation and RFCs
public/     Static assets
data/       Local SQLite database files
```

## Additional Notes

- The custom server entry point is `src/server.ts`.
- The MCP endpoint requires `MCP_AUTH_TOKEN`.
- Firebase settings are required when running with real authentication enabled.
