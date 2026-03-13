
# Project Notes for DebraWylde.world

## Table of Contents
- [Project Notes for DebraWylde.world](#project-notes-for-debrawyldeworld)
  - [Table of Contents](#table-of-contents)
  - [1. Technology Stack](#1-technology-stack)
  - [2. Contact System](#2-contact-system)
  - [3. Payments](#3-payments)
    - [Option A — Payment on website](#option-a--payment-on-website)
    - [Option B — Payment after discovery call (*Recommended*)](#option-b--payment-after-discovery-call-recommended)
  - [4. SEO Strategy](#4-seo-strategy)
  - [5. Important Warnings](#5-important-warnings)
  - [6. Decisions \& Miscellaneous](#6-decisions--miscellaneous)
  - [7. Prompt Dooni](#7-prompt-dooni)

---

## 1. Technology Stack

**Preferred Approach:**
- **Frontend:**  
  - HTML  
  - Lightweight CSS  
  - Minimal JS  
  - *Avoid React*

**Ideal Stack:**
- **Static site:**  
  - HTML  
  - CSS  
  - [Alpine.js](https://alpinejs.dev/) *(optional)*

- **Backend (Optional, for future phases):**  
  - FastAPI  
  - SQLite  
  - Resend (for email integration)

<sub>*This approach fits Serenity Webcrafts infrastructure and Coolify hosting model.*</sub>

---

## 2. Contact System

**Key requirements:**
- User fills out **form**
- Email sent to Debra
- Confirmation email sent to user
- Data is saved in the database

**Best Architecture:**
```
Form
  ↓
API endpoint
  ↓
Database
  ↓
Resend email
```

**Sample Database Table: `leads`**
| id | name | email | phone | message | created_at |
|----|------|-------|-------|---------|------------|

*Simple and future-proof design.*

---

## 3. Payments

### Option A — Payment on website
- User pays directly.
- **Problems:**  
  - Less trust for high-ticket coaching  
  - Not ideal for this business model

### Option B — Payment after discovery call (*Recommended*)
- **Process:**  
  1. Discovery Call  
     ↓  
  2. Debra sends Stripe payment link  
     ↓  
  3. Client pays
- **Benefits:**  
  - Higher trust  
  - Better conversion (industry standard for coaches)

---

## 4. SEO Strategy

**Target Keywords:**
- leadership coach for women
- transformation coaching
- business mindset coaching
- female leadership mentoring

**Content Strategy:**
- Blog
- Case studies
- Client stories
- LinkedIn articles

*Goal: Make the site an authority hub in the niche.*

---

## 5. Important Warnings

> **If Debra cannot clearly describe her program, the website will not succeed.**
>
> Many coaches fail due to:
> - Vague messaging
> - Unclear transformation/promise

*Part of your role will involve marketing positioning and ensuring clarity.*

---

## 6. Decisions & Miscellaneous

- **No OTP** authentication (agreed).
- **Blog only** (forum not required).
- **Debra Wylde** appears (interviews, seminars, etc.) on search and social, available for any necessary content/SEO.
- **Static HTML** and the suggested techstack for phase 1; integration with SWIMS can be added in later phases.
- **Alternating layout** of photo and text is a good design, no blueprint necessary.
- Will confirm required items (logo, program details, etc.) with Debra.

---

TODO: 
1. add to GitHub repo 
2. host on Vultr
3. email Debra, the contract to sign, the URL of the hosted frontend for review, ask for required docs and confirm details.

## 7. Prompt Dooni

*If you'd like, I can share a reusable “Coach Website Template” architecture (good for 50+ future clients), which would massively increase your leverage.*

