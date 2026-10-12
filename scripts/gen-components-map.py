"""Generate the swimlane components map, styled like the web UI.

Usage: python3 scripts/gen-components-map.py OUT.svg [light|dark]   (default: light)
"""
import sys
from html import escape

OUT = sys.argv[1]
THEME = sys.argv[2] if len(sys.argv) > 2 else "light"  # "light" | "dark"
W, H = 1800, 1060
X0, ACTOR_W, COL_W = 50, 170, 218
TABLE_R = X0 + ACTOR_W + 7 * COL_W  # 1746
HDR_Y, HDR_H = 170, 50
ROW_Y0, ROW_H = HDR_Y + HDR_H, 104
FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

# Design tokens. Dark mirrors app/globals.css; light is the same system on white
# (Apple-style neutrals, accents deepened for contrast on a light canvas).
THEMES = {
    "dark": dict(
        BG="#0a0a0c", BG_RAISED="#121216", BORDER="rgba(255,255,255,0.08)", BORDER_STRONG="rgba(255,255,255,0.16)",
        TEXT="#ededef", TEXT_2="#b4b4bc", MUTED="#8a8a93", FAINT="#5c5c66", INK="#ffffff",
        SHADOW=0.35, GLOW=0.16, GLOW2=0.07, TINT=1.0,
        TONE=dict(human="#e08a5f", trigger="#8ea4d2", data="#5cc8a8", store="#6fb3c2", code="#e5b06a", ai="#a99cf0", deliver="#e5926a"),
    ),
    "light": dict(
        BG="#fbfbfd", BG_RAISED="#ffffff", BORDER="rgba(0,0,0,0.08)", BORDER_STRONG="rgba(0,0,0,0.14)",
        TEXT="#1d1d1f", TEXT_2="#48484f", MUTED="#86868b", FAINT="#a1a1a6", INK="#000000",
        SHADOW=0.07, GLOW=0.10, GLOW2=0.06, TINT=1.0,
        TONE=dict(human="#c8643a", trigger="#4a6fb5", data="#1e9a78", store="#2b8597", code="#b67a1c", ai="#6b57d1", deliver="#c25a3c"),
    ),
}
T = THEMES[THEME]
BG, BG_RAISED, BORDER, BORDER_STRONG = T["BG"], T["BG_RAISED"], T["BORDER"], T["BORDER_STRONG"]
TEXT, TEXT_2, MUTED, FAINT, INK = T["TEXT"], T["TEXT_2"], T["MUTED"], T["FAINT"], T["INK"]
TONE = T["TONE"]
ACCENT = TONE["human"]

COLS = ["Trigger", "Input", "Context", "AI · Extract", "Processing", "AI · Write", "Output"]
ROWS = [  # name, subtitle, band colour
    ("Aditya", "Podcast host", TONE["human"]),
    ("Vercel Cron", "Scheduler + admin", TONE["trigger"]),
    ("RSS Feeds", "Live data", TONE["data"]),
    ("Postgres", "Neon · memory", TONE["store"]),
    ("Code", "Next.js server", TONE["code"]),
    ("Gemini API", "Flash · language", TONE["ai"]),
    ("Delivery", "Resend + web UI", TONE["deliver"]),
]
# accent per box kind (boxes are dark glass with an accent hairline + dot)
KIND = TONE

def col_cx(c): return X0 + ACTOR_W + c * COL_W + COL_W / 2
def row_cy(r): return ROW_Y0 + r * ROW_H + ROW_H / 2

BW, BH = 198, 88
boxes = {}  # id -> (cx, cy)
parts = []

def box(bid, r, c, kind, title, lines):
    cx, cy = col_cx(c), row_cy(r)
    boxes[bid] = (cx, cy)
    accent = KIND[kind]
    x, y = cx - BW / 2, cy - BH / 2
    parts.append(f'<rect x="{x}" y="{y + 6}" width="{BW}" height="{BH}" rx="14" fill="#000" opacity="{T['SHADOW']}" filter="url(#soft)"/>')
    parts.append(f'<rect x="{x}" y="{y}" width="{BW}" height="{BH}" rx="14" fill="{BG_RAISED}"/>')
    parts.append(f'<rect x="{x}" y="{y}" width="{BW}" height="{BH}" rx="14" fill="{accent}" fill-opacity="{.06 if THEME == 'dark' else .045}" stroke="{accent}" stroke-opacity="{.45 if THEME == 'dark' else .4}" stroke-width="1"/>')
    parts.append(f'<circle cx="{x + BW - 14}" cy="{y + 14}" r="3" fill="{accent}" fill-opacity=".9"/>')
    ty = y + 22
    parts.append(f'<text x="{cx}" y="{ty}" text-anchor="middle" font-size="13" font-weight="600" letter-spacing="-0.2" fill="{TEXT}">{escape(title)}</text>')
    for i, ln in enumerate(lines):
        parts.append(f'<text x="{cx}" y="{ty + 18 + i * 15}" text-anchor="middle" font-size="10.5" fill="{TEXT_2}">{escape(ln)}</text>')

def pill(x, y, text, rotate=False):
    w = 7 + len(text) * 5.9
    tr = f' transform="rotate(-90 {x} {y})"' if rotate else ""
    parts.append(
        f'<g{tr}><rect x="{x - w / 2}" y="{y - 10}" width="{w}" height="20" rx="10" fill="{BG_RAISED}" stroke="{BORDER_STRONG}"/>'
        f'<text x="{x}" y="{y + 3.6}" text-anchor="middle" font-size="10" fill="{TEXT_2}">{escape(text)}</text></g>'
    )

def arrow(d, label=None, at=None, rotate=False):
    parts.append(f'<path d="{d}" fill="none" stroke="{FAINT}" stroke-width="1.4" stroke-dasharray="4 4" marker-end="url(#ah)"/>')
    if label:
        pill(*at, label, rotate)

# ---------- frame ----------
svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{FONT}">',
    '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
    f'<path d="M0,0 L10,5 L0,10 z" fill="{FAINT}"/></marker>'
    '<filter id="soft" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>'
    f'<radialGradient id="glowA" cx="15%" cy="0%" r="55%"><stop offset="0" stop-color="{ACCENT}" stop-opacity="{T['GLOW']}"/><stop offset="1" stop-color="{ACCENT}" stop-opacity="0"/></radialGradient>'
    f'<radialGradient id="glowB" cx="88%" cy="4%" r="40%"><stop offset="0" stop-color="{TONE['data']}" stop-opacity="{T['GLOW2']}"/><stop offset="1" stop-color="{TONE['data']}" stop-opacity="0"/></radialGradient>'
    '</defs>',
    f'<rect width="{W}" height="{H}" fill="{BG}"/>',
    f'<rect width="{W}" height="{H}" fill="url(#glowA)"/>',
    f'<rect width="{W}" height="{H}" fill="url(#glowB)"/>',
    f'<text x="{X0}" y="62" font-family="{MONO}" font-size="12" letter-spacing="2.2" fill="{MUTED}">PODCAST ECOSYSTEM RADAR</text>',
    f'<text x="{X0}" y="108" font-size="40" font-weight="600" letter-spacing="-1.4" fill="{TEXT}">Components map<tspan fill="{MUTED}">, end to end.</tspan></text>',
    f'<text x="{X0}" y="140" font-size="15" fill="{MUTED}">'
    '10 live RSS feeds → Gemini extracts facts → code finds overlaps → Gemini writes → brief in the inbox by 6:00 AM IST Monday</text>',
]

# glass table surface
TABLE_H = HDR_H + 7 * ROW_H
svg.append(f'<rect x="{X0}" y="{HDR_Y}" width="{TABLE_R - X0}" height="{TABLE_H}" rx="20" fill="{BG_RAISED}" fill-opacity="{.025 if THEME == 'dark' else .9}" stroke="{BORDER}"/>')
svg.append(f'<clipPath id="tbl"><rect x="{X0}" y="{HDR_Y}" width="{TABLE_R - X0}" height="{TABLE_H}" rx="20"/></clipPath>')

# header row: small mono uppercase labels, like the UI eyebrows
svg.append(f'<line x1="{X0}" y1="{HDR_Y + HDR_H}" x2="{TABLE_R}" y2="{HDR_Y + HDR_H}" stroke="{BORDER}"/>')
def eyebrow(x, label):
    return (f'<text x="{x}" y="{HDR_Y + 30}" text-anchor="middle" font-family="{MONO}" font-size="11" '
            f'letter-spacing="1.8" fill="{MUTED}">{escape(label.upper())}</text>')
svg.append(eyebrow(X0 + ACTOR_W / 2, "Actor"))
for c, name in enumerate(COLS):
    svg.append(eyebrow(col_cx(c), name))

# lanes: hairline separators, a whisper of each actor's accent, accent bar in the actor cell
svg.append('<g clip-path="url(#tbl)">')
for r, (name, sub, tone) in enumerate(ROWS):
    y = ROW_Y0 + r * ROW_H
    svg.append(f'<rect x="{X0 + ACTOR_W}" y="{y}" width="{TABLE_R - X0 - ACTOR_W}" height="{ROW_H}" fill="{tone}" fill-opacity="{(.035 if r % 2 == 0 else .02) if THEME == 'dark' else (.045 if r % 2 == 0 else .025)}"/>')
    svg.append(f'<rect x="{X0}" y="{y}" width="{ACTOR_W}" height="{ROW_H}" fill="{INK}" fill-opacity="{.02 if THEME == 'dark' else .015}"/>')
    svg.append(f'<rect x="{X0 + 18}" y="{y + ROW_H / 2 - 16}" width="2.5" height="32" rx="1.25" fill="{tone}"/>')
    if r < 6:
        svg.append(f'<line x1="{X0}" y1="{y + ROW_H}" x2="{TABLE_R}" y2="{y + ROW_H}" stroke="{BORDER}"/>')
    svg.append(f'<text x="{X0 + 34}" y="{y + ROW_H / 2 - 2}" font-size="15" font-weight="600" letter-spacing="-0.2" fill="{TEXT}">{escape(name)}</text>')
    svg.append(f'<text x="{X0 + 34}" y="{y + ROW_H / 2 + 16}" font-size="11" fill="{MUTED}">{escape(sub)}</text>')
svg.append('</g>')
svg.append(f'<line x1="{X0 + ACTOR_W}" y1="{HDR_Y}" x2="{X0 + ACTOR_W}" y2="{HDR_Y + TABLE_H}" stroke="{BORDER}"/>')
for c in range(1, 7):
    x = X0 + ACTOR_W + c * COL_W
    svg.append(f'<line x1="{x}" y1="{ROW_Y0}" x2="{x}" y2="{ROW_Y0 + 7 * ROW_H}" stroke="{INK}" stroke-opacity="{.035 if THEME == 'dark' else .04}"/>')

# ---------- boxes ----------
box("cfg", 0, 0, "human", "Edits config (no code)", ["config/shows.json · 10 shows", "enabled · self_brands", "settings.json · 30d / 7d windows"])
box("cron", 1, 0, "trigger", "Cron fires", ["Mon 00:30 UTC = 06:00 IST", "daily ingest at 00:00 IST", "/admin “Run now” · ADMIN_SECRET"])
box("rss", 2, 1, "data", "Fetches 10 feeds", ["rss-parser · Zod-validated", "last 35 days · dedupe by guid", "title · notes · link · transcript"])
box("db", 3, 2, "store", "Stores everything", ["shows · episodes · topic_canon", "briefs by week · runs log", "idempotent: skips processed"])
box("ext", 5, 3, "ai", "Extracts facts", ["guests · 2–5 topics · brands", "JSON schema · empty > guess", "5 episodes/call · retry+backoff"])
box("math", 4, 4, "code", "Code does the maths", ["names merged: Levenshtein ≤ 2", "guests on ≥ 2 shows · 30 days", "topics ≥ 2 shows · 7d · paid brands"])
box("write", 5, 5, "ai", "Writes the brief", ["1 call merges topic labels", "3-line summary + next steps", "cites items by ref id only"])
box("render", 4, 6, "code", "Renders the brief", ["code attaches episode links", "Markdown + email HTML", "saved to Postgres by week"])
box("deliver", 6, 6, "deliver", "Delivers", ["Resend email to inbox", "web: / · /archive · /shows", "every item links to sources"])
box("read", 0, 6, "human", "Reads the Monday brief", ["book guests on media rounds", "ride or counter topics", "build the sponsor pitch list"])

# ---------- arrows ----------
L, R = BW / 2, BW / 2
T, B = BH / 2, BH / 2
cx, cy = boxes["cfg"]; rx, ry = boxes["rss"]
arrow(f"M{cx + R},{cy} H{rx + 40} V{ry - T}", "10 shows", (cx + R + 70, cy))
cx, cy = boxes["cron"]
arrow(f"M{cx + R},{cy} H{rx - 40} V{ry - T}", "runs pipeline", (cx + R + 52, cy))
dx, dy = boxes["db"]
arrow(f"M{rx + R},{ry} H{dx} V{dy - T}", "new episodes", (rx + R + 58, ry))
ex, ey = boxes["ext"]
arrow(f"M{dx + 40},{dy + B} V{ey} H{ex - L}", "unprocessed only", (dx + 40, (dy + B + ey) / 2 + 6))
mx, my = boxes["math"]
arrow(f"M{ex + R},{ey} H{mx} V{my + B}", "validated JSON", (ex + R + 60, ey))
wx, wy = boxes["write"]
arrow(f"M{mx + R},{my} H{wx} V{wy - T}", "analysis + ref ids", (mx + R + 60, my))
nx, ny = boxes["render"]
arrow(f"M{wx + R},{wy} H{nx - 60} V{ny + B}", "prose by ref", (nx - 60, (wy + ny) / 2 + 10))
vx, vy = boxes["deliver"]
arrow(f"M{nx},{ny + B} V{vy - T}", "HTML brief", (nx + 20, (ny + vy) / 2))
ax, ay = boxes["read"]
arrow(f"M{vx + R},{vy} H{TABLE_R + 22} V{ay} H{ax + R + 3}", "by 6:00 AM IST", (TABLE_R + 22, (ay + vy) / 2), rotate=True)
arrow(f"M{dx + R},{dy} H{mx} V{my - T}", "35-day window", ((dx + R + mx) / 2, dy))

svg += parts

# ---------- legend ----------
legend = [
    ("Code does the maths", TONE["code"]),
    ("Gemini Flash does the language", TONE["ai"]),
    ("Postgres remembers", TONE["store"]),
    ("Live RSS, no scraping", TONE["data"]),
    ("Aditya acts on it", TONE["human"]),
    ("Every claim links to a source episode", TONE["deliver"]),
]
widths = [34 + len(t) * 6.6 for t, _ in legend]
gap = 12
x = (W - (sum(widths) + gap * (len(widths) - 1))) / 2
for (t, tone), w in zip(legend, widths):
    svg.append(f'<rect x="{x}" y="974" width="{w}" height="28" rx="14" fill="{tone}" fill-opacity="{.1 if THEME == 'dark' else .07}" stroke="{tone}" stroke-opacity="{.3 if THEME == 'dark' else .28}"/>')
    svg.append(f'<circle cx="{x + 15}" cy="988" r="3" fill="{tone}"/>')
    svg.append(f'<text x="{x + 25}" y="992" font-size="12" font-weight="500" fill="{TEXT_2}">{escape(t)}</text>')
    x += w + gap
svg.append(
    f'<text x="{W / 2}" y="1030" text-anchor="middle" font-size="11.5" fill="{FAINT}">'
    "Next.js 16 on Vercel · Neon Postgres · Google Gemini Flash (@google/genai) · Resend · Vercel Cron</text>"
)
svg.append("</svg>")
open(OUT, "w").write("\n".join(svg))
print("wrote", OUT)
