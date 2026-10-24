# ExpiryGuardAI - Food Waste Prevention Assistant

>ExpiryGuardAI, a food waste prevention assistant to help food and beverage SMEs including cafés, restaurants, food vendors, and cloud kitchens, manage inventory efficiently , reduce avoidable food waste and reduce cost .

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | Scuba Adventurers                           |
| **Team Domain**        | Domain 2                                    |
| **SDG Track (1–17)**   | SDG 8 ,9 10,12                              |
| **Team Leader**        | Yap Sze Min                                 |
| **University**         | Universiti Tunku Abdul Rahman                         |
| **Number of Members**  |  4                                          |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/Erinmin62/foodwastepreventionassistant.git  |
| Live Demo         | https://foodwastepreventionassistant.replit.app/               |
| RunPod Endpoint   | -      |
| Slide Deck        | https://example.com/slides                     |
| Demo Video        | https://youtu.be/qvuWjv1Wo_4                 |

---

## Overview

### Problem

Describe the real-world problem you are solving in 2–4 sentences. Who is affected, and why does it matter?

### Solution

Explain how your project uses AI to solve the problem and what makes it valuable.

### Key Features

- **Feature 1** — Short description.
- **Feature 2** — Short description.
- **Feature 3** — Short description.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | TypeScript             |
| Backend       | YAML |
| Database      | PostgreSQL, SQLite      |
| AI / Compute  | CPU                 |
| Hosting / Dev | Replit                       |

---
## Project Structure

```
.
├── .agents/
│   └── memory                                # Replit Agents notes (email/WhatsApp delivery, product scope, forecasting and testing)       
├── artifacts/
│   ├── api-server/                           # Backend API (Express + TypeScript)
│   │   ├── scripts/                          # Delivery and integration test scripts
│   │   └── src/
│   │       ├── cli/                          # Email worker entry point
│   │       ├── lib/                          # Guard logic: forecasting, reorders, notifications, inbox
│   │       ├── middlewares/                  # Auth and proxy middleware
│   │       └── routes/                       # REST endpoints
│   ├── expiryguard/                          # Main web app (React + Vite)
│   │   ├── e2e/                              # End-to-end tests
│   │   └── src/
│   │       ├── components/                   # UI components, inbox/notification center
│   │       └── pages/                        # Dashboard, inventory, forecast, reordering, menu, impact
│   ├── expiryguard-product-intro/            # Product intro video
│   ├── expiryguard-project-deck/             # Pitch deck slides
│   ├── expiryguardai-website-walkthrough/    # Website walkthrough slides
│   └── mockup-sandbox/                       # UI mockup experiments                
├── docs/                                     # Email, WhatsApp and reordering documentation
├── lib/
│   ├── api-client-react/                     # Generated React API client
│   ├── api-spec/                             # OpenAPI spec + Orval config (single source of truth)
│   ├── api-zod/                              # Generated Zod schemas and types
│   ├── db/                                   # Drizzle ORM schema (PostgreSQL)
│   └── integrations-openai-ai-server/        # OpenAI wrapper for AI forecasting
├── scripts/                                  # Workspace utility scripts
├── submission/                                         # Required submission documents
│   ├── SDC2026_ScubaAdventurers_Preliminary.pdf        # Preliminary submission
│   ├── SDC2026_ScubaAdventurers_TechDeclaration.pdf    # Technology declaration
│   └── REPLIT_PROOF_OF_USE.pdf                         # Replit proof of use    
├── .gitignore
├── .replit                                   # Replit run configuration
├── LICENSE
├── package.json                              # Root scripts and dev dependencies
├── pnpm-workspace.yaml                       # Monorepo workspace definition
└── README.md
```

### Architecture

```
User ──► Replit (App / API) ──► RunPod Endpoint (GPU model)
                │
                └──► Response returned to user
```

---

## How to Run

### Option 1 — Run on Replit (Recommended)

1. Open the [Replit Project](https://replit.com/@your-username/your-project), or import this repository via **Create Repl → Import from GitHub**.
2. Open the **Secrets** tab (🔒) and add the variables listed in `.env.example`:
   - `RUNPOD_API_KEY`
   - `RUNPOD_ENDPOINT_ID`
3. Click **Run**. Replit uses the `.replit` file to start `python src/main.py`.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/your-username/your-project.git
cd your-project

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env            # then fill in your values

# 5. Run the app
python src/main.py
```

### Run Tests

```bash
python -m unittest discover tests
```

---

## How We Use Replit *(Required)*

Describe how your team used Replit. For example:

- **Development:** Collaborative coding in a shared Repl using Multiplayer.
- **Hosting:** The app is deployed with Replit Deployments at the Live Demo link above.
- **Secrets:** API keys are stored in Replit Secrets, never in the code.

📄 Proof of use: [`submission/SDC2026_TeamName_Replit_POU.pdf`](submission/SDC2026_TeamName_Replit_POU.pdf)

## How We Use RunPod *(Required)*

Describe how your team used RunPod. For example:

- **Workload:** Model inference (e.g. text generation, image processing) runs on a RunPod GPU.
- **Setup:** `runpod/handler.py` is deployed as a **RunPod Serverless Endpoint**.
- **Integration:** The Replit app sends requests to the endpoint using `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID`.

Example request:

```bash
curl -X POST https://api.runpod.ai/v2/$RUNPOD_ENDPOINT_ID/runsync \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"prompt": "Hello"}}'
```

📄 Proof of use: [`submission/SDC2026_TeamName_Runpod_POU.pdf`](submission/SDC2026_TeamName_Runpod_POU.pdf)

---

## Challenges & Learnings

- What challenges did you face, and how did you overcome them?
- What did your team learn?

## Future Improvements

- [ ] Improvement 1
- [ ] Improvement 2

## Team

| Name        | Role                | GitHub                                   |
| ----------- | ------------------- | ---------------------------------------- |
| Member Name | Team Lead / Backend | [@username](https://github.com/username) |
| Member Name | Frontend            | [@username](https://github.com/username) |
| Member Name | AI / RunPod         | [@username](https://github.com/username) |

---

## Submission Checklist

- [ ] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [ ] Slide deck link added
- [ ] Demo video link added
- [ ] Replit used, with proof of use in `submission/`
- [ ] RunPod used, with proof of use in `submission/`
- [ ] Preliminary submission completed (`SDC2026_TeamName_Preliminary.pdf`)
- [ ] Technology declaration completed (`SDC2026_TeamName_TechDeclaration.pdf`)
- [ ] Submission files renamed with your team name (replace `TeamName`)
- [ ] "How to Run" steps verified
- [ ] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).

