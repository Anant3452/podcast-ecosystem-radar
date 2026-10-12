"""Generate docs/components_map.svg as a swimlane components map."""
import sys
from html import escape

OUT = sys.argv[1]
W, H = 1800, 1060
X0, ACTOR_W, COL_W = 50, 170, 218
TABLE_R = X0 + ACTOR_W + 7 * COL_W  # 1746
HDR_Y, HDR_H = 170, 50
ROW_Y0, ROW_H = HDR_Y + HDR_H, 104
FONT = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

COLS = ["Trigger", "Input", "Context", "AI · Extract", "Processing", "AI · Write", "Output"]
ROWS = [  # name, subtitle, band colour
    ("Aditya", "Podcast host", "#ece6f8"),
    ("Vercel Cron", "Scheduler + admin", "#e2eaf7"),
    ("RSS Feeds", "Live data", "#e6efe0"),
    ("Postgres", "Neon · memory", "#e0ecee"),
    ("Code", "Next.js server", "#fbecd9"),
    ("Gemini API", "Flash · language", "#f8e0e5"),
    ("Delivery", "Resend + web UI", "#f5eed6"),
]
# stroke / fill per box kind
KIND = {
    "human": ("#7c5cc4", "#f4f0fc"),
    "trigger": ("#4a72b8", "#eef3fb"),
    "data": ("#5f8a4e", "#f1f7ed"),
    "store": ("#4d8790", "#eef6f7"),
    "code": ("#c98a2b", "#fff6ea"),
    "ai": ("#c4526b", "#fdf0f3"),
    "deliver": ("#b08a1e", "#fdf8e8"),
}

def col_cx(c): return X0 + ACTOR_W + c * COL_W + COL_W / 2
def row_cy(r): return ROW_Y0 + r * ROW_H + ROW_H / 2

BW, BH = 198, 88
boxes = {}  # id -> (cx, cy)
parts = []

def box(bid, r, c, kind, title, lines):
    cx, cy = col_cx(c), row_cy(r)
    boxes[bid] = (cx, cy)
    stroke, fill = KIND[kind]
    x, y = cx - BW / 2, cy - BH / 2
    parts.append(f'<rect x="{x}" y="{y}" width="{BW}" height="{BH}" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')
    ty = y + 21
    parts.append(f'<text x="{cx}" y="{ty}" text-anchor="middle" font-size="13" font-weight="700" fill="#2b2420">{escape(title)}</text>')
    for i, ln in enumerate(lines):
        parts.append(f'<text x="{cx}" y="{ty + 17 + i * 15}" text-anchor="middle" font-size="10.5" fill="#5a5048">{escape(ln)}</text>')

def pill(x, y, text, rotate=False):
    w = 7 + len(text) * 5.9
    tr = f' transform="rotate(-90 {x} {y})"' if rotate else ""
    parts.append(
        f'<g{tr}><rect x="{x - w / 2}" y="{y - 10}" width="{w}" height="20" rx="10" fill="#ffffff" stroke="#c9bfb2"/>'
        f'<text x="{x}" y="{y + 3.6}" text-anchor="middle" font-size="10" fill="#5a5048">{escape(text)}</text></g>'
    )

def arrow(d, label=None, at=None, rotate=False):
    parts.append(f'<path d="{d}" fill="none" stroke="#6e6258" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#ah)"/>')
    if label:
        pill(*at, label, rotate)

# ---------- frame ----------
svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{FONT}">',
    '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
    '<path d="M0,0 L10,5 L0,10 z" fill="#6e6258"/></marker></defs>',
    f'<rect width="{W}" height="{H}" fill="#f3efe9"/>',
    f'<rect x="20" y="20" width="{W - 40}" height="{H - 40}" rx="18" fill="#fbf9f5" stroke="#e4ddd2"/>',
    f'<text x="{W / 2}" y="86" text-anchor="middle" font-size="31" font-weight="800" fill="#2b2420">Podcast Ecosystem Radar · Components Map</text>',
    f'<text x="{W / 2}" y="120" text-anchor="middle" font-size="15" fill="#6e6258">'
    '10 live RSS feeds → Gemini extracts facts → code finds overlaps → Gemini writes → brief in the inbox by 6:00 AM IST Monday</text>',
]

# header row
svg.append(f'<rect x="{X0}" y="{HDR_Y}" width="{TABLE_R - X0}" height="{HDR_H}" rx="8" fill="#6b5b4d"/>')
svg.append(f'<text x="{X0 + ACTOR_W / 2}" y="{HDR_Y + 31}" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">Actor</text>')
for c, name in enumerate(COLS):
    svg.append(f'<text x="{col_cx(c)}" y="{HDR_Y + 31}" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">{escape(name)}</text>')

# bands + actor cells
for r, (name, sub, band) in enumerate(ROWS):
    y = ROW_Y0 + r * ROW_H
    svg.append(f'<rect x="{X0 + ACTOR_W}" y="{y}" width="{TABLE_R - X0 - ACTOR_W}" height="{ROW_H}" fill="{band}"/>')
    svg.append(f'<rect x="{X0}" y="{y}" width="{ACTOR_W}" height="{ROW_H}" fill="#7d6c5d"/>')
    svg.append(f'<line x1="{X0}" y1="{y + ROW_H}" x2="{TABLE_R}" y2="{y + ROW_H}" stroke="#fbf9f5" stroke-width="2"/>')
    svg.append(f'<text x="{X0 + ACTOR_W / 2}" y="{y + ROW_H / 2 - 2}" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">{escape(name)}</text>')
    svg.append(f'<text x="{X0 + ACTOR_W / 2}" y="{y + ROW_H / 2 + 17}" text-anchor="middle" font-size="11" fill="#e8dfd4">({escape(sub)})</text>')
# faint column guides
for c in range(1, 7):
    x = X0 + ACTOR_W + c * COL_W
    svg.append(f'<line x1="{x}" y1="{ROW_Y0}" x2="{x}" y2="{ROW_Y0 + 7 * ROW_H}" stroke="#ffffff" stroke-opacity=".55"/>')
svg.append(f'<rect x="{X0}" y="{HDR_Y}" width="{TABLE_R - X0}" height="{HDR_H + 7 * ROW_H}" rx="8" fill="none" stroke="#6b5b4d" stroke-width="2"/>')

# ---------- boxes ----------
box("cfg", 0, 0, "human", "Edits config (no code)", ["config/shows.json · 10 shows", "enabled · self_brands", "settings.json · 30d / 7d windows"])
box("cron", 1, 0, "trigger", "Cron fires", ["Mon 00:30 UTC = 06:00 IST", "daily ingest at 00:00 IST", "/admin “Run now” · ADMIN_SECRET"])
box("rss", 2, 1, "data", "Fetches 10 feeds", ["rss-parser · Zod-validated", "last 35 days · dedupe by guid", "title · notes · link · transcript"])
box("db", 3, 2, "store", "Stores everything", ["shows · episodes · topic_canon", "briefs by week · runs log", "idempotent: skips processed"])
box("ext", 5, 3, "ai", "Extracts facts", ["guests · 2–5 topics · brands", "JSON schema · empty > guess", "5 episodes/call · retry+backoff"])
box("math", 4, 4, "code", "Code does the maths", ["names merged: Levenshtein ≤ 2", "guests on ≥ 2 shows · 30 days", "topics ≥ 2 shows · 7d · paid brands"])
box("write", 5, 5, "ai", "Merges topics, writes brief", ["1 call: canonical topic map", "3-line summary + actions", "cites items by ref id only"])
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
    ("Code does the maths", "#fff6ea", "#c98a2b"),
    ("Gemini Flash does the language", "#fdf0f3", "#c4526b"),
    ("Postgres remembers", "#eef6f7", "#4d8790"),
    ("Live RSS, no scraping", "#f1f7ed", "#5f8a4e"),
    ("Aditya acts on it", "#f4f0fc", "#7c5cc4"),
    ("Every claim links to a source episode", "#fdf8e8", "#b08a1e"),
]
widths = [24 + len(t) * 7.1 for t, _, _ in legend]
gap = 14
x = (W - (sum(widths) + gap * (len(widths) - 1))) / 2
for (t, fill, stroke), w in zip(legend, widths):
    svg.append(f'<rect x="{x}" y="972" width="{w}" height="28" rx="14" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
    svg.append(f'<text x="{x + w / 2}" y="990.5" text-anchor="middle" font-size="12.5" font-weight="600" fill="{stroke}">{escape(t)}</text>')
    x += w + gap
svg.append(
    f'<text x="{W / 2}" y="1025" text-anchor="middle" font-size="12" fill="#8a7e72">'
    "Stack: Next.js 16 on Vercel · Neon Postgres · Google Gemini Flash (@google/genai) · Resend · Vercel Cron</text>"
)
svg.append("</svg>")
open(OUT, "w").write("\n".join(svg))
print("wrote", OUT)
