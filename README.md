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

The frontend prototype lives in `apps/web/`. Use `Live Server` or open `apps/web/index.html` in any browser to preview.

from the root folder run:

```bash
npx serve apps/web -l 3000
```

For local development with live reload:

```bash
cd apps/web
npx serve .

```

**Alternatively, you can run a Python server:**

```bash
cd apps/web
python -m http.server 8000
```

### Test API Health Locally

**Terminal 1 (frontend):**
```bash
npx serve apps/web -l 3000
```

**Terminal 2 (backend):**
```bash
cd apps/api
python -m venv .venv

# Windows:
.venv/Scripts/activate

# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open in your browser:  
[http://localhost:8000/api/health](http://localhost:8000/api/health)

The report confirms this local setup was tested successfully with the frontend on `:3000` and API on `:8000`.


**Local Homepage Preview:**  
[http://localhost:3000/apps/web/](http://localhost:3000/apps/web/)

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
