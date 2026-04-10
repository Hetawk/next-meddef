# MedDef — Adversarial Robustness Demo

**MedDef: An Attention Based Model For Adversarial Resilience in Medical Imaging**

> **Author:** Enoch Kwateh Dongbo (东博) · `202324100003`
> **Supervisor:** Niu Sijie (牛四杰)
> **Institution:** University of Jinan · Master's Thesis · 2026
> **Live Demo:** [https://meddef.ekddigital.com](https://meddef.ekddigital.com)

A Next.js web application for running and visualizing on-device adversarial robustness evaluations of the MedDef model — a dual-frequency attention mechanism (DAAM) designed to defend medical image classifiers against adversarial attacks.

Inference runs entirely **in the browser via ONNX Runtime (CPU)** — no backend GPU required.

---

## Live Demo

🌐 **[https://meddef.ekddigital.com](https://meddef.ekddigital.com)**

---

## Tech Stack

| Layer      | Technology                                |
| ---------- | ----------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack)        |
| Language   | TypeScript 5                              |
| ORM        | Prisma 7 (PostgreSQL)                     |
| Styling    | Tailwind CSS v4 + shadcn-style components |
| Validation | Zod                                       |
| Inference  | onnxruntime-node (server-side ONNX)       |
| Icons      | lucide-react                              |

---

## Features

- **Dashboard** — thesis overview, author details, dataset and attack coverage stats
- **Inference** — select a sample image or upload your own, choose an adversarial attack (BIM, FGSM, PGD, …) and epsilon, then run on-device ONNX inference with probability bars and a ROBUST / VULNERABLE verdict
- **Ground truth tracking** — correctly flags misclassified baseline images with an amber banner so results are never misleading
- **Datasets** — browse the 3 active datasets with class breakdowns
- **Models** — view all registered model variants (MedDef1, VISTA)
- **Results** — accuracy-vs-epsilon tables per attack, color-coded by robustness threshold

---

## Supported Datasets & Models

| Dataset Key  | Name                     | Classes                      | Model                   |
| ------------ | ------------------------ | ---------------------------- | ----------------------- |
| `roct`       | Retinal OCT              | 4 (CNV, DME, Drusen, Normal) | MedDef1                 |
| `chest_xray` | Chest X-Ray (Pneumonia)  | 2 (Normal, Pneumonia)        | MedDef1                 |
| `tbcr`       | Tuberculosis Chest X-Ray | 2 (Normal, Tuberculosis)     | VISTA NO_DEF Distill v2 |

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/Hetawk/next-meddef.git
cd next-meddef
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL connection string
```

### 3. Set up the database

```bash
npm run db:migrate    # create tables
npm run db:generate   # regenerate Prisma client
npm run db:seed       # seed initial data
```

### 4. Add ONNX models

The ONNX model files are **not included in this repository** (83–141 MB each — too large for GitHub). Place them in:

```
public/models/onnx/meddef1_roct.onnx
public/models/onnx/meddef1_chest_xray.onnx
public/models/onnx/vista_no_def_tbcr.onnx
```

> Normalization used at inference time:
>
> - `roct`: mean `[0.1934, 0.1934, 0.1934]`, std `[0.1934, 0.1934, 0.1934]`
> - `chest_xray`: mean `[0.4823, 0.4823, 0.4823]`, std `[0.2216, 0.2216, 0.2216]`
> - `tbcr` (VISTA / Ultralytics): mean `[0, 0, 0]`, std `[1, 1, 1]` (÷255 only)

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects automatically to `/dashboard`.

---

## Scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Start development server (Turbopack) |
| `npm run build`       | Production build                     |
| `npm run lint`        | ESLint                               |
| `npm run db:generate` | Regenerate Prisma client             |
| `npm run db:migrate`  | Run database migrations              |
| `npm run db:studio`   | Open Prisma Studio                   |
| `npm run db:seed`     | Seed initial data                    |

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Route group — sidebar layout
│   │   ├── dashboard/        # Overview & thesis info
│   │   ├── inference/        # ONNX inference UI
│   │   ├── datasets/         # Dataset browser
│   │   ├── models/           # Model registry
│   │   └── results/          # Evaluation results
│   ├── api/
│   │   └── infer/route.ts    # Server-side ONNX inference + adversarial attacks
│   └── layout.tsx
├── components/
│   ├── shared/sidebar.tsx
│   └── ui/                   # Button, Card, Badge, Input, Select, …
├── lib/
│   ├── config.ts             # APP constants (title, author, contact, etc.)
│   ├── db.ts                 # Prisma client singleton
│   └── utils.ts              # cn(), formatConfidence(), etc.
└── types/index.ts            # Zod schemas, DATASETS, ATTACKS constants
prisma/
└── schema.prisma
public/
├── datasets/samples/         # Verified sample images (tracked in git)
└── models/onnx/              # ONNX model files (gitignored — copy manually)
```

---

## Contact

|                |                             |
| -------------- | --------------------------- |
| Student email  | enoch.dongbo@stu.ujn.edu.cn |
| Personal email | ekd@ekddigital.com          |
| Phone          | +86 185 0683 2159           |

---

## License

MIT

> Author: Enoch Kwateh Dongbo (东博)  
> Supervisor: Niu Sijie (牛四杰)

A Next.js web application for running and visualizing adversarial robustness evaluations of the MedDef model — a dual-frequency attention mechanism (DAAM) designed to defend medical image classifiers against adversarial attacks.

---

## Tech Stack

| Layer      | Technology                                |
| ---------- | ----------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack)        |
| Language   | TypeScript 5                              |
| ORM        | Prisma 7 (PostgreSQL, driver adapter)     |
| Styling    | Tailwind CSS v4 + shadcn-style components |
| Validation | Zod                                       |
| Forms      | React Hook Form + @hookform/resolvers     |
| Inference  | onnxruntime-web                           |
| Icons      | lucide-react                              |

---

## Features

- **Dashboard** — overview of datasets, model variants, and attack coverage
- **Inference** — upload a medical image, select a model and attack type, run ONNX inference in-browser with probability bars
- **Datasets** — browse the 4 supported datasets (TBCR, CCTS, MultiCancer, ISIC skin)
- **Models** — view all registered model variants grouped by architecture (FULL / NO_DEF / NO_FREQ / NO_PATCH / NO_CBAM / BASELINE) across training stages
- **Results** — accuracy-vs-epsilon tables for each attack type, color-coded by robustness threshold

---

## Datasets

| Key      | Name                     | Classes                  |
| -------- | ------------------------ | ------------------------ |
| `tbcr`   | Tuberculosis Chest X-Ray | 2 (Normal, Tuberculosis) |
| `ccts`   | Chest CT Scan            | 4 (lung cancer subtypes) |
| `multic` | Multi-Cancer             | 8 (multi-organ)          |
| `scisic` | Skin Cancer (ISIC)       | 9 (dermoscopy)           |

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/Hetawk/next-meddef.git
cd next-meddef
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL to your PostgreSQL connection string
```

### 3. Set up the database

```bash
npm run db:migrate    # create tables
npm run db:generate   # regenerate Prisma client
```

### 4. Add ONNX models (optional)

Place exported `.onnx` files in:

```
public/models/onnx/<variant>_<stage>.onnx
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects automatically to `/dashboard`.

---

## Scripts

| Command               | Description              |
| --------------------- | ------------------------ |
| `npm run dev`         | Start development server |
| `npm run build`       | Production build         |
| `npm run lint`        | ESLint                   |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate`  | Run database migrations  |
| `npm run db:studio`   | Open Prisma Studio       |
| `npm run db:seed`     | Seed initial data        |

---

## API Routes

| Method | Route              | Description                   |
| ------ | ------------------ | ----------------------------- |
| GET    | `/api/datasets`    | List datasets                 |
| POST   | `/api/datasets`    | Seed datasets from constants  |
| GET    | `/api/models`      | List models                   |
| GET    | `/api/inferences`  | List inferences (filterable)  |
| POST   | `/api/inferences`  | Run and record an inference   |
| GET    | `/api/evaluations` | List evaluations (filterable) |
| POST   | `/api/evaluations` | Upsert an evaluation result   |

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Route group — sidebar layout
│   │   ├── dashboard/        # Overview page
│   │   ├── inference/        # ONNX inference UI
│   │   ├── datasets/         # Dataset browser
│   │   ├── models/           # Model registry
│   │   └── results/          # Evaluation results
│   ├── api/                  # REST API routes
│   └── layout.tsx
├── components/
│   ├── shared/sidebar.tsx
│   └── ui/                   # Button, Card, Badge, Input, Select
├── lib/
│   ├── config.ts             # APP constants (title, author, etc.)
│   ├── db.ts                 # Prisma client singleton
│   └── utils.ts              # cn(), formatConfidence(), etc.
└── types/index.ts            # Zod schemas + dataset/attack constants
prisma/
└── schema.prisma             # Database schema
```

---

## License

MIT


```bash

https://es.ekddigital.com/models/2026/vista_no_def_tbcr.onnx
https://es.ekddigital.com/models/2026/meddef1_chest_xray.onnx
https://es.ekddigital.com/models/2026/meddef1_roct.onnx
https://es.ekddigital.com/models/2026/llmshield_distilbert.onnx

```