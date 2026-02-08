# 🃏 Yaniv Card Game

A real-time mobile application for the classic Yaniv card game, featuring local AI play and online multiplayer.

![React Native](https://img.shields.io/badge/React%20Native-0.81-blue)
![Expo](https://img.shields.io/badge/Expo-54-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Socket.io](https://img.shields.io/badge/Socket.io-4.7-green)


---

## 🚀 Engineering Highlights

1.  **Real-Time Sync:** Managed complex game states across multiple clients using **Socket.io** to ensure zero-lag interactions.
2.  **Server-Side Logic:** All game rules (Sticking, Assaf, Runs) are validated on the **Node.js** server to prevent client-side manipulation.
3.  **Type Safety:** Leveraged **TypeScript** to define strict interfaces for game actions, reducing runtime errors in the multiplayer flow.
4.  **State Management:** Implemented **React Context** for efficient handling of authentication and global sound settings.

---

## 📱 Features

* **Online Multiplayer:** Private rooms with real-time updates via WebSockets.
* **Local Play:** Playable against custom AI opponents for offline practice.
* **Advanced Mechanics:** Full support for "Sticking" (2s window), "Assaf" penalties, and Joker substitutions.
* **Social Features:** Integrated in-game chat, emoji reactions, and a competitive leaderboard.

---

## 🛠 Tech Stack

* **Frontend:** React Native, Expo, Expo Router, TypeScript.
* **Backend:** Node.js, Express, Socket.io.
* **Services:** Firebase (Authentication).

---

## 📁 Project Structure

```bash
yaniv/
├── app/             # Screens & Navigation (Expo Router)
├── components/      # UI Components
├── context/         # Auth & Global State
├── lib/             # Socket services & Firebase config
└── server/          # Node.js Server logic (Room & Game managers)
```
## 📱 App Preview

| Game Setup | Player Turn | Yaniv Moment! | Statistics |
| :---: | :---: | :---: | :---: |
| ![Image 1](https://github.com/user-attachments/assets/36809a05-1ce9-4d67-992d-fdf82a45eb5b) | ![Image 2](https://github.com/user-attachments/assets/739ec85d-ba4a-43fe-becf-db56cacbaa44) | ![Image 3](https://github.com/user-attachments/assets/50aff6dd-2360-4ef8-892f-b52baa0cc3a7) | ![Image 4](https://github.com/user-attachments/assets/7346573b-c87b-49e4-b4a9-8467784f7ca2) |

---

## 🎮 How to Run

1.  **Clone:** `git clone https://github.com/Danvngr/yaniv.git`
2.  **Server:** `cd server && npm install && npm run dev`
3.  **Client:** `cd .. && npm install && npx expo start`

---

**Author:** Daniel | CS Student
