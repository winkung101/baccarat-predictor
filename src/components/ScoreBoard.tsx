import { cn } from "@/lib/utils";

interface ScoreBoardProps {
  history: ("P" | "B" | "T")[];
}

export const ScoreBoard = ({ history }: ScoreBoardProps) => {
  const rows = 6;
  const cols = Math.max(12, Math.ceil(history.length / rows) + 2);

  // Create grid layout - Big Road style
  const grid: (string | null)[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(null));

  let currentCol = 0;
  let currentRow = 0;
  let lastResult: string | null = null;

  history.forEach((result, index) => {
    if (index === 0) {
      grid[0][0] = result;
      lastResult = result;
      return;
    }

    if (result === lastResult || result === "T") {
      // Same result or Tie - go down
      if (currentRow < rows - 1 && !grid[currentRow + 1][currentCol]) {
        currentRow++;
      } else {
        // Move right if can't go down
        currentCol++;
        currentRow = 0;
      }
    } else {
      // Different result - new column
      currentCol++;
      currentRow = 0;
      lastResult = result;
    }

    grid[currentRow][currentCol] = result;
  });

  return (
    <div className="bg-secondary/50 rounded-lg p-3 sm:p-4 border border-border/50">
      <h3 className="text-gold font-serif text-lg sm:text-xl mb-3 text-center">Scoreboard</h3>
      <div className="overflow-x-auto">
        <div
          className="grid gap-1 min-w-max"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(24px, 1fr))`,
            gridTemplateRows: `repeat(${rows}, 24px)`,
          }}
        >
          {grid.flat().map((cell, index) => (
            <div
              key={index}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                cell === "P" && "bg-player text-player-foreground",
                cell === "B" && "bg-banker text-banker-foreground",
                cell === "T" && "bg-tie text-tie-foreground",
                !cell && "bg-muted/30"
              )}
            >
              {cell}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
