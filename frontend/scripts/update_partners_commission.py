from pathlib import Path
path = Path(__file__).resolve().parent.parent / 'frontend' / 'src' / 'pages' / 'PartnersPage.tsx'
text = path.read_text(encoding='utf-8')
start_marker = "    <div style={{ display: 'grid', gap: '10px', marginTop: '8px' }}>"
end_marker = "  </div>\n);"
start = text.find(start_marker)
if start == -1:
    raise RuntimeError('start marker not found')
end = text.find(end_marker, start)
if end == -1:
    raise RuntimeError('end marker not found')
end = end + len(end_marker)
new_block = """    <div style={{ display: 'grid', gap: '10px', marginTop: '8px' }}>
      {partnerTiers.map(({ id, name, packs, referrals, sub, hint }) => (
        <div key={id} style={commRowStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--glass-text)' }}>{name}</div>
            <div style={{ fontSize: '11px', color: 'var(--cg-text-muted)' }}>{hint}</div>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
            <CommCell label="Паки" val={packs} />
            <CommCell label="Рефсылка" val={referrals} />
            <CommCell label="Подписки" val={sub} />
          </div>
        </div>
      ))}
    </div>"""
text = text[:start] + new_block + text[end:]
path.write_text(text, encoding='utf-8')
print('updated')
