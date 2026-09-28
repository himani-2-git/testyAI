# ✏️ testyAI — AI-Powered Study & Exam Prep Platform

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-ffca28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Groq](https://img.shields.io/badge/AI-Groq%20%7C%20Cerebras-f55036?style=flat-square)](https://groq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**testyAI** is an intelligent, full-stack active-recall study companion. Upload study notes or textbook chapters in any format (PDF, DOCX, TXT) — including multi-file uploads across different subjects — and testyAI instantly crafts structured flashcards, multiple-choice quizzes with explanations, and exam-style long-answer questions. 

A dedicated analytics dashboard tracks mastery, identifies weak areas, monitors streaks, and maps topic performance across distinct academic subjects.

---

## 🌟 Key Features

### 1. ⚡ Multi-Format Document Ingestion
- **Drop & Go**: Upload **PDF**, **DOCX**, or **TXT** files.
- **Multi-Document Support**: Upload multiple PDFs simultaneously (e.g., *Machine Learning Basics.pdf* and *English Grammar.pdf*). testyAI partitions documents, detects individual subjects, and creates a balanced exam spanning across all uploaded material.
- **Client-Side Extraction**: Fast, browser-based extraction via [PDF.js](https://mozilla.github.io/pdf.js/) and [Mammoth.js](https://github.com/mwilliamson/mammoth.js).

### 2. 🧠 3 Tailored Test Modes
- **🃏 Flashcards**: Active recall flip cards with keyboard navigation (`Space` to flip, `Arrow Left/Right` to navigate, dot indicators).
- **🎯 Multiple Choice Quizzes (MCQ)**: 4-option exam questions with instant grading, detailed explanations, and automatic score persistence to Cloud Firestore.
- **📝 Long Answers**: Model exam solutions with numbered answer keys, expandable question cards, and quick hint bullets.

### 3. 📊 Smart Mastery & Analytics Dashboard
- **Subject Categorization**: Automatic topic clustering and subject tagging (`Machine Learning`, `English`, `Mathematics`, `Sciences`).
- **Interactive Subject Filter**: Filter topics and scores with live tab counts (`All Subjects`, `Machine Learning`, `English`).
- **Targeted Insights**:
  - **📉 Areas to Improve**: Highlights topics with <75% accuracy, complete with actionable recommendations.
  - **💪 Your Strengths**: Recognizes topics with ≥60% accuracy.
  - **Compact Subject Pills**: Visual badges (`ML`, `ENG`, `MATH`) with pastel color accents to maximize topic readability without text truncation.
- **🔥 Study Streaks & Score Trends**: Consecutive study streak tracking with motivational badges and a 10-quiz score progression chart.

### 4. 🔒 Enterprise-Grade AI Architecture
- **Server-Side Security**: API keys live exclusively in `.env` on the Node/Express backend — never exposed to the client browser.
- **Provider Abstraction & Fallback**: Fast Groq inference (`openai/gpt-oss-120b`) with seamless fallback (`qwen/qwen3.8-27b`).
- **JSON Schema Validation**: Server-enforced output schemas guarantee reliable, bug-free question generation.

---

## 🏗️ Architecture & Project Structure

```
testyAI/
├── api/
│   ├── providers/
│   │   └── groq.js          # Groq primary & fallback inference handler
│   ├── generate.js          # Express route handler (/api/generate)
│   ├── prompts.js           # Multi-document & subject-aware system prompts
│   └── schemas.js           # JSON schemas & response validation
├── css/
│   └── shared.css           # Global typography, color tokens & base design
├── js/
│   ├── config.js            # Firebase client credentials
│   └── db.js                # Firestore CRUD, analytics compilation, streaks
├── .env.example             # Template for API keys & server port
├── .gitignore               # Excludes node_modules, .env, and logs
├── app.html                 # Test generation, multi-file upload & quiz interface
├── dashboard.html           # Progress dashboard, streak tracker & topic analytics
├── index.html               # Authentication landing page (Google / Email Login)
├── package.json             # Node dependencies and npm scripts
└── server.js                # Express web server (API + static SPA serving)
```

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Groq Cloud API Key](https://console.groq.com/) (free tier available)
- A [Firebase Project](https://console.firebase.google.com/) with **Authentication** (Google & Email/Password) and **Firestore** enabled.

### 1. Clone Repository
```bash
git clone https://github.com/<your-username>/testyAI.git
cd testyAI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the project root:
```bash
cp .env.example .env
```
Open `.env` and fill in your API credentials:
```ini
GROQ_API_KEY=gsk_your_groq_api_key_here
PORT=8080
```

### 4. Firebase Setup (Client-Side)
Ensure your Firebase Web App configuration in `js/config.js` points to your project:
```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

### 5. Launch the Server
```bash
npm start
```
Or for development with auto-reloading:
```bash
npm run dev
```

Visit **`http://localhost:8080`** in your browser.

---

## 🎨 UI & Design Philosophy
- **Modern Notebook Grid**: Background grid paper styling for a focused, academic study environment.
- **Grotesque Typography**: Punchy headers with neon lime highlighters and warm peach accents.
- **Micro-Interactions**: Smooth card flips, interactive answer states, and instant progress transitions.

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to open a pull request or file an issue.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
