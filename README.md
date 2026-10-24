<<<<<<< HEAD
# TripGuide

A responsive travel discovery website built with HTML, CSS, and vanilla JavaScript, with an optional Node/Express local server.

## Run it
1. Install Node.js.
2. Open this folder in VS Code.
3. In the terminal run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

You can also open `public/index.html` directly, but the local server is recommended.

## Add your own destination photos
All 240 places have ready placeholder images in `public/images/` with the exact names the website loads.
Full name list: `public/images/IMAGE_LIST.txt`.

- Each place uses 3 images: `<place-id>.jpg`, `<place-id>-2.jpg`, `<place-id>-3.jpg` (example: `taj-mahal.jpg`, `taj-mahal-2.jpg`, `taj-mahal-3.jpg`).
- Replace a placeholder by saving your photo with the SAME file name (best: `.jpg`).
- If you want to use `.png`, `.jpeg` or `.webp`, delete the placeholder `.jpg` first, then add your file with the same name.
- If `-2` / `-3` is missing, the gallery shows the first image instead. If every file is missing, an online scenic fallback is shown.
- Optional hero image: `public/images/hero-mountains.jpg`.

## Features
- Responsive layout and navigation
- Destination category/state/budget filters and text search
- Click a destination to open a full detail view with a three-slide gallery
- Live weather (Open-Meteo) on every destination card and inside each destination detail view, using exact coordinates; a clear message is shown if unavailable
- 240 destinations across 28 states, each with its own minimum per-person budget
- Mini vlogs stay empty until a user posts one; posted vlogs follow the category / state / budget filters
- Budget planner with indicative ranges, not guaranteed quotes
- Browser-stored ratings and mini-vlog posts
- Basic travel helper chat (rule-based demo, not a connected generative AI)
- Image files are optional; add them into `public/images`

## Accuracy notes
Transport, lodging, meals and activity budgets are indicative planning ranges, not live ticket or hotel quotes. Check providers before booking. Weather is sourced from Open-Meteo and depends on forecast availability. Ratings and vlog posts are stored in this browser only. The Ask TripGuide assistant is a local demo and is not connected to an AI API.
=======
# travel-information
AI-powered travel guide for exploring destinations, discovering local food, planning budgets, and creating personalized travel itineraries.
>>>>>>> 2554b59554db6c4233045fe538cd92bc05ff6916
