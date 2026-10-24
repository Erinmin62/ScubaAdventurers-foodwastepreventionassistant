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
| Slide Deck        | https://1drv.ms/p/c/d2d72522cb9cdce2/IQBVTAggQpSCTqMcxoEvlfByAfJuotmrAdSYKtg1jYr00ek?e=z4Iy2Z                     |
| Demo Video        | https://youtu.be/qvuWjv1Wo_4                 |

---

## Overview

### Problem

Describe the real-world problem you are solving in 2–4 sentences. Who is affected, and why does it matter?

Small and medium-sized food businesses, including cafés, restaurants, food vendors, and cloud kitchens, often struggle to track ingredient expiry dates, manage stock levels, and make timely restocking decisions. Without consistent inventory monitoring, ingredients may expire before being used, leading to avoidable food waste, financial losses, and inefficient daily operations. ExpiryGuard AI addresses this problem through automated expiry monitoring, waste-aware restocking support, daily planning, and in-app alerts to help SMEs manage inventory more efficiently and reduce food waste.
### Solution

Explain how your project uses AI to solve the problem and what makes it valuable.

ExpiryGuard AI combines AI-assisted inventory analysis with automated workflows to help food-related SMEs prevent avoidable food waste before it happens. By analysing inventory quantities, expiry dates, costs, and delivery information, the application helps identify ingredients at risk of expiring and supports smarter, waste-aware restocking decisions. Automated daily planning, follow-up checks, and in-app alerts help business owners prioritise urgent issues and take timely action, with human approval where required. What makes ExpiryGuard AI valuable is its focus on turning inventory information into practical actions—not just reporting problems—helping SMEs reduce potential waste, control costs, and manage daily operations more efficiently without adding unnecessary complexity.
### Key Features

- **Feature 1** — Automated Expiry Monitoring — Tracks ingredient expiry dates and identifies items approaching expiry, helping SMEs take action before ingredients go to waste.
- **Feature 2** — Waste-Aware Reorder Scan — Analyses current stock levels and delivery information to flag potential overstocking and unnecessary reordering, supporting smarter purchasing decisions.
- **Feature 3** — Automated Planning & Smart Alerts — Supports daily inventory planning and follow-up checks, while in-app notifications highlight urgent expiry risks, inventory issues, and actions requiring user approval.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | TypeScript  , React           |
| Backend       | Node.js , Express |
| Database      | PostgreSQL     |
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
│   ├── REPLIT_PROOF_OF_USE.pdf                         # Replit proof of use
│   ├── SDC2026_ScubaAdventurers_Preliminary.pdf        # Preliminary submission
│   └── SDC2026_ScubaAdventurers_TechDeclaration.pdf    # Technology declaration    
├── .gitignore
├── .replit                                   # Replit run configuration
├── LICENSE
├── package.json                              # Root scripts and dev dependencies
├── pnpm-workspace.yaml                       # Monorepo workspace definition
└── README.md
```

### Architecture

```
User ──► Replit (App / API)
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

We used Replit as our main development, testing, and hosting platform. We built and tested the frontend and backend in the Replit workspace using its workflows and preview; Replit Agent also assisted with development. The prototype is published as a public Replit VM deployment. We store credentials in Replit Secrets/environment variables, not in the source code. The app uses Replit PostgreSQL for workspace records and Replit App Storage for ingredient photos.

📄 Proof of use: [`submission/SDC2026_TeamName_Replit_POU.pdf`](submission/REPLIT_PROOF_OF_USE.pdf)

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

Our prototype initially relied on synthetic data, so we couldn’t claim that its forecasts were accurate or that it had reduced real food waste. We addressed this by labeling demo results clearly, keeping AI experiments separate from live rule-based planning, validating AI responses, and requiring owner consent and review. We also worked to keep pantry, menu, sales, expiry, and notification workflows consistent and reusable beyond cafés. Email and WhatsApp setup showed us that automated alerts depend on provider configuration and reliable status checks.

- What did your team learn?

Useful AI needs reliable business records and testing against real outcomes. Automation should make routine work easier while keeping consequential decisions with the owner. We should measure waste and cost changes in a real SME pilot before making impact claims; Orbyte integration is a future possibility, not a current connection.

## Future Improvements

- [ ] Improvement 1:
Run a pilot with food SMEs using consented real business records. Compare forecasts with actual sales, preparation, and leftovers before making accuracy or waste-reduction claims.

- [ ] Improvement 2:
Make setup and automation more adaptable across cafes, restaurants, food vendors, and cloud kitchens, including configurable menus, stock settings, supplier lead times, and reliable notification checks. Explore Orbyte integration once its requirements are clear

## Team

| Name        | Role                | GitHub                                   |
| ----------- | ------------------- | ---------------------------------------- |
| Yap Sze Min | Team Lead / Backend /Frontend | [@Erinmin62](https://github.com/Erinmin62) |
| Edwin Goh Yong Jun | Frontend / Backend           | [@edwingoh0529-commits](https://github.com/edwingoh0529-commits) |
| Toh Ke Xuan | Pitch Deck / Live Demo         | [@FoxPear](https://github.com/FoxPear) |
| Venosheni A/P Ethiraj Naidu | Pitch Deck        | [@Veno05](https://github.com/Veno05) |

---

## Submission Checklist

- [/] Team name, domain (Domain 2) and SDG track filled in
- [/] Slide deck link added
- [/] Demo video link added
- [/] Replit used, with proof of use in `submission/`
- [ ] RunPod used, with proof of use in `submission/`
- [/] Preliminary submission completed (`SDC2026_TeamName_Preliminary.pdf`)
- [/] Technology declaration completed (`SDC2026_TeamName_TechDeclaration.pdf`)
- [/] Submission files renamed with your team name (replace `TeamName`)
- [/] "How to Run" steps verified
- [/] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).

