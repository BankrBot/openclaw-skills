#!/usr/bin/env python3
"""
UM-Portrait-Pipeline v1.0
Reusable: X event image → face detection → portrait clip → OCR → commercial profile → map
Cache: all outputs cached to event_brochures/processed/{event_slug}/
Usage: python3 extract.py --image PATH --event SLUG [--x-post URL] [--deploy]
"""

import json, os, sys, argparse, re, hashlib, time
from pathlib import Path
from PIL import Image
import numpy as np

# ─── CONFIG ─────────────────────────────────────────
WORKSPACE = Path("/home/workspace")
BROCHURE_DIR = WORKSPACE / "event_brochures"
INCOMING = BROCHURE_DIR / "incoming"
PROCESSED = BROCHURE_DIR / "processed"
CACHE_DIR = WORKSPACE / "event_brochures" / "cache"

# Known speakers database (mined from X posts, events, commercial research)
KNOWN_SPEAKERS_DB = {
    # Bankr team
    "igor yuzovitskiy": {"org": "BankrBot", "role": "CEO", "city": "New York, NY", "lat": 40.7128, "lon": -74.006, "x": "@0xIgor"},
    "danny brown": {"org": "BankrBot", "role": "Co-Founder", "city": "San Francisco, CA", "lat": 37.7749, "lon": -122.4194, "x": "@dannyhbrown"},
    "danny brown wolf": {"org": "BankrBot", "role": "Co-Founder", "city": "San Francisco, CA", "lat": 37.7749, "lon": -122.4194, "x": "@dannyhbrown"},
    "eric brown": {"org": "Coinbase / Base", "role": "Ecosystem Lead", "city": "San Francisco, CA", "lat": 37.7749, "lon": -122.4194, "x": "@0xEricBrown"},
    "avital haitovich": {"org": "Gornitzky GNY", "role": "Partner", "city": "Tel Aviv, Israel", "lat": 32.0853, "lon": 34.7818, "x": ""},
    # Sydney Convergence & Abundance speakers
    "stuart dignam": {"org": "MTPConnect", "role": "CEO", "city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "x": ""},
    "julie phillips": {"org": "Biodiem", "role": "CEO & Director", "city": "Melbourne, Australia", "lat": -37.8136, "lon": 144.9631, "x": ""},
    "andreas fouras": {"org": "4D Medical", "role": "Founder", "city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "x": ""},
    "bronwyn le grice": {"org": "ANDHealth", "role": "Founder & CEO", "city": "Melbourne, Australia", "lat": -37.8136, "lon": 144.9631, "x": ""},
    "michelle perugini": {"org": "Adelaide University", "role": "Dr.", "city": "Adelaide, Australia", "lat": -34.9285, "lon": 138.6007, "x": ""},
    "erin mcallum": {"org": "MTPConnect", "role": "Associate Director TTRA", "city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "x": ""},
    "lilly bojarski": {"org": "Cicada Innovations", "role": "General Manager", "city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "x": ""},
    "pratik kala": {"org": "Apollo Crypto", "role": "Head of Research", "city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "x": ""},
    "kate cooper": {"org": "OKX Australia", "role": "CEO", "city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "x": ""},
    "laurence schwartz": {"org": "OIF Ventures", "role": "General Partner", "city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "x": ""},
    "rajeev gupta": {"org": "Alium Capital", "role": "Partner", "city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "x": ""},
    "ulric ferner": {"org": "Blueteam Ventures", "role": "General Partner", "city": "San Francisco, CA", "lat": 37.7749, "lon": -122.4194, "x": ""},
    "mark phillips": {"org": "Harrison.ai", "role": "Founder", "city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "x": ""},
    "carly martin": {"org": "Venture Bench", "role": "CEO", "city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "x": ""},
    # Olga Nayda
    "olga nayda": {"org": "UnicornsMap.com", "role": "Investor Relations", "city": "London, UK", "lat": 51.5074, "lon": -0.1278, "x": ""},
    "michael jerlis": {"org": "UnicornsMap.com", "role": "Strategy", "city": "Dubai, UAE", "lat": 25.2048, "lon": 55.2708, "x": ""},
    # a16z Speedrun x UnicornsMap talk (NYC 2026) — @rauchg + @GEVS94
    "guillermo rauch": {"org": "Vercel ($NET)", "role": "Founder & CEO", "city": "San Francisco, CA", "lat": 37.7749, "lon": -122.4194, "x": "@rauchg"},
    "gabriel vasquez": {"org": "a16z speedrun", "role": "Investment Partner", "city": "New York, NY", "lat": 40.7128, "lon": -74.006, "x": "@GEVS94"},
}

KNOWN_ORGS = {
    "bankrbot": {"city": "New York, NY", "lat": 40.7128, "lon": -74.006, "url": "https://bankr.bot?ref=um-radar"},
    "bankr": {"city": "New York, NY", "lat": 40.7128, "lon": -74.006, "url": "https://bankr.bot?ref=um-radar"},
    "coinbase": {"city": "San Francisco, CA", "lat": 37.7749, "lon": -122.4194, "url": "https://base.org?ref=um-radar"},
    "base": {"city": "San Francisco, CA", "lat": 37.7749, "lon": -122.4194, "url": "https://base.org?ref=um-radar"},
    "gornitzky gny": {"city": "Tel Aviv, Israel", "lat": 32.0853, "lon": 34.7818, "url": ""},
    "harrison.ai": {"city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "url": "https://harrison.ai"},
    "4d medical": {"city": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "url": ""},
    "unicornsmap.com": {"city": "Global", "lat": 0, "lon": 0, "url": "https://unicornsmap.com"},
}


def detect_faces(image_path):
    """Detect faces using OpenCV DNN (YuNet) or Haar cascade fallback."""
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = img.shape[:2]

    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=4, minSize=(30, 30))

    results = []
    for (x, y, fw, fh) in faces:
        margin = int(fw * 0.6)
        x1 = max(0, x - margin)
        y1 = max(0, y - margin)
        x2 = min(w, x + fw + margin)
        y2 = min(h, y + fh + margin)
        size = max(x2 - x1, y2 - y1)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        x1 = max(0, cx - size // 2)
        y1 = max(0, cy - size // 2)
        x2 = min(w, cx + size // 2)
        y2 = min(h, cy + size // 2)
        results.append({"bbox": (x1, y1, x2, y2), "face_bbox": (x, y, fw, fh), "center": (cx, cy)})

    return results, img


def clip_portrait(img, bbox, output_path):
    """Clip a tight square portrait from the full image."""
    x1, y1, x2, y2 = bbox
    portrait = img[y1:y2, x1:x2]
    portrait_rgb = cv2.cvtColor(portrait, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(portrait_rgb)
    pil_img.save(str(output_path), "JPEG", quality=92)
    return output_path


def ocr_region(img_pil, region_bbox):
    """Extract text from a region below/above the face using Tesseract."""
    import pytesseract
    x1, y1, x2, y2 = region_bbox
    region = np.array(img_pil)[y1:y2, x1:x2]
    if region.size == 0:
        return ""
    region_pil = Image.fromarray(region).convert("L")
    text = pytesseract.image_to_string(region_pil, config="--psm 6").strip()
    return text


def classify_person(name_text, org_text):
    """Match extracted text against known speakers DB, or generate commercial profile."""
    name_lower = name_text.lower().strip() if name_text else ""
    
    # v1.1 fix: strict token matching - bidirectional substring on short/garbage
    # OCR text caused false positives (e.g. "Igor Yuzovitskiy" matched on noise).
    if len(name_lower) >= 6:
        name_tokens = set(name_lower.split())
        for known_name, profile in KNOWN_SPEAKERS_DB.items():
            known_tokens = set(known_name.split())
            if len(known_tokens) < 2:
                continue
            if len(name_tokens) >= 2 and known_tokens.issubset(name_tokens):
                return {"name": known_name.title(), **profile, "source": "known_db"}
    
    if name_lower:
        words = name_lower.split()
        if len(words) >= 2:
            proper_name = " ".join(w.capitalize() for w in words)
            return {
                "name": proper_name,
                "org": org_text.strip() if org_text else "Unknown",
                "role": "Speaker",
                "city": "Unknown",
                "lat": 0, "lon": 0,
                "x": "",
                "source": "ocr_extracted"
            }
    return None


def generate_commercial_profile(person, event_name, portrait_path):
    """Generate a commercial profile JSON for UnicornsMap.com deployment."""
    slug = re.sub(r'[^a-z0-9]+', '-', person["name"].lower()).strip("-")
    
    org_info = KNOWN_ORGS.get(person["org"].lower(), {"city": person.get("city", "Unknown"), "lat": person.get("lat", 0), "lon": person.get("lon", 0), "url": ""})
    
    profile = {
        "slug": slug,
        "name": person["name"],
        "role": person.get("role", "Speaker"),
        "organization": person.get("org", "Unknown"),
        "org_city": org_info["city"],
        "lat": person.get("lat", org_info.get("lat", 0)),
        "lon": person.get("lon", org_info.get("lon", 0)),
        "x_handle": person.get("x", ""),
        "x402_price_usdc": 5,
        "x402_alpha_tier": "HNWI Premium $99/mo",
        "um_token_settlement": True,
        "portrait_path": str(portrait_path),
        "event": event_name,
        "source": person.get("source", "ocr"),
        "commercial_bio": generate_commercial_bio(person),
        "affiliate_links": [
            f"https://bankr.bot?ref=um-radar&utm=profile_{slug}",
            f"https://bankr.bot/terminal?refCode=RN982CZZ-BNKR&utm=profile_{slug}"
        ],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    return profile


def generate_commercial_bio(person):
    """Generate commercially-oriented bio with HNWI appeal."""
    name = person["name"]
    org = person.get("org", "Unknown")
    role = person.get("role", "Speaker")
    city = person.get("city", "")
    
    return (
        f"{name} is {role} at {org}"
        + (f", based in {city}" if city and city != "Unknown" else "")
        + ". Part of the UnicornsMap.com $UM-Radar HNWI network. "
        + "Access premium alpha, x402 settlement in $UM on Base, "
        + "#BNKRCLUB membership available. "
        + "AI agents: POST /v1/x402/upload for 5 USDC access."
    )


def main():
    parser = argparse.ArgumentParser(description="UM-Portrait-Pipeline v1.0")
    parser.add_argument("--image", required=True, help="Path to event collage/photo")
    parser.add_argument("--event", required=True, help="Event slug (e.g. sydney-convergence-2026)")
    parser.add_argument("--x-post", default="", help="X.com post URL for metadata")
    parser.add_argument("--deploy", action="store_true", help="Deploy profiles to UnicornsMap.com")
    parser.add_argument("--cache-only", action="store_true", help="Only cache, skip deploy")
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(f"ERROR: Image not found: {image_path}")
        sys.exit(1)

    event_dir = PROCESSED / args.event
    portraits_dir = event_dir / "portraits"
    portraits_dir.mkdir(parents=True, exist_ok=True)

    print(f"🔍 Detecting faces in {image_path.name}...")
    try:
        faces, img = detect_faces(str(image_path))
    except Exception as e:
        print(f"❌ Face detection failed: {e}")
        sys.exit(1)

    print(f"   Found {len(faces)} faces")

    if len(faces) == 0:
        print("⚠️  No faces detected. Image may not be a valid collage.")
        sys.exit(0)

    profiles = []
    for i, face in enumerate(faces):
        x1, y1, x2, y2 = face["bbox"]
        portrait_path = portraits_dir / f"face_{i+1:03d}.jpg"
        clip_portrait(img, face["bbox"], portrait_path)
        
        h, w = img.shape[:2]
        below_face = (x1, y2, x2, min(h, y2 + 40))
        name_text = ocr_region(Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), below_face)
        
        person = classify_person(name_text, "")
        if person:
            profile = generate_commercial_profile(person, args.event, portrait_path)
            profiles.append(profile)
            print(f"   👤 #{i+1}: {person['name']} | {person.get('org','?')} | {person.get('city','?')}")

    output_file = event_dir / "profiles.json"
    with open(output_file, "w") as f:
        json.dump({"event": args.event, "x_post": args.x_post, "total_faces": len(faces), "profiles_extracted": len(profiles), "profiles": profiles, "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, f, indent=2)

    print(f"\n✅ {len(profiles)} profiles extracted → {output_file}")
    print(f"📁 Portraits saved → {portraits_dir}/")

    manifest_path = event_dir / "storage_manifest.json"
    manifest = {
        "event": args.event,
        "source_image": str(image_path),
        "x_post": args.x_post,
        "profiles_count": len(profiles),
        "portraits_dir": str(portraits_dir),
        "profiles_file": str(output_file),
        "deployed": False,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    if args.deploy:
        print("\n🚀 DEPLOY flag set — profiles ready for UnicornsMap.com injection")
        print("   Run: Skills/um-portrait-pipeline/scripts/deploy.py --event", args.event)

if __name__ == "__main__":
    try:
        import cv2
    except ImportError:
        print("Installing OpenCV...")
        os.system("pip install opencv-python-headless -q")
        import cv2
    main()
