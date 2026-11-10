import asyncio
import os
import re
from typing import Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Cricket Live companion API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

CRICBUZZ = "https://www.cricbuzz.com"
PAGES = {
    "live": f"{CRICBUZZ}/cricket-match/live-scores",
    "upcoming": f"{CRICBUZZ}/cricket-schedule/upcoming-series",
    "recent": f"{CRICBUZZ}/cricket-match/live-scores",
}
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Referer": f"{CRICBUZZ}/",
}
SCORE_API_URL = os.getenv("SCORE_API_URL", "").rstrip("/")

def find_match_id(href: str) -> Optional[str]:
    if not href:
        return None

    match = re.search(
        r"/live-cricket-scores/(\d+)",
        href
    )

    return match.group(1) if match else None

def normalize_text(value: str) -> str:
    return re.sub(r"\\s+", " ", value or "").strip()

async def fetch_page(url: str) -> str:
    async with httpx.AsyncClient(headers=HEADERS, timeout=18, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.text

def parse_matches(html: str, category: str):
    soup = BeautifulSoup(html, "lxml")
    matches = []
    seen = set()

    # The page markup changes periodically. Find match anchors and inspect their
    # nearest card-like parent instead of relying on a single brittle CSS class.
    for anchor in soup.select('a[href*="live-cricket-scores"], a[href*="cricket-scores"], a[href*="scorecard"]'):
        href = anchor.get("href", "")
        match_id = find_match_id(href)
        title = normalize_text(anchor.get_text(" ", strip=True))
        if not match_id or not title or match_id in seen:
            continue
        seen.add(match_id)

        parent = anchor
        for _ in range(5):
            if parent.parent:
                parent = parent.parent
            text = normalize_text(parent.get_text(" ", strip=True))
            if len(text) > len(title) + 12:
                break
        card_text = normalize_text(parent.get_text(" ", strip=True))
        if len(card_text) > 600:
            card_text = card_text[:600]

        # Skip navigation links and overly generic labels.
        if len(title) < 5 or title.lower() in {"live score", "scorecard"}:
            continue

        matches.append({
            "id": match_id,
            "title": title,
            "series": "",
            "score": "",
            "score2": "",
            "status": card_text.replace(title, "", 1).strip()[:220] or "Tap to load score details",
            "url": urljoin(CRICBUZZ, href),
        })

    return matches[:40]

@app.get("/")
async def root():
    return {"name": "Cricket Live companion API", "status": "ok", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "ok"}

async def attach_score(match, client, semaphore):
    if not SCORE_API_URL or not match.get("id"):
        return match

    async with semaphore:
        try:
            response = await client.get(
                f"{SCORE_API_URL}/",
                params={"score": match["id"]}
            )

            response.raise_for_status()
            data = response.json()

            print(f"Score API response for {match['id']}: {data}")

            if data.get("status") == "success":
                match["score"] = data.get("score", "")
                match["title"] = data.get("title") or match["title"]

                batsmen = data.get("current_batsmen", [])
                if batsmen:
                    match["score2"] = " | ".join(
                        f"{b['name']} {b['score']}" for b in batsmen
                    )

        except Exception as error:
            print(f"Score error for {match.get('id')}: {error}")

    return match

@app.get("/matches")
async def matches(
    category: str = Query(
        "live",
        pattern="^(live|upcoming|recent)$"
    )
):
    url = PAGES[category]

    try:
        html = await fetch_page(url)
        found = parse_matches(html, category)

        if SCORE_API_URL and found:
            semaphore = asyncio.Semaphore(3)

            async with httpx.AsyncClient(
                timeout=30,
                follow_redirects=True
            ) as client:

                found = await asyncio.gather(
                    *[
                        attach_score(match, client, semaphore)
                        for match in found
                    ]
                )

        return {
            "category": category,
            "matches": found,
            "count": len(found)
        }

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve match list: {exc}"
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not parse match list: {exc}"
        )

@app.get("/score/{match_id}")
async def score(match_id: str):
    if not match_id.isdigit():
        raise HTTPException(status_code=400, detail="Invalid match ID")
    if not SCORE_API_URL:
        raise HTTPException(
            status_code=501,
            detail="Set SCORE_API_URL to the base URL of the original mskian score API deployment."
        )
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            response = await client.get(f"{SCORE_API_URL}/", params={"score": match_id})
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Score service error: {exc}")
