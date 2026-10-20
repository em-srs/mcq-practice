# Grinder — Placement Practice

A responsive, installable question-practice PWA. Built with vanilla HTML, CSS, and JavaScript so it is easy to understand and host.

## Included
- Mobile and laptop responsive UI
- Comes preloaded with five question banks: OOPs core MCQs, OOPs output/errors, pseudocode practice, and Operating Systems and Data Structures & Algorithms
- Includes 150 Data Structures & Algorithms placement-style theory MCQs
- Import additional JSON question sets
- Supports `q`, `opts`, `ans`, `explanation` format used by Grinder question files
- Also accepts common alternatives: `question`/`options`/`answer`
- Four-option practice, learn mode and test mode
- Topic labels, question map, next/previous, keyboard shortcuts (1–4 and arrow keys)
- Score summary, answer review, mistakes list, bookmarks
- Dark/light theme
- Local progress saved in the current browser
- PWA manifest and service worker for installability and offline app shell

## Run locally
Because service workers require HTTPS or localhost, run a local server instead of opening `index.html` directly.

With Python installed:
```bash
python -m http.server 8080
```
Then visit `http://localhost:8080`.

Or use VS Code Live Server.

## Deploy to Vercel
1. Unzip the project.
2. Put the project folder in a GitHub repository.
3. In Vercel, import the repository.
4. Choose **Other** / static site if prompted; no build command is needed. Set output directory to `.` (the project root).
5. Deploy. Vercel provides an HTTPS URL.

You can also deploy the static files with Netlify or GitHub Pages (GitHub Pages supports HTTPS).

The app automatically adds any newly bundled default question banks when you open an updated version, while preserving existing sets with the same name.

## Import your questions
On the dashboard, choose **Import question JSON** and select a `.json` file.

Expected format:
```json
[
  {
    "q": "Question text",
    "opts": ["A. Option one", "B. Option two", "C. Option three", "D. Option four"],
    "ans": "B",
    "explanation": "Why B is correct."
  }
]
```

Every question must include:
- `q`: question text (can include fenced code blocks)
- `opts`: exactly four options
- `ans`: `A`, `B`, `C`, or `D`
- `explanation`: explanation shown after answering

The importer skips invalid questions and reports how many were imported. It accepts a JSON array or `{ "questions": [...] }`.

## Important data note
This first version stores question sets, bookmarks, mistakes, and progress in browser local storage. That means the data stays on the device/browser where you imported it. To practise on another device, import the same question files there too. Progress sync between devices requires adding user accounts and a hosted database (for example Supabase); it is not included in this starter version.

## Back up and move between devices
Use **Export backup** to download your question sets and progress. On another device, choose **Import question JSON** and select that backup. Progress is not automatically synchronized; automatic account-based sync requires authentication and a hosted database. Retain your original JSON files and avoid clearing site data if you want to preserve local progress.


## Added question bank
- **Computer Networks — Placement MCQs:** 75 original placement-style MCQs with explanations, emphasizing OSI/TCP-IP, TCP vs UDP, handshake, flow/congestion control, IP/subnetting, ARP, DHCP, DNS, HTTP/HTTPS, ports, routing/switching, and network security. Topics were selected after reviewing publicly available placement/interview question patterns; the questions are newly written rather than copied verbatim.


## Mock tests
Use **Create mock test** to select subject banks, choose a question count, and set a total-test timer, per-question timer, or no timer. Mock tests proceed sequentially without backtracking or question-map jumps. Results include correct, wrong, skipped counts and a breakdown chart. Operating Systems is displayed without the old Set 1 label.
