# DebraWylde.world

Professional website for Debra Wylde's Advisory & Transformation Coaching business.

✔ <a href="https://debra.preview.serenity-webcrafts.com.au" target="_blank" rel="noopener">**Dev Review on Serenity Webcrafts infrastructure**</a><br>
✔ **Will go live here** <a href="https://debrawylde.world" target="_blank" rel="noopener">DebraWylde.world</a>  

## Project Structure

```
DebraWylde.world/
├── apps/
│   ├── web/          # Frontend (HTML, CSS, JS)
│   └── api/          # Backend API (Phase 2+)
├── docs/
│   ├── notes/        # Meeting notes, project notes
│   ├── contracts/    # Client contract
│   └── specs/        # Build specifications
├── deployment/
│   ├── coolify/      # Coolify hosting config
│   ├── nginx/        # Reverse proxy config
│   └── scripts/      # Deployment scripts
├── .gitignore
└── README.md
```

## Quick Start

Run frontend (`:3000`) and API (`:8000`) together from the repo root:

```bash
# one-time: create the API venv if you have not already
cd apps/api
python -m venv .venv

# Windows:
.venv/Scripts/pip install -r requirements.txt

# macOS/Linux:
# .venv/bin/pip install -r requirements.txt

cd ../..
npm install
npm run dev
```

That uses [`concurrently`](https://www.npmjs.com/package/concurrently) to start both processes in one terminal (prefixed `web` / `api` logs). Stop with `Ctrl+C`.

Confirm the web log says `http://localhost:3000` (not a random port). If port 3000 is busy, stop the old process first, then run `npm run dev` again.

- Site: [http://localhost:3000](http://localhost:3000)
- API health: [http://localhost:8000/api/health](http://localhost:8000/api/health)

To run only one side:

```bash
npm run dev:web
npm run dev:api
```

## Tech Stack

### Frontend (Phase 1 - Current)

| Technology | Purpose |
|---|---|
| HTML5 | Semantic page structure |
| CSS3 | Custom lightweight styling (no frameworks) |
| Vanilla JS | Mobile nav, FAQ accordion, form validation |
| Google Fonts | Playfair Display (headings), Lato (body) |

### Backend (Phase 2 - Planned)

| Technology | Purpose |
|---|---|
| FastAPI | API framework |
| SQLite | Database |
| Resend | Transactional email |

### Hosting

| Service | Purpose |
|---|---|
| Vultr VPS | Server hosting |
| Coolify | Deployment platform |
| GoDaddy | Domain registrar |

## Pages

| Page | File | Purpose |
|---|---|---|
| Home | `index.html` | Landing page with trust, offer overview, discovery call CTA |
| Program | `program.html` | 12-week Transformation Program details |
| About | `about.html` | Debra's story, experience, mission |
| Blog | `blog.html` | Article listing with category filters |
| Blog Post | `blog-post.html` | Single article template |
| FAQ | `faq.html` | Frequently asked questions |
| Contact | `contact.html` | General contact form and details |
| Discovery Call | `discovery-call.html` | Lead capture for booking a free call |

## Documentation

- **Build Spec:** `docs/specs/Build_Specs_Phase_1.md`
- **Contract:** `docs/contracts/contract.md`
- **Meeting Notes:** `docs/notes/Meeting_Summary.md`
- **Project Notes:** `docs/notes/NOTES.md`

---

Built by [Serenity Webcrafts](https://serenity-webcrafts.com.au/)
