# Synthetic, non-sensitive test assets; run on desktop only.
from PIL import Image, ImageDraw
from pathlib import Path
import hashlib, json
out = Path(__file__).resolve().parents[1] / 'tests/fixtures/images'
out.mkdir(parents=True, exist_ok=True)
for orientation in range(1, 9):
    image = Image.new('RGB', (120, 80))
    draw = ImageDraw.Draw(image)
    for box, color in [((0,0,59,39),'red'),((60,0,119,39),'lime'),((0,40,59,79),'blue'),((60,40,119,79),'yellow')]:
        draw.rectangle(box, fill=color)
    exif = Image.Exif(); exif[274] = orientation
    image.save(out / f'exif-{orientation}.jpg', quality=95, subsampling=0, exif=exif)
for width, height in [(4000,3000),(8000,6000)]:
    image = Image.new('RGB', (width,height), '#20a070')
    ImageDraw.Draw(image).rectangle((0,0,width//2,height//2), fill='#c05030')
    image.save(out / f'{width*height//1000000}mp.jpg', quality=85)
image = Image.new('RGBA', (32,24), (20,180,80,128)); image.save(out / 'alpha.png')
entries = [{'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(out.iterdir())]
(out.parent / 'image-manifest.json').write_text(json.dumps({'generator':'scripts/generate-image-fixtures.py','library':'Pillow 12.3.0','provenance':'Original synthetic quadrants/solid colors; no personal data. Generated on Linux desktop; never generated in mobile browser.','files':entries},indent=2)+'\n')
