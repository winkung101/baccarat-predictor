import { cn } from "@/lib/utils";

interface ScoreBoardProps {
  history: ("P" | "B" | "T")[];
}

export const ScoreBoard = ({ history }: ScoreBoardProps) => {
  const rows = 6;
  
  // ปรับแก้: เพิ่มจำนวนคอลัมน์ขั้นต่ำเป็น 30 (จากเดิม 12) 
  // และให้ขยายตาม history.length เพื่อรองรับเกมยาวๆ ไม่ให้ตารางสั้นเกินไป
  const cols = Math.max(30, history.length + 10);

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
        // Move right if can't go down (Dragon tail)
        currentCol++;
        // Note: In simple logic, we reset row to 0, or stick to bottom for dragon.
        // For consistency with original code style but allowing width expansion:
        currentRow = 0; 
      }
    } else {
      // Different result - new column
      currentCol++;
      currentRow = 0;
      lastResult = result;
    }

    // Protection against overflow (though cols should be enough now)
    if (currentCol < cols) {
      grid[currentRow][currentCol] = result;
    }
  });

  return (
    <div className="bg-secondary/50 rounded-lg p-3 sm:p-4 border border-border/50">
      <h3 className="text-gold font-serif text-lg sm:text-xl mb-3 text-center">Scoreboard</h3>
      
      {/* Container with horizontal scroll */}
      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
        <div
          className="grid gap-1 min-w-max"
          style={{
            // Use fixed pixel width for cells to ensure consistent look
            gridTemplateColumns: `repeat(${cols}, 28px)`,
            gridTemplateRows: `repeat(${rows}, 28px)`,
          }}
        >
          {grid.flat().map((cell, index) => (
            <div
              key={index}
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border border-white/5",
                cell === "P" && "bg-player text-player-foreground shadow-sm shadow-player/50",
                cell === "B" && "bg-banker text-banker-foreground shadow-sm shadow-banker/50",
                cell === "T" && "bg-tie text-tie-foreground shadow-sm shadow-tie/50",
                !cell && "bg-white/5"
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