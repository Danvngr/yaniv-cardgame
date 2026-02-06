# 🃏 Yaniv Card Game

A mobile Yaniv card game app with local play against AI and online multiplayer support.

![React Native](https://img.shields.io/badge/React%20Native-0.81-blue)
![Expo](https://img.shields.io/badge/Expo-54-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Socket.io](https://img.shields.io/badge/Socket.io-4.7-green)

---

## 📱 Features

- **Local Play** - Play against 1-3 AI opponents
- **Online Multiplayer** - Create a room and invite friends
- **Sticking** - Threw a card and drew the same rank? You have 2 seconds to stick!
- **Assaf** - Someone called Yaniv but you have fewer points? Assaf them!
- **In-Game Chat** - Send messages and emojis to other players
- **Leaderboard** - Compete against other players

---

## 🎮 Game Rules

### Objective
Get rid of your cards and finish with 7 points or less.

### Card Values
| Card | Points |
|------|--------|
| Joker | 0 |
| A | 1 |
| 2-10 | Face value |
| J, Q, K | 10 |

### Turn Structure
1. **Discard** - A single card, 2+ of the same rank, or a run of 3+ in the same suit
2. **Draw** - From the deck or the discard pile

### Valid Discards
- Single card: `7♥`
- Pair or more: `7♥ 7♦` or `7♥ 7♦ 7♠`
- Run (minimum 3): `5♥ 6♥ 7♥`
- Joker can substitute for a missing card in a run

### Round End
- **Yaniv** - Call when you have 7 points or less
- **Assaf** - If someone has equal or fewer points than the Yaniv caller

### Scoring
- Losers receive the sum of cards in their hand
- Getting caught in an Assaf adds 30 bonus points
- Reach 100 points? You're out

---

## 🚀 Installation

### Requirements
- Node.js 18+
- npm or yarn
- Expo CLI

### Client Setup

```bash
# Clone the project
git clone https://github.com/YOUR_USERNAME/yaniv.git
cd yaniv

# Install dependencies
npm install

# Create .env file (see .env.example)
cp .env.example .env
# Edit .env with your Firebase credentials

# Run
npx expo start
```

### Server Setup

```bash
cd server

# Install dependencies
npm install

# Development
npm run dev

# Production build
npm run build
npm start
```

---

## 📁 Project Structure

```
yaniv/
├── app/                    # Screens (Expo Router)
│   ├── index.tsx          # Login screen
│   ├── lobby.tsx          # Main lobby
│   ├── create-room.tsx    # Room creation
│   ├── game-table.tsx     # Game screen
│   ├── round-summary.tsx  # Round summary
│   └── game-over.tsx      # Game over
│
├── components/            # Shared components
├── context/              # React Context
│   ├── AuthContext.tsx   # User management
│   └── SoundContext.tsx  # Sound management
│
├── lib/                  # Logic
│   ├── socketService.ts  # Server connection
│   ├── firebase.ts       # Authentication
│   └── gameSounds.ts     # Game sounds
│
├── assets/               # Images and sounds
│   ├── images/cards/     # Card images
│   └── sounds/           # Sound files
│
└── server/               # Game server
    └── src/
        ├── index.ts      # Entry point
        └── game/
            ├── Room.ts       # Room management
            ├── RoomManager.ts # Rooms manager
            └── YanivLogic.ts  # Game rules
```

---

## 🔧 Tech Stack

### Client
- **React Native** + **Expo** - Mobile development
- **TypeScript** - Type safety
- **Expo Router** - Navigation
- **Socket.io Client** - Real-time communication
- **Firebase** - Authentication

### Server
- **Node.js** + **Express**
- **Socket.io** - WebSocket
- **TypeScript**

---

## 🎯 Roadmap

- [ ] End-of-round card matching
- [ ] Tournaments
- [ ] Card skins
- [ ] Full offline mode
- [ ] iPad/Tablet support

---

## 📄 License

MIT License

---

## 👨‍💻 Author

Daniel
