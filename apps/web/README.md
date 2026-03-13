# DebraWylde.world - Frontend

Static frontend prototype for Debra Wylde's Advisory & Transformation Coaching website.

## Overview

A polished, client-ready prototype that establishes Debra's personal brand, communicates the 12-week Transformation Program, and drives visitors towards booking a discovery call.

## Frontend Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Semantic page structure |
| CSS3 | Custom lightweight styling (no frameworks) |
| Vanilla JavaScript | Mobile nav, FAQ accordion, form validation |
| Google Fonts | Playfair Display (headings), Lato (body) |

## Pages

| Page | File | Purpose |
|---|---|---|
| Home | `index.html` | Primary landing page — trust, offer overview, discovery call CTA |
| Program | `program.html` | Detailed 12-week Transformation Program page |
| About | `about.html` | Debra's story, authority, mission, speaking credentials |
| Discovery Call | `discovery-call.html` | Lead capture — enquiry form for booking a free call |
| Blog | `blog.html` | Article listing with category filters and featured post |
| Blog Post | `blog-post.html` | Single article template with author box and related posts |
| Contact | `contact.html` | General contact form, details, and FAQ |

## How to Run Locally

1. Navigate to this directory (`apps/web/`)
2. Open `index.html` in any modern browser
3. No build step, server, or dependencies required

For local development with live reload:

```bash
cd apps/web
python -m http.server 8000
```

## Placeholder Content Note

This prototype uses placeholder copy, images, and testimonials throughout. All placeholders are designed to be realistic and presentation-ready for client review.

**Items to replace before launch:**
- Professional photos (portrait, speaking events, lifestyle)
- Final brand colors and logo
- Real client testimonials
- Confirmed program pricing
- Final biographical copy
- Social media links (LinkedIn, Facebook)

## Phase 1 Scope

This build covers the **static frontend prototype only**. The following are excluded from this phase:

- Backend / API implementation
- Database
- Authentication
- Payment processing
- Real booking integration
- Blog CMS
- Admin dashboard
- SWIMS integration

## Planned Backend API Endpoints

The following endpoints are planned for future phases. The frontend form markup is structured for straightforward backend integration.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/contact` | Submit general contact form enquiry |
| `POST` | `/api/discovery-call` | Submit discovery call request form |
| `POST` | `/api/newsletter/subscribe` | Newsletter/blog subscription |
| `GET` | `/api/blog` | Fetch published blog post summaries |
| `GET` | `/api/blog/:slug` | Fetch a single blog post by slug |
| `GET` | `/api/testimonials` | Fetch testimonials for homepage/program page |
| `GET` | `/api/settings/public` | Fetch public site config (social links, contact email, booking link) |

## Project Structure

```
DebraWylde.world/
├── index.html
├── program.html
├── about.html
├── discovery-call.html
├── blog.html
├── blog-post.html
├── contact.html
├── faq.html
├── README.md
├── public/
│   ├── images/
│   ├── fonts/
│   └── favicon/
└── src/
    ├── css/
    │   └── styles.css
    ├── js/
    │   └── main.js
    ├── pages/
    ├── components/
    ├── content/
    └── utils/
```

---

Built by [Serenity Webcrafts](https://serenityweb.crafts)
