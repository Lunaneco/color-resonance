"""Package generated inventory art; only crop, resize and encode the originals."""
import hashlib
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/inventory"
SOURCE = ROOT / "art-source/inventory"
catalog = json.loads((OUT / "prompts.json").read_text())["prompts"]
assert len(catalog) == 54 and len({entry["id"] for entry in catalog}) == 54
report = {"count": len(catalog), "size": [256, 256], "assets": {}}
sheet = Image.new("RGB", (7 * 180, 8 * 204), "#142331")
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 12) if Path("/System/Library/Fonts/Supplemental/Arial.ttf").exists() else ImageFont.load_default()
for index, entry in enumerate(catalog):
    key = entry["id"]
    src = SOURCE / (key + ".png")
    with Image.open(src) as original:
        image = original.convert("RGBA")
    assert image.getchannel("A").getextrema() == (0, 255), f"Missing transparency: {key}"
    bbox = image.getchannel("A").point(lambda value: 255 if value > 16 else 0).getbbox()
    assert bbox, f"Empty image: {key}"
    thumb = ImageOps.contain(image.crop(bbox), (224, 224), Image.Resampling.LANCZOS)
    icon = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    icon.paste(thumb, ((256 - thumb.width) // 2, (256 - thumb.height) // 2))
    final = OUT / (key + ".webp")
    icon.save(final, "WEBP", quality=90, method=6)
    with Image.open(final) as delivered:
        assert delivered.size == (256, 256) and delivered.convert("RGBA").getchannel("A").getextrema() == (0, 255)
    report["assets"][key] = {"file": final.name, "source": "art-source/inventory/" + src.name, "sourceSize": list(image.size), "crop": list(bbox), "alpha": [0, 255], "bytes": final.stat().st_size, "sha256": hashlib.sha256(final.read_bytes()).hexdigest()}
    x, y = (index % 7) * 180, (index // 7) * 204
    draw.rounded_rectangle((x + 5, y + 5, x + 175, y + 199), radius=12, fill="#1b3040", outline="#bca471" if entry.get("unique") else "#425f71")
    preview = icon.resize((156, 156), Image.Resampling.LANCZOS)
    sheet.paste(preview, (x + 12, y + 13), preview)
    draw.text((x + 90, y + 179), key, font=font, fill="#e7e1cc", anchor="mm")
report["deliveryBytes"] = sum(asset["bytes"] for asset in report["assets"].values())
(OUT / "quality.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
sheet.save(OUT / "contact-sheet.webp", "WEBP", quality=92, method=6)
groups = [("equipment", "旅をともにする装備", "43種類 · 刻印 / 衣 / お守り"), ("item", "戦場で使う道具", "5種類 · 回復 / 共鳴 / 色 / 守り"), ("material", "技を磨く結晶", "6種類 · 集めてスキルを強化")]
sections = []
slot_names = {"blade": "刻印", "cloth": "衣", "charm": "お守り"}
for kind, title, subtitle in groups:
    cards = []
    for entry in catalog:
        if entry["kind"] != kind:
            continue
        key = entry["id"]
        label = "ユニーク · " + slot_names[entry["slot"]] if entry.get("unique") else slot_names.get(entry.get("slot"), "消耗品" if kind == "item" else "強化素材")
        description = entry.get("lore") or entry.get("desc") or "アリアの旅を支える装備。"
        cards.append(f'<article class="card {"rare" if entry.get("unique") else ""}" data-id="{key}"><div class="picture"><img src="{key}.webp" width="256" height="256" alt="{html.escape(entry["name"])}" loading="lazy" decoding="async"></div><small>{label}</small><h3>{html.escape(entry["name"])}</h3><p>{html.escape(description)}</p><a href="{key}.webp" download>{key} ↗</a></article>')
    sections.append(f'<section id="{kind}"><div class="section-head"><h2>{title}</h2><span>{subtitle}</span></div><div class="grid">{"".join(cards)}</div></section>')
gallery = '''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>装備と道具の画集 — いろの共鳴</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#101c29;color:#eee7d5;font-family:system-ui,sans-serif;line-height:1.7}body:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 10% 5%,#35747c25,transparent 55%),radial-gradient(ellipse at 90% 55%,#694c7320,transparent 60%)}main{position:relative;max-width:1320px;margin:auto;padding:50px 28px 70px}header{padding:28px 0 45px;border-bottom:1px solid #baa37444}.eyebrow{font-size:12px;letter-spacing:.24em;color:#9eccc9}h1,h2,h3{font-family:serif;font-weight:500}h1{font-size:clamp(28px,4vw,48px);letter-spacing:.12em;margin:12px 0}header p{color:#b8c5ca;max-width:620px;margin:15px 0 25px}nav{display:flex;flex-wrap:wrap;gap:12px}nav a{color:#e7dbc0;text-decoration:none;border:1px solid #acac7955;border-radius:22px;padding:8px 18px;min-height:44px}nav a:hover{background:#c8b47122}a:focus-visible{outline:2px solid #a5e4de;outline-offset:4px}section{padding-top:35px}.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:20px}.section-head h2{font-size:24px;margin:0}.section-head span{font-size:12px;color:#9ab5bd}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px}.card{display:flex;flex-direction:column;padding:17px;border:1px solid #6e8d9b44;border-radius:10px 28px 10px 28px;background:linear-gradient(155deg,#29405155,#15263399)}.card.rare{border-color:#c7ad6b66}.picture{display:flex;justify-content:center;align-items:center;height:176px;border-radius:16px;background:radial-gradient(ellipse,#5c8b9344,transparent 68%);margin-bottom:16px}.picture img{width:176px;height:176px;object-fit:contain;filter:drop-shadow(0 9px 8px #02091170)}.card small{font-size:11px;color:#94c7c6;letter-spacing:.08em}.rare small{color:#d7c389}.card h3{font-size:17px;margin:6px 0 9px}.card p{font-size:12px;color:#bdcbd1;margin:0 0 14px}.card>a{font:10px system-ui;color:#8eabb5;margin-top:auto;overflow-wrap:anywhere;min-height:32px;display:flex;align-items:center}footer{padding-top:40px;margin-top:40px;border-top:1px solid #baa37433;font-size:12px;color:#91aab7}footer a{color:#bad7d7}@media(max-width:480px){main{padding:28px 16px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.card{padding:12px}.picture{height:120px}.picture img{width:120px;height:120px;max-width:100%}.card h3{font-size:14px}.section-head{align-items:start;flex-direction:column;gap:5px}.card p{font-size:11px}}
</style></head><body><main><header><span class="eyebrow">COLOR RESONANCE · INVENTORY ART</span><h1>装備と道具の画集</h1><p>旅の記憶を宿す装備、戦場で手にする道具、技を磨く結晶。いろの共鳴に登場する54種類を、それぞれ一枚の絵にしました。</p><nav><a href="../../?v=20261005-restoration1">ゲームを開く</a><a href="#equipment">装備</a><a href="#item">道具</a><a href="#material">強化素材</a></nav></header>''' + "".join(sections) + '''<footer>生成画像を透過WebPに整え、ゲームの装備・お店・戦闘・スキル強化・報酬で使用しています。<a href="contact-sheet.webp">一覧画像</a> · <a href="prompts.json">生成プロンプト</a></footer></main></body></html>'''
(OUT / "index.html").write_text(gallery + "\n")
print(json.dumps({"count": report["count"], "deliveryBytes": report["deliveryBytes"]}))
