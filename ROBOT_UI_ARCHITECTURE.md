# Robot UI - Next.js Architecture & MQTT Protocol Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Component Architecture](#component-architecture)
3. [State Management](#state-management)
4. [MQTT Protocol](#mqtt-protocol)
5. [Service Sequences](#service-sequences)
6. [Data Flow](#data-flow)
7. [Offline Support](#offline-support)

---

## Project Overview

This is a Next.js 14+ TypeScript application for an exhibition guide robot system. The app provides:
- Interactive map with A* pathfinding
- Real-time robot telemetry via MQTT
- Multi-point navigation
- Drawer inventory control
- AI Chatbot with voice recognition
- Event schedule management
- Offline-first architecture with sync capability

**Tech Stack:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- MQTT.js for WebSocket communication
- Capacitor for native mobile deployment
- Dexie (IndexedDB) for local storage
- Framer Motion for animations

---

## Component Architecture

### Root Layout (`app/layout.tsx`)
```tsx
<html>
  <body>
    <OfflineSync />  {/* Background sync service */}
    {children}       {/* Page content */}
  </body>
</html>
```

### Main Page (`app/page.tsx`)
Grid layout (responsive):
```
┌─────────────────────────────────────────────┐
│  StatusBar (top)                             │
├─────────────────────────────────────────────┤
│  ┌─────────────────────┬───────────────────┐│
│  │                     │                   ││
│  │  ExhibitionMap      │  EventInfo        ││
│  │  (2/3 width)        │  (top right)      ││
│  │                     │                   ││
│  │                     ├───────────────────││
│  │                     │                   ││
│  │                     │  RobotInventory   ││
│  │                     │  (bottom right)   ││
│  │                     │                   ││
│  └─────────────────────┴───────────────────┘│
│  ChatBot (bottom left, overlays map area)   │
└─────────────────────────────────────────────┘
```

### Component Details

#### 1. ExhibitionMap (`components/exhibition/ExhibitionMap.tsx`)
**Purpose:** Interactive 2D map with robot navigation visualization

**Key Features:**
- Canvas-based map rendering (800x800px coordinate system)
- 12 exhibition booths with clickable waypoints
- A* pathfinding on occupancy grid (200x200 cells, 4px per cell)
- Real-time robot position tracking
- Multi-point route queue with drag-and-drop reordering
- Zoom/pan controls
- ETA calculation based on robot speed (1.8 px/tick)

**State:**
```typescript
robotPos: {x, y}           // Current robot position (from MQTT pose)
goalPos: {x, y} | null     // Current navigation target
path: Point[]              // Calculated path waypoints
navStatus: 'idle' | 'planning' | 'moving' | 'arrived'
selectedBooth: string | null
routeQueue: RouteItem[]    // Multi-point queue
isManualPaused: boolean    // User-initiated pause
eta: number                // Estimated time in seconds
```

**MQTT Integration:**
- Subscribes via `useRobotMQTT()` hook to get `pose` and `feedback`
- Publishes navigation commands via `publishCommand()`

**Pathfinding:**
- Grid-based A* with 8-directional movement
- Wall inflation (2-cell buffer) for safety margin
- Path simplification (every 3rd point) for smoother rendering

#### 2. RobotInventory (`components/exhibition/RobotInventory.tsx`)
**Purpose:** Control robot's drawer system for item delivery

**Features:**
- 3 drawers (Beverages, Snacks, Catalogues) with visual states
- 15-second countdown timer when drawer opens
- Auto-resumes robot after timer expires
- Drawer open/close commands via MQTT

**Drawer States:**
- Closed: dim glow, subtle border
- Opening: bright glow, pulsing animation, border highlight
- Open: countdown timer displayed

**MQTT Commands:**
- `robot/drawer/cmd` - Open specific drawer
- `robot/cmd/pause` - Pause robot during drawer access
- `robot/cmd/resume` - Resume after drawer closes

#### 3. ChatBot (`components/exhibition/ChatBot.tsx`)
**Purpose:** AI-powered conversational assistant

**Features:**
- Dual mode: compact inline + expanded modal
- Voice input via Capacitor Speech Recognition (Android) or Web Speech API (browser)
- Streaming responses from Gemini API
- Markdown rendering with custom styling
- Fallback responses when offline

**Voice Recognition Flow:**
1. User taps microphone button
2. `VoiceOverlay` component opens with animated waveform
3. Starts listening (Capacitor or Web Speech API)
4. Real-time partial results displayed
5. Auto-send after 3s silence OR manual stop button
6. Message sent to chat stream

**Chat Service:**
- `lib/chatService.ts` - handles Gemini API streaming
- Fallback responses stored locally for offline mode

#### 4. EventInfo (`components/exhibition/EventInfo.tsx`)
**Purpose:** Display event schedule and announcements

**Features:**
- Auto-rotating banner carousel (3s interval)
- Compact schedule list showing current/upcoming events
- Full schedule modal with scrollable timeline
- Admin mode (hidden: tap header 5 times) to edit schedule
- Real-time status badges (Live, Upcoming, Done)

**Data Flow:**
- Loads from `localStorage` immediately (via `loadSchedule()`)
- Fetches from mock API in background (`fetchScheduleApi()`)
- Updates every minute to refresh status badges

#### 5. StatusBar (`components/exhibition/StatusBar.tsx`)
**Purpose:** Top status bar with connection indicators

**Displays:**
- Robot connection status (green/red dot)
- Battery percentage (from MQTT)
- Robot state (IDLE, NAVIGATING, etc.)
- Current time (updates every second)
- Date in Vietnamese format

#### 6. OfflineSync (`components/OfflineSync.tsx`)
**Purpose:** Background service for offline-first data sync

**Behavior:**
- Runs on app mount (invisible component)
- Listens to Capacitor Network status changes
- Polls every 15 seconds for pending items
- When online: batches all queued telemetry and sends to remote API
- On success: deletes synced items from IndexedDB
- Retries on failure (exponential backoff not implemented)

---

## State Management

### Global MQTT State (Singleton Pattern)

**File:** `hooks/useRobotMQTT.ts`

The hook uses a **global singleton** approach to share MQTT state across all components without prop drilling:

```typescript
// Global variables (module-level)
let client: MqttClient | null = null;
let isInitialized = false;

const globalState = {
  isConnected: false,
  battery: null,
  robotStatus: null,
  pose: null,
  feedback: null,
};

const listeners = new Set<() => void>();  // React render triggers
```

**Initialization:**
- `initMQTT()` - called once on first hook mount
- Connects to `ws://localhost:9001`
- Subscribes to 4 topics
- Sets up message handlers to update `globalState`
- Calls `notifyAll()` to trigger re-renders in all subscribed components

**Hook API:**
```typescript
const {
  isConnected,
  battery,
  robotStatus,
  pose,
  feedback,
  publishCommand,
} = useRobotMQTT();
```

**Publish Function:**
```typescript
publishCommand(topic: string, payload: any) => {
  if (client?.connected) {
    client.publish(topic, JSON.stringify(payload));
  }
}
```

### Component State
Each component manages its own UI state (forms, modals, selections) using React hooks (`useState`, `useRef`, `useCallback`).

---

## MQTT Protocol

### Broker Configuration
- **URL:** `ws://localhost:9001` (WebSocket endpoint)
- **Reconnect:** 3000ms interval
- **Keepalive:** 10 seconds
- **Timeout:** 5000ms

### Subscription Topics

| Topic | Data Type | Description | Update Rate |
|-------|-----------|-------------|-------------|
| `robot/battery/soc` | `number` | Battery state of charge (%) | ~1Hz |
| `robot/state/state` | `RobotStatePayload` | Robot operational state (IDLE, NAVIGATING, etc.) | On change |
| `robot/state/pose` | `RobotPosePayload` | Real-time position (x, y, yaw) | ~10Hz |
| `robot/state/service_feedback` | `RobotFeedbackPayload` | Navigation command status | On event |

**Payload Types:**
```typescript
interface RobotStatePayload {
  time: number;      // Unix timestamp (ms)
  state: string;     // "IDLE", "NAVIGATING", "CHARGING", etc.
}

interface RobotPosePayload {
  time: number;      // Unix timestamp (ms)
  x: number;         // X coordinate in meters (or pixels depending on config)
  y: number;         // Y coordinate
  yaw: number;       // Heading in radians
}

interface RobotFeedbackPayload {
  command_id: string; // Matches the command_id from service_request
  status: string;     // "EXECUTING", "SUCCEEDED", "FAILED", "CANCELED"
}
```

### Publish Topics (Commands)

#### 1. Navigation: `robot/cmd/service_request`
**Purpose:** Send navigation waypoints to robot

**Payload:**
```typescript
{
  command_id: string;      // Unique ID for tracking
  data: {
    x: number;             // Target X coordinate
    y: number;             // Target Y coordinate
    yaw: number;           // Target orientation (radians)
    customer_id: string;   // Client identifier ("tablet")
    timeout_sec: number;   // 0 = no timeout
    return_to_patrol: boolean; // false for one-time navigation
    priority: number;      // 1-5, higher = more urgent
    speed_limit_ms: number; // Max speed in m/s (1.5 = normal)
  }
}
```

**Usage in ExhibitionMap:**
- Single point: send one `service_request`
- Multi-point: send multiple with 150ms delay between each
- Robot executes sequentially based on `priority` and queue

#### 2. Pause: `robot/cmd/pause`
**Purpose:** Temporarily stop robot movement

**Payload:** Empty object `{}` (or optional `{speed_limit_ms: 0}`)

**Triggers:**
- User interaction detected (touch/mouse) - automatic after 30s resume
- Manual pause button in UI
- Drawer opening (inventory component)

**Behavior:**
- Sets speed limit to 0 m/s
- Robot stops but maintains current goal in queue
- Can be resumed without re-sending navigation

#### 3. Resume: `robot/cmd/resume`
**Purpose:** Continue movement after pause

**Payload:** Empty object `{}` (or optional `{speed_limit_ms: 1.5}`)

**Triggers:**
- 30 seconds after last user interaction (auto-resume)
- Manual resume button
- Drawer close completion

**Behavior:**
- Restores speed limit to 1.5 m/s (or last known speed)
- Robot continues to current goal

#### 4. Cancel: `robot/cmd/cancel_request`
**Purpose:** Cancel all pending navigation commands

**Payload:**
```typescript
{
  command_id: "*"  // Wildcard cancels all commands
}
```

**Triggers:**
- User clicks "Cancel Navigation" button
- Navigation failure recovery

**Behavior:**
- Clears robot's command queue
- Robot stops immediately
- UI resets to idle state

#### 5. Drawer Control: `robot/drawer/cmd`
**Purpose:** Open/close storage drawers on robot

**Payload:**
```typescript
{
  drawer: number;    // Drawer ID (1, 2, or 3)
  cmd: "OPEN" | "CLOSE"
}
```

**Workflow:**
1. Send `robot/cmd/pause` to stop robot
2. Send `robot/drawer/cmd` with `OPEN`
3. Wait 15 seconds (countdown in UI)
4. Send `robot/drawer/cmd` with `CLOSE` (optional, auto-close?)
5. Send `robot/cmd/resume` to continue

---

## Service Sequences

### Sequence 1: Normal Navigation (Single Destination)

```
User selects booth on map
    │
    ├─> UI: Calculate path via A*
    │
    ├─> MQTT: Publish robot/cmd/service_request
    │   {
    │     command_id: "nav_123456",
    │     data: { x: 400, y: 760, yaw: 0, speed_limit_ms: 1.5, ... }
    │   }
    │
    ├─> Robot: Executes navigation
    │
    ├─> MQTT: Subscribe to robot/state/service_feedback
    │   Receives: { command_id: "nav_123456", status: "EXECUTING" }
    │   UI: Set navStatus = 'moving'
    │
    ├─> MQTT: Pose updates (10Hz)
    │   Receives: { time: ..., x: ..., y: ..., yaw: ... }
    │   UI: Update robot position on map
    │
    └─> MQTT: Feedback { status: "SUCCEEDED" }
        UI: Set navStatus = 'arrived', clear path
```

### Sequence 2: Multi-Point Navigation

```
User adds multiple booths to route queue
    │
    ├─> UI: routeQueue = [{x:100,y:100}, {x:200,y:200}, ...]
    │
    ├─> User clicks "Start Navigation"
    │
    ├─> For each waypoint (with 150ms delay):
    │   MQTT: Publish robot/cmd/service_request
    │     { command_id: "nav_123_0", data: {x:100,y:100,...} }
    │     { command_id: "nav_123_1", data: {x:200,y:200,...} }
    │     ...
    │
    ├─> Robot: Queues all waypoints, executes sequentially
    │
    ├─> MQTT: Feedback for each waypoint
    │   { command_id: "nav_123_0", status: "SUCCEEDED" }
    │   { command_id: "nav_123_1", status: "EXECUTING" }
    │   ...
    │
    └─> UI: Updates path to current target, ETA countdown
```

### Sequence 3: Automatic Pause on User Interaction

```
User touches screen / clicks mouse
    │
    ├─> Event listener triggers (in useRobotMQTT)
    │
    ├─> If not already paused:
    │   MQTT: Publish robot/cmd/pause {}
    │   isPaused = true
    │   UI: Show paused indicator
    │
    ├─> Reset 30-second timer
    │
    └─> If no interaction for 30s:
        MQTT: Publish robot/cmd/resume {}
        isPaused = false
        UI: Resume movement
```

**Note:** This auto-pause is global - any touch anywhere triggers it.

### Sequence 4: Drawer Operation with Pause/Resume

```
User clicks drawer in RobotInventory
    │
    ├─> UI: setOpenDrawer(id), setTimeLeft(15)
    │
    ├─> MQTT: Publish robot/cmd/pause {}
    │
    ├─> MQTT: Publish robot/drawer/cmd
    │   { drawer: 1, cmd: "OPEN" }
    │
    ├─> Robot: Stops, opens drawer
    │
    ├─> UI: 15-second countdown timer
    │
    └─> After 15s:
        MQTT: Publish robot/cmd/resume {}
        UI: setOpenDrawer(null)
```

### Sequence 5: Cancel Navigation

```
User clicks "Cancel Navigation" button
    │
    ├─> UI: Reset all state (navStatus='idle', clear path, etc.)
    │
    └─> MQTT: Publish robot/cmd/cancel_request
        { command_id: "*" }
        │
        └─> Robot: Stops immediately, clears command queue
```

---

## Data Flow

### Real-Time Telemetry Flow

```
ROS2 Robot
    │ (MQTT messages)
    ▼
MQTT Broker (ws://localhost:9001)
    │ (WebSocket)
    ▼
useRobotMQTT Hook (global singleton)
    │ (globalState updates + listener notifications)
    ▼
Components (ExhibitionMap, StatusBar, etc.)
    │ (React re-render)
    ▼
UI Updates (robot position, battery, status)
```

### Navigation Command Flow

```
ExhibitionMap Component
    │ (user clicks booth)
    ▼
A* Pathfinding (client-side)
    │ (waypoints calculated)
    ▼
publishCommand('robot/cmd/service_request', payload)
    │
    ▼
MQTT Broker
    │
    ▼
Robot Controller (subscribes to same topic)
    │
    ▼
Robot executes navigation
    │
    ▼
Feedback via robot/state/service_feedback
    │
    ▼
ExhibitionMap receives feedback → updates navStatus
```

### Offline Storage Flow

```
MQTT Message Received
    │
    ├─> Parse and update globalState
    │
    ├─> Check network status (Capacitor Network)
    │
    ├─> IF offline:
    │   └─> db.syncQueue.add({ topic, payload, timestamp })
    │       (Throttled: pose messages limited to 1 per 5s)
    │
    └─> IF online:
        └─> No local storage (real-time only)
```

### Sync to Remote Database

```
OfflineSync Component (runs in background)
    │
    ├─> Every 15s OR on network reconnect
    │
    ├─> Check db.syncQueue.toArray()
    │
    ├─> IF pending items exist AND online:
    │   └─> POST /api/telemetry/sync (TODO: implement endpoint)
    │       Body: { data: pendingItems }
    │
    ├─> IF response.ok:
    │   └─> bulkDelete synced items
    │
    └─> IF error:
        └─> Keep items in queue, retry next cycle
```

---

## Offline Support

### Local Database (Dexie/IndexedDB)

**Schema:** `RobotLocalDB`
- Table: `syncQueue`
- Fields: `++id` (auto-increment), `topic`, `payload`, `timestamp`
- Indexes: `topic`, `timestamp` for querying

### Offline Detection
- Uses `@capacitor/network` plugin for accurate network status
- Fallback to `navigator.onLine` for web browsers
- Listens to `networkStatusChange` events

### Offline Behavior
1. **Telemetry:** All MQTT messages stored locally when offline
2. **Commands:** Cannot publish when offline (no queue for outgoing)
3. **UI:** Shows red connection indicator in StatusBar
4. **Chat:** Falls back to local responses (no Gemini API)
5. **Sync:** Automatic when connection restored

### Data Throttling
- Pose messages (`robot/state/pose`) are high-frequency (~10Hz)
- To prevent DB bloat, pose storage is throttled to 1 message per 5 seconds (commented out in current code)
- Other topics (battery, state, feedback) stored on every message

---

## Key Patterns & Best Practices

### 1. Global Singleton for Cross-Component State
- MQTT client and state live at module level
- Hook subscribes components to global updates via listener set
- Avoids prop drilling and context provider complexity

### 2. Offline-First with Sync Queue
- All incoming telemetry queued for later sync
- Background service handles retry logic
- UI remains responsive regardless of network

### 3. Client-Side Pathfinding
- A* algorithm runs in browser (no server dependency)
- Grid pre-computed once on module load
- Simplified path for smooth rendering

### 4. Responsive Design
- Mobile-first with Tailwind breakpoints
- Modal overlays for complex interactions on small screens
- Touch-friendly button sizes (min 44px recommended)

### 5. Capacitor Integration
- Native plugins for network status, speech recognition
- Web Speech API fallback for browsers
- App runs as PWA or native Android app

---

## Configuration Files

### `package.json` (key dependencies)
```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "dexie": "^3",
    "mqtt": "^5",
    "@capacitor/core": "^6",
    "@capacitor/network": "^6",
    "@capacitor-community/speech-recognition": "^6",
    "framer-motion": "^11",
    "lucide-react": "^0.400",
    "react-markdown": "^9"
  }
}
```

### `capacitor.config.ts`
- Configures native Android build
- WebView URL points to Next.js dev server or production build

---

## Development Notes

### Running the App
```bash
# Development
pnpm dev
# → http://localhost:3000

# Build for production
pnpm build
pnpm start

# Sync to Android
pnpm build
npx cap sync android
npx cap open android
```

### MQTT Broker Setup
The app expects a WebSocket MQTT broker at `ws://localhost:9001`. For testing:
- Use [Mosquitto](https://mosquitto.org/) with WebSocket support
- Or use [HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud-broker/) with WebSocket endpoint
- Update `brokerUrl` in `useRobotMQTT.ts` to match your broker

### Simulating Robot Data
To test without real robot, publish test messages:
```bash
mosquitto_pub -h localhost -p 9001 -t "robot/state/pose" -m '{"time":123,"x":400,"y":760,"yaw":0}'
mosquitto_pub -h localhost -p 9001 -t "robot/battery/soc" -m "85"
mosquitto_pub -h localhost -p 9001 -t "robot/state/state" -m '{"time":123,"state":"NAVIGATING"}'
```

---

## Future Improvements

1. **Authentication:** Add JWT or API key for MQTT broker security
2. **Error Handling:** More robust retry logic for failed commands
3. **Path Smoothing:** Implement spline interpolation for curved paths
4. **Obstacle Avoidance:** Dynamic replanning when walls/people detected
5. **Admin Panel:** Full CRUD for schedule, robot config, user management
6. **Analytics:** Track usage patterns, navigation success rates
7. **Multi-Robot:** Support multiple robots with selection UI
8. **Voice Commands:** Navigate via voice ("Go to booth A1")
9. **Push Notifications:** Event reminders, robot status alerts
10. **Remote Database:** Implement actual sync endpoint (currently mocked)

---

## Contact & Credits

**Architecture:** Next.js 14 App Router with TypeScript  
**Design:** Custom dark theme with Tailwind CSS  
**MQTT Protocol:** Custom JSON-based command/feedback schema  
**Team:** Roo (AI Assistant) - Generated documentation 2026-05-26
