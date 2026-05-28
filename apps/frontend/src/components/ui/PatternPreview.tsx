/** 5×5 bingo card preview that lights up to show a win pattern */

type WinPattern = 'ROW' | 'COLUMN' | 'DIAGONAL' | 'FOUR_CORNERS' | 'POSTAGE_STAMP' | 'COVERALL';

const COLS = ['B','I','N','G','O'];
const COL_COLOR: Record<string, string> = { B:'#60a5fa', I:'#a78bfa', N:'#fbbf24', G:'#34d399', O:'#f87171' };

function getHighlightedCells(pattern: WinPattern): Set<number> {
  const cells = new Set<number>();
  switch (pattern) {
    case 'ROW':          for (let c=0;c<5;c++) cells.add(1*5+c); break; // row 1
    case 'COLUMN':       for (let r=0;r<5;r++) cells.add(r*5+0); break; // col B
    case 'DIAGONAL':     for (let i=0;i<5;i++) { cells.add(i*5+i); cells.add(i*5+(4-i)); } break;
    case 'FOUR_CORNERS': [0,4,20,24].forEach(c=>cells.add(c)); break;
    case 'POSTAGE_STAMP':[[0,0],[0,1],[1,0],[1,1]].forEach(([r,c])=>cells.add(r*5+c)); break;
    case 'COVERALL':     for (let i=0;i<25;i++) cells.add(i); break;
  }
  return cells;
}

export default function PatternPreview({ pattern, size = 'md' }: { pattern: WinPattern; size?: 'sm' | 'md' }) {
  const highlighted = getHighlightedCells(pattern);
  const cellSize = size === 'sm' ? 22 : 32;
  const gap = size === 'sm' ? 3 : 4;

  return (
    <div>
      {/* Column headers */}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(5,${cellSize}px)`, gap, marginBottom: gap }}>
        {COLS.map((c) => (
          <div key={c} style={{ width:cellSize, height:cellSize, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: size === 'sm' ? 9 : 11, fontWeight:800, color: COL_COLOR[c], fontFamily:'Outfit,sans-serif' }}>
            {c}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(5,${cellSize}px)`, gap }}>
        {Array.from({ length: 25 }, (_, i) => {
          const isOn = highlighted.has(i);
          const isFree = i === 12;
          const col = COLS[i % 5];
          return (
            <div key={i} style={{
              width: cellSize, height: cellSize, borderRadius: size === 'sm' ? 4 : 6,
              display: 'flex', alignItems:'center', justifyContent:'center',
              background: isFree ? 'var(--gold-dim)' : isOn ? `${COL_COLOR[col]}22` : 'var(--surface2)',
              border: `1px solid ${isFree ? 'var(--gold)' : isOn ? COL_COLOR[col] : 'var(--border)'}`,
              transition: '200ms',
            }}>
              {isFree && <span style={{ fontSize: size==='sm' ? 8 : 10 }}>★</span>}
              {isOn && !isFree && <div style={{ width:8,height:8,borderRadius:'50%', background: COL_COLOR[col], opacity:0.9 }}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
