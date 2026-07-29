# SmartStitch-AI-LA6-AI-Final-Capstone-Project
# Smart Stitch AI

An AI shopping assistant that helps teenagers on a budget build a wardrobe out
of pieces that are both affordable and durable, instead of cheap items that
fall apart fast.

## ⚠️ First: rotate your API key

The `.env` file you had included a real, live OpenAI API key. Treat that key
as compromised - go to https://platform.openai.com/api-keys, delete it, and
generate a new one. This project now ships with `.env.example` instead of a
real `.env`, so you won't accidentally do this again.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
# edit .env and paste your NEW key in
python app.py
```

Then open http://127.0.0.1:5000

## What's actually happening (for your write-up)

**The AI behavior is a real agent**, not just a chatbot wrapper:

- `products.py` holds the store's catalog (24 sample items with price, style,
  color, category, and a durability score).
- `app.py` gives the model a tool called `search_products` via OpenAI
  function calling.
- When a teenager asks something like *"find hoodies under $50"*, the model
  decides on its own to call `search_products(category="hoodie", max_budget=50)`,
  gets real results back from the catalog, and then writes a recommendation -
  favoring the more durable option when prices are close, and explaining why.
- This loop (ask → model calls tool → server runs it against real data →
  model reads results → model answers) is what makes it an **agent**: it is
  pursuing the goal ("find a good long-term-value item for this budget") by
  deciding what to search for, not just repeating a canned answer.

**What was broken before / what I fixed:**

- `smart.py` had two duplicate `/recommend` routes, `app.run()` called before
  routes were registered, a `recommend()` function defined twice with
  conflicting signatures, and top-level code (`input()`, an undefined
  `products` DataFrame) that would crash Flask on import. Rewrote as `app.py`
  with one clean route set and a working agent loop.
- The chat UI (`AIStylist.html`) wasn't connected to anything - `script.js`
  was empty. It's now wired to `/api` with real conversation history.
- The Style Quiz didn't submit anywhere, and the HTML file was missing its
  closing `</body></html>` tags. It now posts to `/recommend`, shows matching
  products, and saves a lightweight style profile to the browser so the
  Profile page can display it.
- Static file paths (`../static/style.css`, `logo.png`) didn't resolve
  correctly under Flask - fixed to `/static/...` with the correct filename
  casing.

## Project structure

```
app.py                 Flask app + AI agent
products.py             Sample catalog + search function
Templates/               HTML pages (index, AIStylist, StyleQuiz, profile)
static/style.css         Your original styling (untouched)
static/script.js         Chat, quiz, and profile logic
.env.example              Copy to .env with your own key
```

## Notes / limitations

- The catalog is a small hand-built sample (24 items) for demo purposes -
  swap `products.py` for a real database or API when this goes further.
- The saved "style profile" on the Profile page lives in the browser
  (`localStorage`), not a real account system - there's no login yet, so
  it only persists on the device that took the quiz.
