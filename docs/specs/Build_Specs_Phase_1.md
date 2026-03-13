One important adjustment: for the prototype, don’t make the forms feel broken. Either:

* show a polished fake success state on submit, or

* mark them as “preview only” with a graceful message.

A dead submit button makes the build look unfinished.


{
  "project_name": "DebraWylde.world",
  "build_version": "v1-frontend-prototype",
  "objective": "Create a polished, static frontend prototype for DebraWylde.world so the client can preview the website structure, design direction, messaging flow, and user journey before backend/API integration.",
  "primary_goal": "Show a professional, high-trust coaching/advisory website with clear calls to action for discovery calls and program enquiries.",
  "phase_scope": {
    "include": [
      "Static frontend for all public pages",
      "Responsive layout",
      "Semantic HTML",
      "Lightweight CSS",
      "Minimal vanilla JavaScript only where useful",
      "Reusable layout components via partials/includes if supported, otherwise keep components logically separated in code comments",
      "Placeholder content blocks where final client assets are not yet available",
      "Prototype forms with frontend validation only",
      "Navigation, footer, CTA structure, and visual consistency across pages"
    ],
    "exclude": [
      "No backend implementation",
      "No database",
      "No authentication",
      "No OTP",
      "No payment processing implementation",
      "No real booking integration yet",
      "No blog CMS",
      "No admin dashboard",
      "No SWIMS integration in this phase"
    ]
  },
  "tech_stack": {
    "frontend": [
      "HTML5",
      "CSS3",
      "Vanilla JavaScript"
    ],
    "styling_approach": "Custom lightweight CSS. No heavy frameworks. Small utility classes are acceptable if hand-written.",
    "javascript_policy": "Use minimal JS only for mobile nav, small UI interactions, and basic form validation.",
    "performance_goals": [
      "Fast first load",
      "Low JS footprint",
      "Accessible semantic markup",
      "Clean structure suitable for later backend integration"
    ]
  },
  "design_direction": {
    "brand_feel": [
      "Professional",
      "Warm",
      "Trustworthy",
      "Personal",
      "Transformational",
      "Calm but confident"
    ],
    "layout_style": "Alternating image/text sections throughout key content blocks.",
    "visual_reference_notes": [
      "Use a clean personal-brand coaching aesthetic",
      "Prioritize readability and whitespace",
      "Design should feel premium without being flashy",
      "Imagery should support authority, confidence, and approachability"
    ],
    "color_system": {
      "status": "temporary until client provides brand colors",
      "temporary_palette_guidance": {
        "background": "#f7f4ef",
        "surface": "#ffffff",
        "text_primary": "#1f1f1f",
        "text_secondary": "#555555",
        "accent": "#8c6a43",
        "accent_soft": "#d8c4aa",
        "border": "#e7dfd4"
      }
    },
    "typography": {
      "headings": "Elegant serif or refined transitional font style",
      "body": "Clean sans-serif for readability",
      "fallback_policy": "Use safe web fonts or Google Fonts that feel premium and readable"
    },
    "imagery_policy": {
      "use_placeholders": true,
      "placeholder_guidance": [
        "Portrait placeholders",
        "Seminar/speaking placeholders",
        "Lifestyle/professional neutral placeholders"
      ],
      "note": "All placeholders should be easy to replace later when client provides final photos."
    }
  },
  "site_architecture": {
    "pages": [
      {
        "name": "Home",
        "file": "index.html",
        "purpose": "Primary landing page that establishes trust, explains the offer, and drives users to request a discovery call.",
        "sections": [
          "Top navigation",
          "Hero section with headline, supporting copy, primary CTA",
          "About/authority introduction",
          "Transformation Program overview",
          "Key outcomes section",
          "How the process works",
          "Testimonials preview",
          "Why work with Debra section",
          "Discovery Call CTA section",
          "Footer"
        ]
      },
      {
        "name": "Program",
        "file": "program.html",
        "purpose": "Dedicated page explaining the 12-week Transformation Program in more depth.",
        "sections": [
          "Page hero",
          "Program summary",
          "Who it is for",
          "Who it is not for",
          "Key outcomes",
          "Program structure",
          "Transformation promise",
          "Pricing placeholder",
          "FAQ section",
          "CTA to book discovery call"
        ]
      },
      {
        "name": "About",
        "file": "about.html",
        "purpose": "Show Debra's story, authority, background, and mission.",
        "sections": [
          "Intro hero",
          "Professional biography",
          "Personal mission / philosophy",
          "Experience and credibility",
          "Speaking / interviews / seminars credibility strip",
          "CTA section"
        ]
      },
      {
        "name": "Discovery Call",
        "file": "discovery-call.html",
        "purpose": "Single focused conversion page for lead capture.",
        "sections": [
          "Page intro",
          "What to expect from the discovery call",
          "Benefits of booking",
          "Prototype enquiry/booking form",
          "Alternative contact details block",
          "Trust reassurance text"
        ]
      },
      {
        "name": "Blog",
        "file": "blog.html",
        "purpose": "Show a future-ready SEO/content section with sample article cards.",
        "sections": [
          "Blog hero",
          "Featured article card",
          "Article grid",
          "Category/filter placeholder UI",
          "Newsletter/CTA block"
        ]
      },
      {
        "name": "Single Blog Post",
        "file": "blog-post.html",
        "purpose": "Template page for a single article layout.",
        "sections": [
          "Article hero",
          "Metadata row",
          "Rich text article content",
          "Pull quote / highlight block",
          "Author box",
          "Related posts",
          "CTA section"
        ]
      },
      {
        "name": "Contact",
        "file": "contact.html",
        "purpose": "General contact page for enquiries outside the discovery call flow.",
        "sections": [
          "Page intro",
          "Contact form prototype",
          "Email/contact details",
          "Social links",
          "Optional FAQ snippet"
        ]
      }
    ]
  },
  "global_components": {
    "header": {
      "requirements": [
        "Sticky or clean static top nav",
        "Logo text placeholder for Debra Wylde",
        "Links to Home, Program, About, Blog, Contact",
        "Primary CTA button: Discovery Call",
        "Mobile responsive menu"
      ]
    },
    "footer": {
      "requirements": [
        "Brand/footer identity",
        "Quick links",
        "Social media link placeholders",
        "Contact email placeholder",
        "Copyright line",
        "Small trust statement"
      ]
    },
    "cta_patterns": [
      "Book a Discovery Call",
      "Learn More",
      "Enquire Now"
    ],
    "cards": [
      "Service card",
      "Blog article card",
      "Testimonial card",
      "Outcome card"
    ]
  },
  "content_strategy": {
    "tone": [
      "Clear",
      "Empowering",
      "Supportive",
      "Professional",
      "Direct",
      "Non-hype"
    ],
    "copy_rules": [
      "Avoid vague coaching jargon where possible",
      "Use benefit-led headings",
      "Write for women seeking meaningful transformation and clarity",
      "Keep paragraphs short and readable",
      "Use placeholders where final copy is unknown, but make placeholders believable and presentation-ready"
    ],
    "placeholder_copy_policy": {
      "allowed": true,
      "instruction": "Use polished placeholder copy that feels realistic and client-presentable, clearly structured so it can be replaced later."
    }
  },
  "forms": {
    "prototype_only": true,
    "frontend_validation": true,
    "forms_required": [
      {
        "page": "discovery-call.html",
        "fields": [
          "full_name",
          "email",
          "phone_optional",
          "message",
          "best_time_to_contact_optional"
        ],
        "submit_behavior": "Prevent actual submission. Show polished success placeholder message or disabled submit note if no backend is connected."
      },
      {
        "page": "contact.html",
        "fields": [
          "full_name",
          "email",
          "subject",
          "message"
        ],
        "submit_behavior": "Prototype only. No real submission."
      }
    ]
  },
  "seo_basics": {
    "requirements": [
      "Unique title tag for each page",
      "Meta description for each page",
      "Semantic heading structure",
      "Open Graph placeholder tags",
      "Clean internal linking",
      "Image alt text placeholders",
      "Human-readable URLs in navigation references"
    ]
  },
  "accessibility": {
    "requirements": [
      "Semantic HTML landmarks",
      "Proper label association for form fields",
      "Keyboard-friendly navigation",
      "Sufficient color contrast",
      "Visible focus states",
      "Descriptive button/link labels"
    ]
  },
  "responsive_behavior": {
    "breakpoints_guidance": [
      "Mobile first",
      "Tablet optimized",
      "Desktop polished"
    ],
    "layout_requirements": [
      "Alternating image/text sections collapse cleanly on mobile",
      "Navigation becomes mobile menu",
      "Cards stack neatly",
      "Forms remain easy to use on smaller screens"
    ]
  },
  "file_structure": {
    "root_files": [
      "index.html",
      "program.html",
      "about.html",
      "discovery-call.html",
      "blog.html",
      "blog-post.html",
      "contact.html",
      "README.md"
    ],
    "directories": [
      "assets/css",
      "assets/js",
      "assets/images"
    ],
    "css_files": [
      "assets/css/styles.css"
    ],
    "js_files": [
      "assets/js/main.js"
    ]
  },
  "implementation_rules": [
    "Keep code clean and readable for later handoff or extension",
    "Do not over-engineer the prototype",
    "Favor presentational quality over premature feature complexity",
    "Make the site look finished enough for client review even with placeholder content",
    "Structure classes and sections consistently across pages",
    "Prepare the form markup so backend integration can be added later with minimal refactor"
  ],
  "client_preview_goal": {
    "success_definition": [
      "Debra can click through all core pages",
      "Debra can understand the offer and flow",
      "The website feels real, professional, and close to launch",
      "Only content/assets/integrations remain for later refinement"
    ]
  },
  "future_backend_notes_for_readme": {
    "instruction": "Do not implement backend now. In README.md, add a section called 'Planned Backend API Endpoints' and list the required endpoints below.",
    "planned_endpoints": [
      {
        "method": "POST",
        "endpoint": "/api/contact",
        "purpose": "Submit general contact form enquiry."
      },
      {
        "method": "POST",
        "endpoint": "/api/discovery-call",
        "purpose": "Submit discovery call request form."
      },
      {
        "method": "POST",
        "endpoint": "/api/newsletter/subscribe",
        "purpose": "Optional future newsletter/blog subscription endpoint."
      },
      {
        "method": "GET",
        "endpoint": "/api/blog",
        "purpose": "Fetch published blog post summaries for blog listing page."
      },
      {
        "method": "GET",
        "endpoint": "/api/blog/:slug",
        "purpose": "Fetch a single blog post by slug."
      },
      {
        "method": "GET",
        "endpoint": "/api/testimonials",
        "purpose": "Fetch testimonials for homepage/program page."
      },
      {
        "method": "GET",
        "endpoint": "/api/settings/public",
        "purpose": "Fetch public site configuration such as social links, contact email, and booking link."
      }
    ]
  },
  "readme_requirements": {
    "must_include": [
      "Project overview",
      "Frontend tech stack",
      "Page list",
      "How to run locally",
      "Placeholder content note",
      "Planned Backend API Endpoints section",
      "Phase 1 scope note"
    ]
  },
  "final_instruction_to_agent": "Build the frontend prototype as if it will be shown directly to the client. Prioritize polish, clarity, good spacing, believable content placeholders, and a strong discovery-call conversion path."
}