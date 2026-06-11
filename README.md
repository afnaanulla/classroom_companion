# Classroom Companion

Classroom Companion is a production-ready, AI-agentic Telegram bot and Web Dashboard system designed to streamline teacher-student communication, task management, and progress tracking.

Built using **Express (TypeScript)** for the backend, **React (Vite + TS)** for the web client, **Prisma (PostgreSQL)** for persistence, and **Groq (LLaMA 3.3)** for the multi-agent AI orchestration layer.

---

## 📐 System Architecture

```
                       ┌─────────────────────────────────────────┐
                       │           Telegram Bot Interface        │
                       │  (Commands, Natural Language, Chat)    │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │          AI Orchestrator Pipeline       │
                       │                                         │
                       │ ┌─────────────────────────────────────┐ │
                       │ │        Intent Router Agent          │ │
                       │ └──────────────────┬──────────────────┘ │
                       │                    │                    │
                       │          ┌─────────┴─────────┐          │
                       │          ▼                   ▼          │
                       │ ┌─────────────────┐ ┌─────────────────┐ │
                       │ │  Teacher Agent  │ │  Student Agent  │ │
                       │ └─────────────────┘ └─────────────────┘ │
                       │          │                   │          │
                       │          ▼                   ▼          │
                       │ ┌─────────────────┐ ┌─────────────────┐ │
                       │ │ Reminder Agent  │ │Summarizer Agent │ │
                       │ └─────────────────┘ └─────────────────┘ │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │            Service Layer (API)          │
                       │ (User, Assignment, Submission, Feedback)│
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │              Database Layer             │
                       │          Prisma ORM (PostgreSQL)        │
                       └─────────────────────────────────────────┘
```

---

## 🚀 Core Features

### 👩‍🏫 For Teachers
- **Custom Onboarding**: Register in Telegram with `/register_teacher [Name]`.
- **Dynamic Linking Codes**: Generate invite codes that expire in 24 hours or after 5 uses. Regenerate codes using `/new_code`.
- **Natural Language Assignments**: Assign tasks by sending plain language messages:
  `Assign Harry Potter to write a 500-word essay on transfiguration, due in 2 days.`
- **Audit student lists**: Send `/my_students` in Telegram, or browse the Web UI sidebar.
- **AI-Powered Status Reports**: Get narrative student status reports inside Telegram (`/status`) or the Web UI generated on the fly.
- **Interactive Reviews**: Read student text submissions and submit structured feedback from the web interface.

### 🎓 For Students
- **Onboarding**: Register with `/register_student [Name]` and link to a teacher with `/link_teacher [code]`.
- **Assignment View**: List assignments inside Telegram (`/my_assignments`) or check due dates and progress on the Student Web Dashboard.
- **AI Progress Reports**: Send plain language progress updates to the bot:
  `I'm about 40% done with the essay but stuck on the intro.`
  *(The Student Agent automatically estimates completion percentages and sentiment, updating the teacher's dashboard.)*
- **Submissions**: Submit assignments inside the Web Dashboard or via Telegram by typing *"done"* or *"submitting"*.
- **Feedback Alerts**: Read teacher comments instantly under `/my_feedback` or the student workspace.

### 💬 Real-Time Chat Forwarding
- **Message Command**: Send direct messages using `/message <name> <text>` (teachers) or `/message <text>` (students).
- **Native Telegram Replies**: Reply directly to any bot message (double-tap or right-click -> "Reply") to forward messages back and forth in real-time.

---

## 🧠 AI Agent Orchestration (Groq LLaMA 3.3)

The project leverages a multi-agent system built on top of the LLaMA 3.3 70B model:

1. **Intent Router Agent**: Parses incoming texts and routes them to task actions (`ASSIGNMENT_INSTRUCTION`, `STATUS_UPDATE`, `COMPLETION_NOTICE`, `QUERY`, `OTHER`). If confidence is under 60%, it asks the user for clarification.
2. **Teacher Agent**: Extracts structured JSON configurations (assignment title, instructions, target student, due date) from raw teacher prompts.
3. **Student Agent**: Classifies progress descriptions, infers estimated progress percentages, and detects sentiment (stuck vs. on-track).
4. **Reminder Agent**: Decides dynamic, escalating reminder templates (Gentle -> Moderate -> Urgent -> Overdue) based on deadline proximity.
5. **Summarizer Agent**: Gathers database records on active assignments, student logs, and progress updates to compile narrative status summaries for teachers.

---

## 🛠️ Project Setup & Installation

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL Database (e.g. Neon, Local PostgreSQL)
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Groq API Key (from [Groq Console](https://console.groq.com/))

### 2. Backend Setup (`sandra/`)
1. Navigate to the backend directory:
   ```bash
   cd sandra
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/db"
   TELEGRAM_BOT_TOKEN="your_bot_token"
   GROQ_API_KEY="gsk_your_key"
   PORT=3000
   ```
4. Run Prisma migrations:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Generate the Prisma Client types:
   ```bash
   npx prisma generate
   ```
6. Start the Express development server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup (`sandra-ui/`)
1. Navigate to the frontend directory:
   ```bash
   cd sandra-ui
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   *The client will boot on `http://localhost:5173`.*

---

## 🔒 Production Readiness & Safeguards
- **Type-Safety**: Clean TypeScript type definitions compiled under strict checking options.
- **Telegram HTML Parse Safety**: Text inputs containing HTML characters or symbols are escaped using a utility `escapeHTML` to prevent bot crashes.
- **Fail-Safe Response Fallbacks**: In the catch-all message listener, any message failing Markdown entity validation is automatically caught and delivered as plain text, ensuring the bot remains online.
- **Structured LLM Audits**: Every prompt and raw JSON response from Groq is logged inside the `AgentLog` table along with execution latency for monitoring.
- **Graceful Shutdown**: Express server and database pools disconnect safely on system exit (`SIGINT` / `SIGTERM`).
