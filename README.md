# MathBridge — IB DP Mathematics AA HL

Free planning and assessment resources for teachers of IB Diploma Programme
Mathematics: Analysis and Approaches, Higher Level.

Live site: https://jameswangjianbo-netizen.github.io/mathbridge-site/

## Pages

- **[AA HL Two-Year Course Map](https://jameswangjianbo-netizen.github.io/mathbridge-site/)** (`index.html`) —
  a 60-week, 240-block scheme of work covering every SL and AHL sub-topic of the current guide
  (first assessment 2021, updated November 2024). Tabs cover the scheme of work, course architecture,
  the formative assessment map, IA and Paper 3 milestones, notes on the 2029 guide transition, and a
  coverage audit computed from the scheme itself. Filter by year or topic, or search by syllabus code.
- **[AA HL Formative Bank](https://jameswangjianbo-netizen.github.io/mathbridge-site/formative-bank/)** (`formative-bank/index.html`) —
  127 original Paper 1, 2 and 3 style questions with full IB-style markschemes (M, A, R and AG marks),
  plus the eighteen unit formatives, the retrieval programme and marking protocols referenced by the course map.
- **[Teacher dashboard](https://jameswangjianbo-netizen.github.io/mathbridge-site/teacher/)** (`teacher/index.html`) —
  build a quiz from any of the bank's questions (or tick "+ Quiz" on questions in the bank), set a time
  limit and options, and share one link with the class. Answers arrive live; mark each part against the
  markscheme with quick comments, then return the work. Students can revise and resubmit, and you can see
  what changed between attempts.
- **Student quiz** (`quiz/index.html?q=…`) — students sign in with a name and PIN, answer each part
  (with a maths-symbol palette and drafts saved on their device), and see your marks and comments
  appear on the page as soon as you return them.

Live quizzes store answers and feedback in a Google Sheet you own, through a small Apps Script
(`backend/Code.gs`). Setup takes about five minutes: see **[backend/SETUP.md](backend/SETUP.md)**.
Shared code lives in `assets/` (`items.js` holds the question bank, `common.js` the API client and
renderers, `config.js` the web app URL).

Other files: `robots.txt` and `sitemap.xml` for search engines, and `.github/workflows/pages.yml`, which
deploys the site to GitHub Pages on every push to `main`.

## Using it

Week numbers assume four 80–90 minute blocks per week over 33 weeks in DP1 and 27 weeks in DP2; adjust
them to your own school calendar. References to "existing" worksheets and formatives describe one
department's resources and are meant to be swapped for your own. Both pages print cleanly from the browser.

## Caveats

The 2029 notes are based on a pre-publication draft of the new guide (28 November 2025) and should be
checked against the published guide. The questions are original and are not IB past-paper material.

## Development

The site is static and dependency-free. To preview locally:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
