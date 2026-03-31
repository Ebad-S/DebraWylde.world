# DebraWylde.world

Professional website for Debra Wylde's Advisory & Transformation Coaching business.

✔ **Development Review on Serenity Webcrafts infrastructure** <a href="https://debra.preview.serenity-webcrafts.com.au" target="_blank" rel="noopener">debra.preview.serenity-webcrafts.com.au</a>
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

For local development with live reload:

```bash
cd apps/web
python -m http.server 8000
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
