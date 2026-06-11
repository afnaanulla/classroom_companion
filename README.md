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
- **Environment-Driven URLs**: All file download links and API URLs are driven by environment variables (`BACKEND_URL`, `VITE_API_URL`), ensuring portability between local dev and production deployment.

---

## 🤖 AI Collaboration Craft

### Tools Used
- **GitHub Copilot / Claude**: Used throughout development for code generation, prompt engineering, and debugging.
- **Groq Console Playground**: Used to test and iterate on agent prompts before embedding them in code.

### Prompt Engineering Strategy
- **Few-Shot Examples**: Each agent prompt includes concrete input→output examples (e.g., the Student Agent prompt shows `"Done 3 paragraphs out of 5" → 60%, on-track`).
- **Structured JSON Output**: All agents are instructed to respond **only** with valid JSON in a specific schema, with a fallback `parseJSON` function that regex-extracts the JSON object even if the LLM wraps it in markdown code blocks.
- **Confidence Thresholds**: The Intent Router Agent is instructed to output a confidence score. If below 0.6, the system asks the user for clarification instead of guessing — this avoids misrouting messages.
- **Temperature 0.3**: Low temperature is used across all agents for deterministic, reliable outputs. Higher temperatures caused inconsistent JSON structures.

### What Worked Well
- **Single-prompt per agent**: Keeping each agent focused on one task (classify, parse, summarize) produced far more reliable outputs than multipurpose prompts.
- **Fallback plain-text delivery**: When Telegram rejects Markdown-formatted bot messages (due to unescaped special characters), the catch block retries with plain text — this was critical for reliability.
- **Provider abstraction via `LLMProvider.ts`**: Wrapping all LLM calls through a single function made it trivial to swap from OpenAI to Groq during development without touching agent code.

### What Was Rejected / Failed
- **Multi-turn conversations**: Early attempts to maintain conversation history for the agents led to context window bloat and slower responses. Switched to stateless single-prompt calls with database context injection instead.
- **Regex-based intent classification**: Before using the LLM for intent routing, a regex approach was tested. It failed on natural language variations like "hey can you give Riya that essay thing" vs structured commands.
- **JSON.parse() without regex extraction**: Raw LLM output often includes markdown wrappers like `` ```json ... ``` ``. Direct `JSON.parse()` failed; the regex-based `parseJSON` utility solved this reliably.

---

## ⚙️ Deployment Configuration

### Backend Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `123456:ABC-DEF` |
| `GROQ_API_KEY` | Groq API key for LLM calls | `gsk_xxx` |
| `PORT` | HTTP server port | `3000` |
| `BACKEND_URL` | Public URL of the backend (for file links) | `https://your-app.railway.app` |

### Frontend Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `https://your-app.railway.app/api` |

---

## ⚠️ Known Limitations

1. **No production auth**: Login is based on Telegram ID entered manually — there is no JWT, session management, or password protection. Acceptable for the assignment scope but not for multi-tenant production.
2. **Single-file uploads**: Only one file can be attached per submission. Multiple file uploads would require a separate upload endpoint and a file-to-submission join table.
3. **No real-time WebSocket updates**: The web UI uses polling (auto-refresh every 30 seconds). For truly real-time state updates, a WebSocket layer would be needed.
4. **Reminder timing is approximate**: Reminders are processed by a cron job running every 5 minutes, so delivery may be up to 5 minutes late from the scheduled time.
5. **No multi-teacher support for students**: While a student can technically be linked to multiple teachers, the UI and some bot commands assume a single primary teacher.
6. **File storage is local disk**: Uploaded files are stored in the `uploads/` directory on the server filesystem. For production, this should be replaced with S3/Cloudflare R2/GCS for durability and CDN delivery.
7. **No rate limiting**: API endpoints and Telegram handlers have no rate limiting, which could be exploited in production.
8. **LLM provider is Groq-specific**: While the `LLMProvider.ts` abstraction exists, the actual implementation uses Groq SDK directly. Swapping to OpenAI/Claude would require changing the SDK import and API call shape in that one file.

