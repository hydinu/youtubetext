"""
══════════════════════════════════════════════════════
EduTube AI — FastAPI Backend Server
══════════════════════════════════════════════════════
Endpoints:
  GET  /                     →  Serve the frontend (index.html)
  GET  /api/search-videos    →  Search YouTube by topic (ytfetcher)
  POST /api/generate-notes   →  Generate AI study notes from a video URL
  GET  /health               →  Health check

Run:
  py -3.13 -m uvicorn main:app --reload --port 8000
══════════════════════════════════════════════════════
"""

import os
import re
import json
import logging
import asyncio
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import httpx
from youtube_transcript_api import YouTubeTranscriptApi

# ── ytfetcher ─────────────────────────────────────
from ytfetcher import YTFetcher

# ── Configuration ─────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyDbhQswrcC6K9TvsnVBtXpj_4v2VU3vN6U")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
GEMINI_MODEL   = "gemini-2.0-flash"

# Frontend root = one level above the server/ folder
FRONTEND_DIR = Path(__file__).parent.parent.resolve()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("edutube-ai")


# ── FastAPI App ────────────────────────────────────

app = FastAPI(
    title="EduTube AI Backend",
    description="AI study notes + YouTube search powered by ytfetcher",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static assets (css/, js/) from the frontend folder
app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
app.mount("/js",  StaticFiles(directory=str(FRONTEND_DIR / "js")),  name="js")


# ── Request / Response Models ──────────────────────

class NotesRequest(BaseModel):
    video_url: str

class NoteSection(BaseModel):
    timestamp: str
    section_title: str
    content: str

class NotesResponse(BaseModel):
    video_title: str
    notes: List[NoteSection]

class VideoResult(BaseModel):
    title: str
    video_id: str
    link: str
    thumbnail: Optional[str] = None
    channel: Optional[str] = None
    published_at: Optional[str] = None
    description: Optional[str] = None
    has_transcript: bool = False

class SearchResponse(BaseModel):
    topic: str
    videos: List[VideoResult]
    source: str = "ytfetcher"


# ── Helpers ────────────────────────────────────────

def extract_video_id(url: str) -> Optional[str]:
    patterns = [
        r'(?:v=|\/v\/|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$',
    ]
    for pattern in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


def format_timestamp(seconds: float) -> str:
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"


def fetch_transcript(video_id: str) -> str:
    """
    Try to fetch a transcript in any available language.
    Raises HTTPException if no transcript is available at all.
    """
    try:
        api = YouTubeTranscriptApi()

        # List all available transcripts for this video
        transcript_list = api.list(video_id)

        # Prefer manually created, then auto-generated, any language
        transcript = None
        try:
            # Try manually created captions first
            transcript = transcript_list.find_manually_created_transcript(
                ['en', 'en-US', 'en-GB', 'hi', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh']
            )
        except Exception:
            pass

        if transcript is None:
            try:
                # Fall back to auto-generated captions
                transcript = transcript_list.find_generated_transcript(
                    ['en', 'en-US', 'en-GB', 'hi', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh']
                )
            except Exception:
                pass

        if transcript is None:
            # Last resort: grab whatever is first available
            all_transcripts = list(transcript_list)
            if all_transcripts:
                transcript = all_transcripts[0]

        if transcript is None:
            raise Exception("No transcripts available")

        fetched = transcript.fetch()

    except Exception as e:
        logger.error(f"Transcript unavailable for {video_id}: {e}")
        raise HTTPException(
            status_code=404,
            detail=(
                "This video doesn't have captions/subtitles enabled. "
                "Please try a different video that has captions. "
                f"(Details: {str(e)})"
            )
        )

    lines = []
    for snippet in fetched.snippets:
        ts   = format_timestamp(snippet.start)
        text = snippet.text.replace('\n', ' ').strip()
        if text:
            lines.append(f"[{ts}] {text}")

    return "\n".join(lines)


async def call_gemini_api(transcript: str) -> dict:
    system_prompt = """You are an expert teacher creating concise, student-friendly study notes.
Only use the content from the provided YouTube video transcript.
Organize notes by timestamps. Use simple language suitable for students.
Use bullet points and highlight key concepts.
Never add any external information not present in the transcript."""

    user_prompt = f"""Analyze the following YouTube video transcript and create organized study notes.

IMPORTANT: Return ONLY a valid JSON object (no markdown, no code fences, no extra text).
Use this exact structure:
{{
  "video_title": "A short descriptive title for this video based on the content",
  "notes": [
    {{
      "timestamp": "00:00",
      "section_title": "Section Name",
      "content": "• Bullet point 1\\n• Bullet point 2\\n• Key explanation"
    }}
  ]
}}

Group the transcript into logical sections (5-10 sections).
Each section should cover a coherent topic from the video.
Use the timestamp of the first line in each section.

TRANSCRIPT:
{transcript}"""

    headers = {"Authorization": f"Bearer {GEMINI_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": GEMINI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        try:
            response = await client.post(GEMINI_API_URL, json=payload, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Gemini API error {e.response.status_code}: {e.response.text[:200]}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Failed to reach Gemini API: {str(e)}")

    raw = response.json()["choices"][0]["message"]["content"].strip()
    if raw.startswith("```"):
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$',          '', raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON. Please try again.")


# ── ytfetcher search (blocking → run in thread) ────

def _ytfetcher_search(topic: str, max_results: int) -> List[VideoResult]:
    try:
        fetcher = YTFetcher.from_search(query=topic, max_results=max_results)
        videos  = fetcher.fetch_youtube_data()
    except Exception as e:
        logger.error(f"ytfetcher search failed: {e}")
        raise RuntimeError(f"ytfetcher failed: {str(e)}")

    results = []
    for video in videos:
        meta   = video.metadata
        vid_id = getattr(meta, "video_id", None) or ""
        results.append(VideoResult(
            title          = getattr(meta, "title", "Unknown Title"),
            video_id       = vid_id,
            link           = f"https://youtube.com/watch?v={vid_id}" if vid_id else "",
            thumbnail      = f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg" if vid_id else None,
            channel        = getattr(meta, "channel_title", None),
            published_at   = str(getattr(meta, "published_at", "") or ""),
            description    = getattr(meta, "description", None),
            has_transcript = bool(getattr(video, "transcripts", None)),
        ))
    return results


# ── Routes ─────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def serve_index():
    """Serve the frontend index.html."""
    index = FRONTEND_DIR / "index.html"
    if not index.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(str(index))


@app.get("/api/search-videos", response_model=SearchResponse)
async def search_videos(
    topic:       str = Query(..., description="Topic to search for"),
    max_results: int = Query(9,   ge=1, le=20),
):
    """Search YouTube by topic using ytfetcher."""
    logger.info(f"ytfetcher search: '{topic}', max={max_results}")
    try:
        videos = await asyncio.to_thread(_ytfetcher_search, topic, max_results)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    logger.info(f"ytfetcher returned {len(videos)} videos for '{topic}'")
    return SearchResponse(topic=topic, videos=videos, source="ytfetcher")


@app.post("/api/generate-notes", response_model=NotesResponse)
async def generate_notes(req: NotesRequest):
    """Generate AI study notes from a YouTube video URL."""
    video_id = extract_video_id(req.video_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL.")

    logger.info(f"Generating notes for: {video_id}")
    transcript = fetch_transcript(video_id)
    logger.info(f"Transcript: {len(transcript)} chars")
    notes_data = await call_gemini_api(transcript)
    return notes_data


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "edutube-ai-backend", "version": "2.0.0"}
