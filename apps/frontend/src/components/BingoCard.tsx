import type { BingoCard as BingoCardType } from '@babi-bingo/shared';

const COL_COLORS: Record<number, string> = {
  0: 'text-B',
  1: 'text-I',
  2: 'text-N',
  3: 'text-G',
  4: 'text-O',
};

const COL_BG: Record<number, string> = {
  0: 'bg-B/20 border-B/40',
  1: 'bg-I/20 border-I/40',
  2: 'bg-N/20 border-N/40',
  3: 'bg-G/20 border-G/40',
  4: 'bg-O/20 border-O/40',
};

interface Props {
  card: BingoCardType;
  calledNumbers: number[];
}

export default function BingoCard({ card, calledNumbers }: Props) {
  const called = new Set(calledNumbers);
  const HEADERS = ['B', 'I', 'N', 'G', 'O'];

  return (
    <div className="w-full max-w-sm mx-auto select-none">
      {/* Column headers */}
      <div className="grid grid-cols-5 gap-1 mb-1">
        {HEADERS.map((h, i) => (
          <div key={h} className={`text-center font-black text-xl py-2 ${COL_COLORS[i]}`}>{h}</div>
        ))}
      </div>

      {/* 5×5 grid */}
      <div className="grid grid-cols-5 gap-1">
        {card.map((row, ri) =>
          row.map((cell, ci) => {
            const isMarked = cell === null || called.has(cell);
            const isFree = cell === null;

            return (
              <div
                key={`${ri}-${ci}`}
                className={`
                  aspect-square flex items-center justify-center rounded-lg border
                  text-lg font-bold transition-all duration-300
                  ${isMarked
                    ? `${COL_BG[ci]} ${COL_COLORS[ci]} scale-95`
                    : 'bg-surface border-border text-white/70'
                  }
                  ${isFree ? 'bg-gold/20 border-gold/50 text-gold' : ''}
                `}
              >
                {isFree ? '★' : cell}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
