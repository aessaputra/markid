"""Fixture-only structural evidence; not an application container parser."""
from pathlib import Path
import hashlib,json,struct
from PIL import Image
root=Path(__file__).resolve().parents[1]/'tests/fixtures/codecs'
manifest=json.loads((root/'manifest.json').read_text())
for entry in manifest:
    assert hashlib.sha256((root/entry['file']).read_bytes()).hexdigest()==entry['sha256']
for ext in ['avif','heif']:
    for name in ['rotate','mirror']:
        b=(root/f'{name}.{ext}').read_bytes(); properties=[]; associations=[]
        def walk(start,end):
            o=start
            while o<end:
                n,t=struct.unpack_from('>I4s',b,o); assert n>=8 and o+n<=end
                p=o+8
                if t==b'meta': walk(p+4,o+n)
                elif t in [b'iprp',b'ipco']: walk(p,o+n)
                elif t in [b'ispe',b'irot',b'imir',b'hvcC',b'av1C',b'pixi',b'colr',b'clap']: properties.append((t,b[p:o+n]))
                elif t==b'ipma':
                    assert b[p]==0 and b[p+3]==0
                    q=p+8
                    for _ in range(int.from_bytes(b[p+4:p+8],'big')):
                        item=int.from_bytes(b[q:q+2],'big'); count=b[q+2];q+=3
                        associations.extend((item,x&127) for x in b[q:q+count]);q+=count
                o+=n
            assert o==end
        walk(0,len(b))
        dims=[struct.unpack('>II',d[4:12]) for t,d in properties if t==b'ispe'];assert (320,240) in dims
        t=b'irot' if name=='rotate' else b'imir'
        indexes=[i+1 for i,(type_,d) in enumerate(properties) if type_==t and d== (b'\x03' if name=='rotate' else b'\x01')]
        assert indexes and any(i in indexes for item,i in associations)
        print(f'{name}.{ext}: coded ispe=320x240, {t.decode()} associated, payload={[d.hex() for typ,d in properties if typ==t]}')
for name,o in [('rotate',6),('mirror',2)]:
    p=root/f'{name}.webp'
    with Image.open(p) as im: assert im.size==(320,240) and im.getexif()[274]==o
    print(f'{name}.webp: encoded=320x240 TIFF EXIF orientation={o}')
print(f'{len(manifest)} fixture SHA256 hashes verified')
