# Yaniv Game Server

Real-time multiplayer server for the Yaniv card game.

## Tech Stack

- Node.js + TypeScript
- Socket.io for real-time communication
- Express for HTTP endpoints

## Local Development

```bash
# Install dependencies
cd server
npm install

# Run development server (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

The server will run on `http://localhost:3001`

## Deployment to Fly.io (Free)

### 1. Install Fly CLI

```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Mac
curl -L https://fly.io/install.sh | sh
```

### 2. Login/Signup

```bash
fly auth login
```

### 3. Deploy

```bash
cd server
fly launch
```

Follow the prompts:
- Choose a unique app name (e.g., `yaniv-game-server`)
- Choose region (e.g., `fra` for Frankfurt, close to Israel)
- Don't create a database

Then deploy:

```bash
fly deploy
```

### 4. Update Client

After deployment, update `lib/socketService.ts` with your server URL:

```typescript
const SERVER_URL = __DEV__ 
  ? 'http://localhost:3001' 
  : 'https://YOUR-APP-NAME.fly.dev';
```

## API Endpoints

### HTTP

- `GET /` - Server status and room count
- `GET /health` - Health check

### Socket Events

#### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `createRoom` | `{ settings, player }` | Create new room |
| `joinRoom` | `{ code, player }` | Join existing room |
| `leaveRoom` | - | Leave current room |
| `addAiPlayer` | - | Add AI player (host only) |
| `removePlayer` | `{ odId }` | Remove player (host only) |
| `startGame` | - | Start game (host only) |
| `throwCards` | `{ cardIds, drawFrom }` | Make a move |
| `callYaniv` | - | Call Yaniv |
| `stick` | - | Stick card |
| `skipStick` | - | Skip sticking |

#### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `roomCreated` | `{ code }` | Room created successfully |
| `roomJoined` | `{ room }` | Joined room |
| `roomUpdated` | `{ room }` | Room state changed |
| `roomError` | `{ message }` | Error occurred |
| `gameStateUpdated` | `{ gameState }` | Game state changed |
| `turnChanged` | `{ currentTurnOdId, turnStartTime }` | Turn changed |
| `roundEnded` | `{ result }` | Round ended |
| `gameEnded` | `{ finalScores }` | Game ended |
| `stickingAvailable` | `{ card, timeoutMs }` | Can stick |
| `stickingExpired` | - | Sticking window closed |

## Room Lifecycle

1. **Create Room** - Host creates room with settings
2. **Waiting** - Players join (up to 4), host can add AI
3. **Playing** - Game in progress
4. **Round End** - Show results, auto-continue to next round
5. **Game Over** - Final scores, return to lobby

Rooms are automatically cleaned up after 30 minutes of inactivity.

## Security

- All game logic runs on server
- Clients can only send action requests
- Server validates all moves before applying
- Player cards are only sent to their owner
