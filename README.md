# Lebanese Motorcycle Theory Exam Trainer

Static Arabic RTL trainer for the Lebanese motorcycle theory exam.

## Features

- 251 multiple-choice questions from the official motorcycle theory question set.
- 101 road-sign questions with extracted sign images.
- Official-style exam mode: 30 random questions, passing score 25/30.
- Adaptive practice using localStorage: weak and recently missed questions are reviewed more often.
- Coverage-aware selection so repeated attempts introduce unseen questions before over-drilling old ones.
- Review mode for mistakes and weaker questions.

## Run Locally

No build step is required.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/`.

Progress is stored only in the browser's localStorage.
