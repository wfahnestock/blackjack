# 🎲 Blackjack React

A real-time multiplayer blackjack game built with React, TypeScript, and Socket.io. Play classic blackjack with friends in private rooms with customizable game settings, chip management, and optional card counting features.

## ✨ Features

### 🎮 Game Features
- **Classic Blackjack Gameplay**: Full implementation of standard blackjack rules
- **Multiplayer Support**: Play with friends in real-time using room codes
- **Advanced Actions**: Hit, stand, double down, split pairs, and insurance bets
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
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS
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
   - **Server**: WebSocket server at `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start both client and server in development mode
- `npm run dev:app` - Start only the React client  
- `npm run dev:server` - Start only the Node.js server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run typecheck` - Run TypeScript type checking

## 🎲 How to Play

### Creating a Game
1. **Start a Room**: Choose "Create Room" from the main menu
2. **Configure Settings**: Set betting limits, timers, and game rules  
3. **Share Room Code**: Give the generated room code to other players
4. **Begin Playing**: Start the game once all players have joined

### Gameplay
1. **Place Bets**: Each player places their initial bet using the chip interface
2. **Receive Cards**: Dealer deals 2 cards to each player and 1 to themselves
3. **Make Decisions**: Players take turns choosing their actions:
   - **Hit**: Take another card
   - **Stand**: Keep current hand
   - **Double Down**: Double bet and receive exactly one more card
   - **Split**: Split matching cards into two separate hands
4. **Dealer Plays**: Dealer reveals their hole card and plays according to dealer rules
5. **Payouts**: Winnings are distributed based on hand outcomes
6. **Bankruptcy Insurance**: Optional table setting; Players who run out of chips will receive a free 100 chips to keep playing

### Card Counting (Optional)
- Enable "Card Counting Hints" in room settings
- View the running Hi-Lo count during gameplay
- Use the count to inform your betting and playing decisions

## 🏗️ Architecture

### Frontend (`/app`)
- **React Router 7**: Modern routing and server-side rendering
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
  - `ChipLedger.ts` - Player chip balance management

### Data Flow
1. **Client Actions**: Player interactions emit Socket.io events
2. **Server Processing**: Game logic validates and processes actions
3. **State Updates**: Server broadcasts updated game state to all clients
4. **UI Updates**: React components re-render based on new state

## 🐳 Deployment

### Docker Deployment
```bash
# Build the Docker image
docker build -t blackjack-react .

# Run the container
docker run -p 3000:3000 blackjack-react
```

### Production Build
```bash
# Create production build
npm run build

# Start production server  
npm run start
```

### Environment Variables
- `CLIENT_ORIGIN`: CORS origin for client connections (default: `http://localhost:5173`)
- `PORT`: Server port (default: 3000)

## 🛠️ Development

### Project Structure
```
├── app/                    # React frontend
│   ├── components/         # React components
│   ├── lib/               # Shared utilities and hooks
│   ├── routes/            # Page routes
│   └── welcome/           # Landing page
├── server/                # Node.js backend
│   ├── ChipLedger.ts     # Player balance management
│   ├── Deck.ts           # Card deck implementation
│   ├── GameRoom.ts       # Room and player management
│   ├── GameStateMachine.ts # Game flow control
│   ├── HandEvaluator.ts  # Blackjack logic
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

This implementation follows standard blackjack rules:

- **Objective**: Get hand value as close to 21 as possible without going over
- **Card Values**: Numbers = face value, Face cards = 10, Aces = 1 or 11
- **Dealer Rules**: Dealer must hit on soft 17 and below, stand on 17 and above  
- **Blackjack**: 21 with first two cards pays 3:2
- **Push**: Tie hands return the original bet
- **Doubling**: Allowed on any first two cards
- **Splitting**: Allowed on matching rank cards (limited to two splits - 3 hands total, per player)

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