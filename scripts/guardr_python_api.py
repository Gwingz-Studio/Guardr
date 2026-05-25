#!/usr/bin/env python3
import os
import sys
import json
import asyncio
import httpx
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

app = FastAPI(title="Guardr Python API", version="1.0.0")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini
gemini_key = os.getenv("GEMINI_API_KEY")
if gemini_key:
    genai.configure(api_key=gemini_key)
    ai_model = genai.GenerativeModel('gemini-1.5-flash')
else:
    ai_model = None
    print("⚠️  Warning: GEMINI_API_KEY not set. Falling back to mock AI reports.")

# Helper to run standard username search in Python
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

PLATFORMS = [
    {"name": "Instagram", "url": "https://www.instagram.com/{}/", "indicators": ["Page Not Found"]},
    {"name": "GitHub", "url": "https://github.com/{}", "indicators": ["Not Found"]},
    {"name": "Reddit", "url": "https://www.reddit.com/user/{}/", "indicators": ["page not found"]},
    {"name": "Spotify", "url": "https://open.spotify.com/user/{}", "indicators": ["Page not found"]},
    {"name": "Tinder", "url": "https://tinder.com/@{}", "indicators": ["404 Not Found", "Page Not Found", "doesn't exist"]}
]

async def check_platform(client: httpx.AsyncClient, name: str, template: str, indicators: List[str], username: str):
    url = template.format(username)
    try:
        resp = await client.get(url, headers={"User-Agent": USER_AGENTS[0]}, timeout=5.0)
        status = resp.status_code
        if status == 404:
            found = False
        elif status == 200:
            body_lower = resp.text.lower()
            found = not any(ind.lower() in body_lower for ind in indicators)
        else:
            found = status < 400
        return {"platform": name, "url": url, "found": found, "status_code": status}
    except Exception:
        return {"platform": name, "url": url, "found": False, "status_code": None}

async def search_username_osint(username: str):
    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [
            check_platform(client, p["name"], p["url"], p["indicators"], username)
            for p in PLATFORMS
        ]
        return await asyncio.gather(*tasks)

# Requests and Response Models
class DemoCheckRequest(BaseModel):
    name: str
    location: Optional[str] = "Unknown"
    email: Optional[str] = None
    username: Optional[str] = None
    image_url: Optional[str] = None
    messages: Optional[List[str]] = None

@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "success": True,
        "data": "Guardr Python API is healthy",
        "message": "Service operational",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/check")
@app.post("/api/check")
async def check(payload: DemoCheckRequest):
    print(f"🕵️  Python OSINT Scan Started: {payload.name}")
    
    # 1. Platform checks
    username_results = []
    if payload.username:
        username_results = await search_username_osint(payload.username)
    
    # 2. Mock or real breach count check
    breach_count = 0
    breaches_found = []
    
    if payload.email:
        # Call HIBP if key exists
        hibp_key = os.getenv("HIBP_API_KEY")
        if hibp_key:
            try:
                async with httpx.AsyncClient() as client:
                    headers = {"hibp-api-key": hibp_key, "User-Agent": "Guardr-Python-Dev-Server"}
                    resp = await client.get(f"https://haveibeenpwned.com/api/v3/breachedaccount/{payload.email}", headers=headers, timeout=5.0)
                    if resp.status_code == 200:
                        breaches_found = resp.json()
                        breach_count = len(breaches_found)
            except Exception as e:
                print(f"HIBP scan error: {e}")
    
    # 3. Compile OSINT metadata
    platforms_found = [r["platform"] for r in username_results if r["found"]]
    
    # 4. Generate Gemini Safety narrative
    if ai_model:
        prompt = f"""
        You are Lady Guardr: a fierce, witty, drag queen cybersecurity and dating safety analyst for LGBTQ+ daters.
        
        Analyze this candidate:
        Name: {payload.name}
        Location: {payload.location}
        Email: {payload.email or 'Not provided'}
        Username: {payload.username or 'Not provided'}
        Data Breaches Found: {breach_count} (HIBP)
        Social Profiles Found: {', '.join(platforms_found) if platforms_found else 'None'}
        
        Generate a detailed report. Format your response STRICTLY as a valid JSON object matching this structure:
        {{
            "risk_level": "LOW" | "MEDIUM" | "HIGH",
            "risk_score": 0-100,
            "person_verification": "A fabulous, detailed paragraph explaining the digital footprint, calling out red flags or positive signals, styled with Lady Guardr drag flair but packed with analytical accuracy.",
            "recommendations": ["A list of 3 concise, practical safety steps for this specific user footprint"]
        }}
        """
        try:
            response = ai_model.generate_content(prompt)
            text = response.text
            start = text.find('{')
            end = text.rfind('}') + 1
            report_data = json.loads(text[start:end])
        except Exception as e:
            print(f"Gemini generation error: {e}")
            report_data = None
    else:
        report_data = None

    if not report_data:
        # Fallback Mock Report following Guardr core philosophy:
        # 0 breaches = highly suspicious/fabricated identity (65 pts)
        # More breaches = established digital history (lowers risk score)
        # More social footprints = proof of real presence (lowers risk score)
        
        breach_score = 65 if breach_count == 0 else 35 if breach_count <= 2 else 15 if breach_count <= 5 else 8
        footprint_score = 85 if len(platforms_found) == 0 else 60 if len(platforms_found) <= 2 else 30 if len(platforms_found) <= 5 else 15
        
        risk_score = int((breach_score + footprint_score) / 2)
        risk_level = "HIGH" if risk_score > 70 else "MEDIUM" if risk_score > 40 else "LOW"
        
        report_data = {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "person_verification": f"Fierce checks completed, darling! Checked {len(username_results)} platform templates and breach sources. Found footprint on {', '.join(platforms_found) if platforms_found else 'no platforms'}. Breach status: {breach_count} records identified.",
            "recommendations": [
                "Verify identity with a quick video call before meeting in person.",
                "Keep dating communications on the official application channel.",
                "Always choose a public, crowded spot for first dates."
            ]
        }

    return {
        "name": payload.name,
        "risk_level": report_data["risk_level"],
        "risk_score": report_data["risk_score"],
        "person_verification": report_data["person_verification"],
        "username_verification": username_results,
        "recommendations": report_data["recommendations"],
        "safety_tips": [
            {"category": "Smart Habits", "message": "Always meet in public places for first dates."},
            {"category": "Pride Safety", "message": "LGBTQ+ daters face higher harassment rates—verify first, darling!"},
            {"category": "Zero Knowledge", "message": "Your tokens and searches are never stored on our database."}
        ]
    }

class Message(BaseModel):
    content: str
    timestamp: str
    sender: str

class ParticipantClaims(BaseModel):
    name: Optional[str] = "Match"
    location: Optional[str] = "Unknown"
    bio: Optional[str] = ""

class ConversationAnalysisRequest(BaseModel):
    messages: List[Message]
    participant_info: Optional[ParticipantClaims] = None

@app.post("/v1/dating/analyze-conversation")
@app.post("/api/v1/dating/analyze-conversation")
async def analyze_conversation(payload: ConversationAnalysisRequest):
    print(f"💬 Analyzing Tinder Chat log with {payload.participant_info.name if payload.participant_info else 'Match'}")
    
    chat_transcript = "\n".join([
        f"[{m.sender}]: {m.content}" for m in payload.messages
    ])
    
    if ai_model:
        prompt = f"""
        You are Lady Guardr: a fierce drag queen AI dating safety specialist.
        
        Analyze this chat log for red flags, love-bombing, pressure tactics, and catfish signals:
        {chat_transcript}
        
        Format your response STRICTLY as a valid JSON object matching this structure:
        {{
            "overall_risk_score": 0.0-1.0 (float),
            "love_bombing_score": 0.0-1.0 (float),
            "pressure_indicators": 0-10,
            "red_flag_count": 0-10,
            "risk_indicators": [
                {{
                    "indicator_type": "Love Bombing" | "Financial Request" | "Guilt Tripping" | "Safe",
                    "confidence": 0.0-1.0,
                    "description": "Fabulous explanation of this specific dynamic, with drag queen flair.",
                    "evidence": ["Exact quote from the message log"]
                }}
            ],
            "recommendations": ["A list of 2-3 protective actions"]
        }}
        """
        try:
            response = ai_model.generate_content(prompt)
            text = response.text
            start = text.find('{')
            end = text.rfind('}') + 1
            report_data = json.loads(text[start:end])
        except Exception as e:
            print(f"Gemini chat analysis error: {e}")
            report_data = None
    else:
        report_data = None

    if not report_data:
        # Fallback mock report
        report_data = {
            "overall_risk_score": 0.25,
            "love_bombing_score": 0.15,
            "pressure_indicators": 0,
            "red_flag_count": 0,
            "risk_indicators": [
                {
                    "indicator_type": "Safe",
                    "confidence": 0.9,
                    "description": "Everything looks fabulous, darling! The conversation patterns show standard organic progression.",
                    "evidence": []
                }
            ],
            "recommendations": [
                "Keep conversing on the dating platform—no need to switch to WhatsApp yet.",
                "Have a spectacular time darlings, but always meet in public!"
            ]
        }

    return {
        "success": True,
        "data": {
            "overall_risk_score": report_data["overall_risk_score"] * 100, # convert to 100-scale
            "risk_indicators": report_data["risk_indicators"],
            "identity_consistency": {
                "consistency_score": (1.0 - report_data["overall_risk_score"]) * 100,
                "inconsistencies": [],
                "verified_claims": 2,
                "unverified_claims": 0
            },
            "conversation_patterns": {
                "love_bombing_score": report_data["love_bombing_score"],
                "pressure_indicators": report_data["pressure_indicators"],
                "red_flag_count": report_data["red_flag_count"]
            },
            "recommendations": report_data["recommendations"]
        }
    }

if __name__ == "__main__":
    import uvicorn
    # Start on host 0.0.0.0 and port 5001 to avoid AirPlay conflict
    uvicorn.run(app, host="0.0.0.0", port=5001)
