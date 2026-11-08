# Setting up live quizzes (about 5 minutes)

The quiz pages are static, so answers and feedback are stored in a Google Sheet that you own.
A small Google Apps Script attached to that sheet receives submissions from students and
feedback from you.

## 1. Create the sheet and the script

1. Go to [sheets.new](https://sheets.new) and name the sheet, for example **MathBridge quizzes**.
2. In the sheet, open **Extensions → Apps Script**.
3. Delete the starter code, paste in the whole of [`Code.gs`](Code.gs), and click **Save**.
4. In the function menu at the top, choose **setup** and click **Run**.
   Google asks you to authorise the script: choose your account, then **Advanced → Go to … (unsafe)
   → Allow**. ("Unsafe" only means Google hasn't reviewed a script you wrote yourself.)
5. Open **Execution log**. It shows **Your TEACHER KEY is: …**. Copy it somewhere safe.
   You'll use it to sign in to the teacher dashboard. To change it later, go to **Project Settings
   → Script properties** and edit `TEACHER_KEY`.

## 2. Deploy it as a web app

1. Click **Deploy → New deployment**, then the gear icon, then **Web app**.
2. Set **Execute as: Me** and **Who has access: Anyone**.
   "Anyone" is needed so students can submit without a Google account. They can only do
   what the script allows: read a quiz, submit their own answers, and read their own feedback
   with their name and PIN.
3. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

## 3. Connect the site

Either:

- **Recommended:** paste the URL into [`assets/config.js`](../assets/config.js) and push. Student links
  will then be short (`…/quiz/?q=abc123`).
- **Or:** paste it into the teacher dashboard when you sign in. Quiz links then carry the URL
  themselves, so they're longer.

Then open `/teacher/`, sign in with your teacher key, and build a quiz.

## Updating the script later

After you edit `Code.gs`, use **Deploy → Manage deployments → Edit (pencil) → Version: New version →
Deploy**. This keeps the same URL. Creating a *new* deployment gives you a new URL instead.

## What's stored, and where

| Sheet | One row per | Holds |
|---|---|---|
| `Quizzes` | quiz | title, class, question IDs, time limit, options |
| `Submissions` | student per quiz | name, hashed PIN, answers, your marks and comments, up to 5 earlier attempts |

- Everything stays in your Google Drive. Delete rows (or the whole sheet) whenever you like.
- PINs are stored as salted SHA-256 hashes, never as the digits themselves.
- Student names are stored as typed. Check your school's data policy before using full names;
  first name plus initial works just as well.

## Limits and caveats

- A PIN stops classmates reading each other's feedback by accident. It isn't strong security: a
  determined student could guess a 4-digit PIN. Don't use the system for anything high-stakes.
- Updates are near-live: students' pages check every 15 seconds, and the teacher list every 12.
- Apps Script allows roughly 20,000 requests a day on a free account, which is plenty for
  several classes polling during a lesson.
- The question bank, including the markschemes, is public on the site. Students who go looking can
  find the markscheme. These quizzes are for formative work, not for exams.
