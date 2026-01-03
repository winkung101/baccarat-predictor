import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { generateRoadMap, RoadColor } from "@/lib/roadmap";

interface ScoreBoardProps {
  history: ("P" | "B" | "T")[];
}

export const ScoreBoard = ({ history }: ScoreBoardProps) => {
  // คำนวณเค้าไพ่รอง (Derived Roads)
  const { bigEye, smallRoad, cockroach } = useMemo(() => generateRoadMap(history), [history]);

  // --- Big Road Logic (เหมือนเดิมแต่ปรับปรุงการแสดงผล) ---
  const rows = 6;
  const cols = Math.max(25, Math.ceil(history.length / 2) + 10);
  const grid: (string | null)[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));

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
      if (currentRow < rows - 1 && !grid[currentRow + 1][currentCol]) currentRow++;
      else { currentCol++; currentRow = 0; }
    } else {
      currentCol++; currentRow = 0; lastResult = result;
    }
    if (currentCol < cols) grid[currentRow][currentCol] = result;
  });

  // --- Component ย่อยสำหรับวาดตารางเค้าไพ่รอง ---
  const DerivedRoadGrid = ({ data, type, label }: { data: RoadColor[], type: "bigEye" | "small" | "cockroach", label: string }) => {
      // เค้าไพ่รองปกติจะสูง 6 ช่อง แต่อัดแน่น (ความสูงครึ่งนึงของตารางหลัก)
      // เราจะใช้วิธีแสดงผลแบบ Grid แนวนอนยาวๆ
      const dRows = 6;
      const dCols = Math.max(20, Math.ceil(data.length / dRows) + 5);
      
      // จัดเรียงข้อมูลลง Grid (แบบไล่ลงแล้วขึ้นใหม่)
      const dGrid = Array(dRows).fill(null).map(() => Array(dCols).fill(null));
      let c = 0, r = 0;
      data.forEach(color => {
          dGrid[r][c] = color;
          r++;
          if (r >= dRows) { r = 0; c++; }
      });

      return (
        <div className="flex-1 bg-black/20 rounded border border-white/5 p-2 min-w-[120px]">
           <div className="text-[10px] text-muted-foreground mb-1 font-sans font-bold uppercase tracking-wider flex items-center gap-1">
              {type === "bigEye" && <div className="w-2 h-2 rounded-full border border-white/50"></div>}
              {type === "small" && <div className="w-2 h-2 rounded-full bg-white/50"></div>}
              {type === "cockroach" && <div className="w-2 h-2 bg-white/50 rotate-45 h-[2px]"></div>}
              {label}
           </div>
           
           <div className="overflow-x-auto scrollbar-none">
             <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${dCols}, 8px)`, gridTemplateRows: `repeat(${dRows}, 8px)` }}>
                 {dGrid.flat().map((color, i) => (
                     <div key={i} className="w-[8px] h-[8px] flex items-center justify-center bg-white/5 border-[0.5px] border-white/5">
                         {/* Big Eye Boy: วงกลมโปร่ง */}
                         {type === "bigEye" && color === "red" && <div className="w-[6px] h-[6px] rounded-full border-[1.5px] border-red-500" />}
                         {type === "bigEye" && color === "blue" && <div className="w-[6px] h-[6px] rounded-full border-[1.5px] border-blue-500" />}
                         
                         {/* Small Road: วงกลมทึบ */}
                         {type === "small" && color === "red" && <div className="w-[6px] h-[6px] rounded-full bg-red-500" />}
                         {type === "small" && color === "blue" && <div className="w-[6px] h-[6px] rounded-full bg-blue-500" />}

                         {/* Cockroach: ขีดเฉียง */}
                         {type === "cockroach" && color === "red" && <div className="w-[6px] h-[1.5px] bg-red-500 -rotate-45" />}
                         {type === "cockroach" && color === "blue" && <div className="w-[6px] h-[1.5px] bg-blue-500 -rotate-45" />}
                     </div>
                 ))}
             </div>
           </div>
        </div>
      );
  };

  return (
    <div className="space-y-3">
        {/* Main Big Road */}
        <div className="bg-secondary/50 rounded-lg p-3 border border-border/50 shadow-inner">
            <h3 className="text-gold font-serif text-sm mb-2 text-center sm:text-left">Big Road (เค้าไพ่หลัก)</h3>
            <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
                <div className="grid gap-1 min-w-max" style={{ gridTemplateColumns: `repeat(${cols}, 28px)`, gridTemplateRows: `repeat(${rows}, 28px)` }}>
                {grid.flat().map((cell, index) => (
                    <div key={index} className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border shadow-sm transition-all",
                        cell === "P" ? "bg-player text-player-foreground border-player/50" :
                        cell === "B" ? "bg-banker text-banker-foreground border-banker/50" :
                        cell === "T" ? "bg-tie text-tie-foreground border-tie/50" :
                        "bg-white/5 border-white/5"
                    )}>
                    {cell}
                    </div>
                ))}
                </div>
            </div>
        </div>

        {/* Derived Roads Section */}
        <div className="flex flex-col sm:flex-row gap-2">
             {/* Big Eye Boy */}
             <DerivedRoadGrid data={bigEye} type="bigEye" label="Big Eye (ไข่ปลา)" />
             
             {/* Small Road & Cockroach usually stack on right in real dashboard, but here flex row is fine */}
             <DerivedRoadGrid data={smallRoad} type="small" label="Small Road (ซาลาเปา)" />
             <DerivedRoadGrid data={cockroach} type="cockroach" label="Cockroach (แมลงสาบ)" />
        </div>
    </div>
  );
};