# Lebanese Motorcycle Theory Exam Trainer

Arabic RTL trainer for the Lebanese motorcycle theory exam, built with Vite, React, and TypeScript.

## Features

- 251 multiple-choice questions from the official motorcycle theory question set.
- 101 road-sign questions with extracted sign images.
- Official-style exam mode: 30 random questions, passing score 25/30.
- Adaptive practice using localStorage: weak and recently missed questions are reviewed more often.
- Coverage-aware selection so repeated attempts introduce unseen questions before over-drilling old ones.
- Review mode for mistakes and weaker questions.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Then open the URL printed by Vite.

## Quality Checks

```bash
npm test
npm run build
```

Progress is stored only in the browser's localStorage.
