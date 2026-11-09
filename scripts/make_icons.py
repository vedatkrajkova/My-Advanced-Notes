"""Gjeneron ikonat PNG të aplikacionit pa varësi të jashtme (vetëm zlib)."""
import math, struct, sys, zlib
from pathlib import Path

BLUE = (47, 111, 237)
WHITE = (255, 255, 255)

def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

def render(size, full_bleed):
    radius = 0 if full_bleed else size * 0.22
    scale = 0.62 if full_bleed else 0.78  # ikona maskable mban përmbajtjen në zonën e sigurt
    # Shenja ✓ në koordinata 0..1, e qendërzuar.
    pts = [(0.27, 0.53), (0.43, 0.68), (0.74, 0.36)]
    pts = [((x - 0.5) * scale / 0.78 + 0.5, (y - 0.5) * scale / 0.78 + 0.5) for x, y in pts]
    pts = [(x * size, y * size) for x, y in pts]
    stroke = size * 0.075 * scale / 0.78
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            cx, cy = x + 0.5, y + 0.5
            # Katror me kënde të rrumbullakëta.
            qx = max(abs(cx - size / 2) - (size / 2 - radius), 0)
            qy = max(abs(cy - size / 2) - (size / 2 - radius), 0)
            inside = math.hypot(qx, qy) - radius
            alpha = max(0.0, min(1.0, 0.5 - inside)) if radius else 1.0
            d = min(seg_dist(cx, cy, *pts[0], *pts[1]), seg_dist(cx, cy, *pts[1], *pts[2]))
            mark = max(0.0, min(1.0, stroke / 2 + 0.5 - d))
            r, g, b = (round(BLUE[i] * (1 - mark) + WHITE[i] * mark) for i in range(3))
            row += bytes((r, g, b, round(alpha * 255)))
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

out = Path(sys.argv[1])
for name, size, bleed in [('icon-192.png', 192, False), ('icon-512.png', 512, False),
                          ('maskable-512.png', 512, True), ('apple-touch-icon.png', 180, True)]:
    (out / name).write_bytes(render(size, bleed))
    print('wrote', name)
