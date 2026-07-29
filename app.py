"""
Smart Stitch AI - Flask backend

This app powers a shopping assistant for teenagers building an affordable,
long-lasting wardrobe. The AI is an AGENT that uses OpenAI's built-in hosted
web_search tool (Responses API) to look things up on the live web before
answering. There is no pre-loaded product catalog and no separate search API
key - only OPENAI_API_KEY is required.
"""

import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = Flask(__name__, template_folder="Templates", static_folder="static")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
# gpt-4.1-mini supports the hosted web_search tool and is fast/cheap.
# Upgrade to "gpt-5.5" for higher-quality agentic search if you have access.
MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

SYSTEM_PROMPT = """You are Smart Stitch AI, a shopping agent for teenagers who are
on a budget and want to build a wardrobe out of pieces that are affordable AND
built to last, instead of cheap items that fall apart quickly.

Your goal on every request is to:
1. Figure out what the user is trying to build or find (an item, an outfit, a
   comparison, general advice).
2. Search the web whenever the user mentions a budget, style, color, category,
   or brand, or asks for recommendations or comparisons. Do not guess at
   prices, brands, or inventory - always search and base your answer on what
   comes back.
3. Recommend items that balance price and durability/quality, using what the
   search results actually say. Briefly explain WHY a pick is good value.
4. Keep answers short, friendly, and practical - you're talking to a teenager,
   not writing a report. Mention where an item is from when it's relevant.

If the user asks something with no connection to clothing/shopping/budgeting,
gently steer the conversation back to what Smart Stitch AI can help with.
"""


def run_agent(user_message, history=None):
    """
    Calls the Responses API with the hosted web_search tool. OpenAI runs the
    search itself (that's what makes this an agent instead of a plain
    chatbot) - the model decides when to search, what to search for, and
    reads the results before answering. No manual tool loop needed.
    """
    input_items = []
    for turn in history or []:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and content:
            input_items.append({"role": role, "content": content})
    input_items.append({"role": "user", "content": user_message})

    response = client.responses.create(
        model=MODEL_NAME,
        instructions=SYSTEM_PROMPT,
        tools=[{"type": "web_search"}],
        input=input_items,
    )

    return response.output_text or "Sorry, I wasn't able to come up with a recommendation for that."


def search_products_live(query, num_results=8):
    """
    A lighter call used by the Style Quiz / hero box: run one web search and
    return the cited sources (title + link) as structured results, instead
    of a full chat answer.
    """
    response = client.responses.create(
        model=MODEL_NAME,
        instructions="Search the web for the user's request and briefly summarize "
                      "what you find. Always cite the pages you used.",
        tools=[{"type": "web_search"}],
        input=query,
    )

    results = []
    for item in response.output:
        if getattr(item, "type", None) != "message":
            continue
        for block in item.content:
            for annotation in getattr(block, "annotations", []) or []:
                if getattr(annotation, "type", None) == "url_citation":
                    results.append({
                        "title": annotation.title,
                        "link": annotation.url,
                        "snippet": "",
                        "source": annotation.url.split("/")[2] if "//" in annotation.url else "",
                    })

    return results[:num_results]


# ---------------------------------------------------------------- pages ----

@app.route("/")
@app.route("/index.html")
def index():
    return render_template("index.html")


@app.route("/AIStylist.html")
def ai_stylist():
    return render_template("AIStylist.html")


@app.route("/StyleQuiz.html")
def style_quiz():
    return render_template("StyleQuiz.html")


@app.route("/profile.html")
def profile():
    return render_template("profile.html")


# ------------------------------------------------------------------- api ---

@app.route("/api", methods=["POST"])
def api():
    data = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()
    history = data.get("history", [])  # [{role, content}, ...] from the client

    if not message:
        return jsonify({"error": "Message is required"}), 400

    try:
        reply_text = run_agent(message, history=history)
    except Exception as exc:  # noqa: BLE001 - surface a friendly error to the UI
        return jsonify({"error": f"AI request failed: {exc}"}), 500

    return jsonify({"reply": reply_text})


@app.route("/recommend", methods=["POST"])
def recommend_route():
    """Plain live web search (no chat) used by the Style Quiz and hero form."""
    data = request.get_json(silent=True) or request.form

    style = (data.get("style") or "").strip()
    color = (data.get("color") or "").strip()
    category = (data.get("category") or "").strip()
    budget = data.get("budget")

    query_parts = ["buy"]
    if color:
        query_parts.append(color)
    if style:
        query_parts.append(style)
    query_parts.append(category or "clothing")
    if budget:
        query_parts.append(f"under ${budget}")
    query = " ".join(query_parts)

    try:
        results = search_products_live(query, num_results=8)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500

    return jsonify(results)


if __name__ == "__main__":
    app.run(debug=True)