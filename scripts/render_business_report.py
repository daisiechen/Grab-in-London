"""Create a PDF report and a standalone HTML reading copy."""
from pathlib import Path
import html
import re
import os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'outputs/business-2026-10-17'
OUT.mkdir(parents=True, exist_ok=True)
source = ROOT/'docs/business/business-assessment.zh-CN.md'

def plain(s):
    return re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 (\2)', s).replace('**','')

def rich_html(s):
    s=re.sub(r'\]\(([^):]+\.?(?:/[^)]*)?)\)',lambda m:']('+os.path.relpath((source.parent/m[1]).resolve(),OUT)+')' if not m[1].startswith('http') else m[0],s)
    s = html.escape(s)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', s)
    return re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',s)

lines=source.read_text().splitlines(); chunks=[]; i=0
while i<len(lines):
    line=lines[i]
    if not line.strip(): i+=1; continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].startswith('|'):
            cells=[c.strip() for c in lines[i].strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?',c) for c in cells): rows.append(cells)
            i+=1
        chunks.append('<div class="table"><table>'+''.join('<tr>'+''.join(f'<{"th" if k==0 else "td"}>{rich_html(c)}</{"th" if k==0 else "td"}>' for c in r)+'</tr>' for k,r in enumerate(rows))+'</table></div>')
        continue
    if line.startswith('#'):
        level=len(line)-len(line.lstrip('#'));text=line[level:].strip()
        chunks.append(f'<h{level}>{rich_html(text)}</h{level}>')
    elif line.startswith('- '):
        chunks.append('<p>• '+rich_html(line[2:])+'</p>')
    else:
        text=line.removeprefix('> ')
        chunks.append('<p>'+rich_html(text)+'</p>')
    i+=1
css='''body{font:17px/1.85 "PingFang SC",sans-serif;background:#f8f5ed;color:#203d34;margin:0}main{max-width:1060px;margin:auto;padding:54px 40px}h1{font-size:36px;line-height:1.4}h2{margin-top:56px;font-size:27px}h3{margin-top:32px;font-size:21px}a{color:#166a54;overflow-wrap:anywhere}.table{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:15px;margin:24px 0}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #cdd6ca}th{background:#153f35;color:white}th a{color:white}button{background:#153f35;color:white;border:0;padding:12px 24px;font-size:16px;cursor:pointer}@media print{body{background:white;font-size:11pt}main{padding:0}button{display:none}h2,h3{break-after:avoid}tr{break-inside:avoid}}'''
(OUT/'business-report.zh-CN.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fancy 商业模式评估与设计报告</title><style>'+css+'</style><main><button onclick="window.print()">打印或保存 PDF</button>'+''.join(chunks)+'</main></html>')
print('Created HTML reading copy')

pdfmetrics.registerFont(TTFont('Chinese','/System/Library/Fonts/Supplemental/Arial Unicode.ttf'))
styles=getSampleStyleSheet()
for n in ('Normal','Title','Heading1','Heading2','Heading3'):
    styles[n].fontName='Chinese'; styles[n].wordWrap='CJK'
    if n!='Normal': styles[n].keepWithNext=True
styles['Normal'].fontSize=10;styles['Normal'].leading=16;styles['Normal'].spaceAfter=7
styles['Title'].fontSize=23;styles['Title'].leading=31
styles['Heading1'].fontSize=17;styles['Heading1'].leading=24
styles['Heading2'].fontSize=13;styles['Heading2'].leading=20
cellstyle=ParagraphStyle('Cell',parent=styles['Normal'],fontSize=8,leading=12,spaceAfter=2)
def pdftext(s):
    return html.escape(plain(s))
story=[];i=0
while i<len(lines):
    line=lines[i]
    if not line.strip():i+=1;continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].startswith('|'):
            cells=[c.strip() for c in lines[i].strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?',c) for c in cells):rows.append([Paragraph(pdftext(c),cellstyle) for c in cells])
            i+=1
        width=451
        widths=[45,210,196] if len(rows[0])==3 and '编号' in plain(lines[i-len(rows)-1]) else [width/len(rows[0])]*len(rows[0])
        t=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#DFE8DC')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.3,colors.HexColor('#CDD6CA')),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
        story.extend([t,Spacer(1,10)]);continue
    if line.startswith('#'):
        level=len(line)-len(line.lstrip('#'))
        story.append(Paragraph(pdftext(line[level:].strip()),styles['Title' if level==1 else 'Heading'+str(level-1)]))
    else:story.append(Paragraph(pdftext(line.removeprefix('> ')),styles['Normal']))
    i+=1
SimpleDocTemplate(str(OUT/'business-report.zh-CN.pdf'),pagesize=(595,842),leftMargin=72,rightMargin=72,topMargin=48,bottomMargin=48,title='Fancy 商业模式评估与设计报告',author='').build(story)
print('Created PDF with embedded Chinese font')
