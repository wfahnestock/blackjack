# 🎲 Blackjack React

A real-time multiplayer blackjack game built with React, TypeScript, and Socket.io. Play classic blackjack with up to 6 friends in private rooms with customizable game settings, chip management, and optional card counting features.

## ✨ Features

### 🎮 Game Features
- **Blackjack Gameplay**: Standard actions and payouts, with a dealer that plays *near*-standard rules (see [Game Rules](#-game-rules) for the intentional twist)
- **Multiplayer Support**: Play with friends in real-time using room codes
- **Advanced Actions**: Hit, stand, double down, split pairs, and insurance (offered when the dealer shows an Ace)
- **Card Counting**: Optional Hi-Lo counting system with running count display
- **Betting System**: Configurable chip denominations (5, 10, 25, 50, 100, 500)
- **Hand Management**: Support for split hands and multiple simultaneous hands

### 🎯 Room & Player Features
- **Private Rooms**: Create or join games using unique room codes
- **Player Customization**: Choose display names and avatar colors
- **Chip Management**: Starting chips, daily bonuses, and bankruptcy protection
- **Seat System**: Up to multiple players per table with visual seat indicators
- **Host Controls**: Room creators can configure game settings

### ⚙️ Configurable Settings
- **Betting Limits**: Adjustable minimum and maximum bet amounts
- **Timers**: Customizable betting and turn time limits
- **Starting Conditions**: Configure starting chips and daily chip bonuses
- **Game Rules**: Toggle card counting hints and bankruptcy protection

### 🔧 Technical Features
- **Real-time Gameplay**: Socket.io powered multiplayer synchronization
- **Sound Effects**: Interactive audio feedback for game actions
- **Responsive Layout**: Tailwind-based layout that adapts down to phone widths (best experienced on tablet or desktop)
- **Type Safety**: Full TypeScript implementation on both client and server
- **State Management**: Robust game state handling with phase management

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/wfahnestock/blackjack.git
   cd blackjack-react
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```
   
   This concurrently starts:
   - **Client**: React app at `http://localhost:5173`
   - **Server**: WebSocket + API server at `http://localhost:3001`

### Available Scripts

- `npm run dev` - Start both client and server in development mode
- `npm run dev:app` - Start only the React client  
- `npm run dev:server` - Start only the Node.js server
- `npm run build` - Build the production SPA (outputs to `build/client`)
- `npm run start` - Start the custom server (serves an existing build)
- `npm run serve` - Build then start the server (one-shot production run)
- `npm run typecheck` - Run TypeScript type checking
- `npm run simulate` - Run the blackjack EV/house-edge simulation

## 🎲 How to Play

### Creating a Game
1. **Start a Room**: Choose "Create Room" from the main menu
2. **Configure Settings**: Set betting limits, timers, and game rules  
3. **Share Room Code**: Give the generated room code to other players
4. **Begin Playing**: Start the game once all players have joined

### Gameplay
1. **Place Bets**: Each player places their initial bet using the chip interface
2. **Receive Cards**: Dealer deals 2 cards to each player and 1 to themselves
3. **Insurance** (conditional): If the dealer's upcard is an Ace, each player may buy insurance for half their bet. It pays 2:1 if the dealer has blackjack.
4. **Make Decisions**: Players take turns choosing their actions:
   - **Hit**: Take another card
   - **Stand**: Keep current hand
   - **Double Down**: Double bet and receive exactly one more card
   - **Split**: Split matching cards into two separate hands
5. **Dealer Plays**: Dealer reveals their hole card and plays (see [Game Rules](#-game-rules))
6. **Payouts**: Winnings are distributed based on hand outcomes
7. **Bankruptcy Protection**: Optional table setting; players who run out of chips receive a free 100 chips to keep playing

### Card Counting (Optional)
- Enable "Card Counting Hints" in room settings
- View the running Hi-Lo count during gameplay
- Use the count to inform your betting and playing decisions

## 🏗️ Architecture

### Frontend (`/app`)
- **React Router 7**: Modern routing, configured in SPA mode (`ssr: false`, client-rendered)
- **TypeScript** 
- **Tailwind CSS**: Responsive design
- **Component Architecture**:
  - `components/game/` - Game table, cards, betting controls
  - `components/lobby/` - Room management and player setup
  - `components/ui/` - Reusable UI components
  - `routes/` - Page components and routing logic

### Backend (`/server`)
- **Express.js**: HTTP server foundation
- **Socket.io**: Real-time WebSocket communication
- **Game Engine Components**:
  - `GameRoom.ts` - Room management and player coordination
  - `GameStateMachine.ts` - Game flow and phase management  
  - `Deck.ts` - Card deck management and shuffling
  - `HandEvaluator.ts` - Blackjack hand value calculation
  - `DealerBehavior.ts` - Probabilistic dealer decision engine

### Data Flow
1. **Client Actions**: Player interactions emit Socket.io events
2. **Server Processing**: Game logic validates and processes actions
3. **State Updates**: Server broadcasts updated game state to all clients
4. **UI Updates**: React components re-render based on new state

## 🐳 Deployment

### Production Build (recommended)

The app runs in SPA mode and is served by the custom Express + Socket.io server, which hosts the built client, the REST API, and the WebSocket on a single origin/port.

```bash
# Build the SPA and start the server (serves build/client + /api + /socket.io on port 3001)
npm run serve
```

Then point your tunnel/proxy (e.g. ngrok) at port `3001`. Everything is same-origin, so no extra CORS config is needed.

> **Note:** The included `Dockerfile` predates the current custom-server setup and will not work as-is (it omits dev deps and does not copy the `server/` source, but `start` runs the server via `tsx`). Fixing it requires either bundling the server or including `tsx` in the image — see the note in the summary before relying on Docker.

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- `JWT_SECRET`: Secret for signing auth tokens (required in production)
- `CLIENT_ORIGIN`: CORS origin for cross-origin clients (default: `http://localhost:5173`; unnecessary when same-origin)
- `PORT`: Server port (default: `3001`)

## 🛠️ Development

### Project Structure
```
├── app/                    # React frontend
│   ├── components/         # React components
│   ├── lib/               # Shared utilities and hooks
│   ├── routes/            # Page routes
│   └── welcome/           # Landing page
├── server/                # Node.js backend
│   ├── DealerBehavior.ts # Probabilistic dealer engine
│   ├── Deck.ts           # Card deck implementation
│   ├── GameRoom.ts       # Room and player management
│   ├── GameStateMachine.ts # Game flow control
│   ├── HandEvaluator.ts  # Blackjack logic
│   ├── achievements/     # Achievement engine & definitions
│   ├── auth/             # JWT auth service
│   ├── db/               # Drizzle repositories & schema
│   └── index.ts          # Server entry point
├── public/               # Static assets
└── build/                # Production build output
```

### Adding New Features
1. **Game Rules**: Modify `HandEvaluator.ts` and `GameStateMachine.ts`
2. **UI Components**: Add to appropriate `components/` directory
3. **Socket Events**: Update `types.ts` interfaces and add handlers in `server/index.ts`
4. **Game Settings**: Extend `GameSettings` interface in `types.ts`

## 🎯 Game Rules

This implementation follows standard blackjack rules, with one **deliberate exception** noted under Dealer Rules:

- **Objective**: Get hand value as close to 21 as possible without going over
- **Card Values**: Numbers = face value, Face cards = 10, Aces = 1 or 11
- **Dealer Rules**: The dealer targets standard strategy (hit on 16 and below, stand on 17 and above) but plays with slight, bounded randomness in the 15–18 range. This is intentional: a mathematically perfect dealer plus the house edge left basic-strategy players on constant losing streaks, so the dealer is tuned to feel fairer. The behavior lives in `server/DealerBehavior.ts` and can be reverted to a strictly deterministic dealer via its `enabled` master switch.
- **Insurance**: Offered when the dealer's upcard is an Ace. Costs half the bet, pays 2:1 if the dealer has blackjack (no-peek: the hole card is still revealed on the dealer's turn).
- **Blackjack**: 21 with first two cards pays 3:2
- **Push**: Tie hands return the original bet
- **Doubling**: Allowed on any first two cards
- **Splitting**: Allowed on matching rank cards (limited to two splits - 3 hands total, per player)
- **Five-Card Charlie**: Optional table setting; five cards without busting is an automatic win

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

---

Built with ❤️ using React Router, TypeScript, and Socket.io