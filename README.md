# StudyWiz

An AI-powered study tool that transforms your notes, slides, and documents into interactive practice quizzes. Upload your study materials and get instant, personalized questions to test your knowledge.

## Features

- **AI Question Generation** — Upload PDFs, DOCX, PPTX, PPT, or TXT files and generate up to 100 practice questions per session using AI (powered by OpenRouter)
- **Multiple Question Types** — Multiple choice, true/false, fill-in-the-blank, and short answer
- **Adjustable Difficulty** — Choose between easy, medium, and hard question difficulty
- **Practice Mode** — Answer questions one at a time with instant feedback, explanations, and score tracking
- **Review Answers** — After completing a quiz, review all questions with your answers vs. correct answers
- **Quiz History** — Track your scores, averages, and best results across all completed quizzes
- **AI Chat** — Chat with an AI assistant about your uploaded study materials
- **Math Rendering** — LaTeX math expressions render properly in questions and answers via KaTeX
- **Dark Mode** — Dark theme enabled by default with light mode toggle
- **File Format Support** — PDF, DOCX, PPTX, PPT (binary), TXT, and image-based files (OCR via Tesseract.js)

## Tech Stack

- **Frontend** — React 18, TypeScript, Vite
- **Styling** — Tailwind CSS, shadcn/ui, Radix UI
- **AI Backend** — Vercel Serverless Functions, OpenRouter API
- **File Parsing** — pdfjs-dist, Mammoth (DOCX), JSZip (PPTX), CFB (PPT), Tesseract.js (OCR)
- **Math** — KaTeX / react-katex
- **Deployment** — Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- An [OpenRouter](https://openrouter.ai/) API key

### Installation

```bash
git clone https://github.com/Praise-001/student-site-refresh.git
cd student-site-refresh
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### Development

```bash
npm run dev
```

The app runs at `http://localhost:8080`. A custom Vite plugin (`vite-api-plugin.ts`) serves the Vercel API routes locally during development, so question generation works without deploying.

### Production Build

```bash
npm run build
npm run preview
```

### Deployment

Push to the `main` branch. Vercel auto-deploys from GitHub. Make sure `OPENROUTER_API_KEY` is set in your Vercel project environment variables.

## Project Structure

```text
├── api/
│   ├── generate-questions.ts   # Question generation endpoint (OpenRouter)
│   └── file-converter.ts       # File type detection endpoint
├── src/
│   ├── components/
│   │   ├── GeneratorPanel.tsx   # Upload + settings + generate flow
│   │   ├── PracticeView.tsx     # Quiz practice and results
│   │   ├── HistoryView.tsx      # Quiz history with stats
│   │   ├── ChatView.tsx         # AI chat assistant
│   │   ├── FileUploadZone.tsx   # Drag-and-drop file upload
│   │   ├── GeneratorSettings.tsx # Question count and difficulty
│   │   └── QuestionTypeSelector.tsx # Question type picker
│   ├── lib/
│   │   ├── fileExtractor.ts     # Text extraction from all file formats
│   │   ├── geminiClient.ts      # API client for question generation
│   │   └── quizHistory.ts       # localStorage quiz history
│   └── pages/
│       └── Index.tsx            # Main page with tab navigation
├── vite-api-plugin.ts           # Local dev server for API routes
└── vite.config.ts
```

## License

MIT
