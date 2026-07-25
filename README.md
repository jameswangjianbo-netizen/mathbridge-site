# MathBridge

Landing page for **MathBridge** — a free lead magnet of 15 lesson plans across 5 core topics
showing how Cambridge IGCSE, IB MYP, and IB DP Mathematics: Analysis & Approaches build on one
another. No cost, no mailing list required.

Live site: https://jameswangjianbo-netizen.github.io/mathbridge-site/

## Contents

- `index.html` — the single-page site (hero, curriculum-bridge explainer, lesson plan grid, FAQ)
- `robots.txt`, `sitemap.xml` — basic SEO plumbing
- `.github/workflows/pages.yml` — deploys `index.html` to GitHub Pages on every push to `main`

## Development

This is a static, dependency-free HTML page. To preview locally:

```bash
python3 -m http.server 8000
```

then open `http://localhost:8000`.

## Notes

- Canonical/OG URLs in `index.html` currently point at the placeholder domain
  `www.mathbridge.example` — swap these for the real domain before launch.
- `og:image` still has an `{OG_IMAGE_URL}` placeholder pending a real 1200×630 social preview
  image.
