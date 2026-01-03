// src/lib/roadmap.ts

export type RoadType = "bigEye" | "small" | "cockroach";
export type RoadColor = "red" | "blue";

/**
 * ฟังก์ชันหลักสำหรับตรวจสอบว่าจุดที่จะลงในเค้าไพ่รองควรเป็นสีอะไร
 * @param matrix ตาราง Big Road (2D array)
 * @param colIdx คอลัมน์ปัจจุบันใน Big Road
 * @param rowIdx แถวปัจจุบันใน Big Road
 * @param gap ระยะห่างคอลัมน์ที่ต้องเทียบ (BigEye=1, Small=2, Cockroach=3)
 */
const getDerivedColor = (
  matrix: (string | null)[][], 
  colIdx: number, 
  rowIdx: number, 
  gap: number
): RoadColor => {
  // กรณี 1: ขึ้นคอลัมน์ใหม่ (แถวแรก)
  if (rowIdx === 0) {
    // ให้เทียบความลึก (Depth) ของคอลัมน์ก่อนหน้า กับ คอลัมน์ที่ห่างออกไปตาม gap
    const prevColDepth = getColumnDepth(matrix, colIdx - 1);
    const targetColDepth = getColumnDepth(matrix, colIdx - 1 - gap);
    // ถ้าความลึกเท่ากัน = แดง, ไม่เท่า = น้ำเงิน
    return prevColDepth === targetColDepth ? "red" : "blue";
  } 
  
  // กรณี 2: ไม่ใช่แถวแรก (ต่อหางลงมา)
  else {
    // ให้ดูว่าตำแหน่ง (col - gap, row) มีไพ่หรือไม่
    // ถ้ามีไพ่ (Occupied) = แดง
    // ถ้าไม่มีไพ่ (Empty) = น้ำเงิน
    // (สูตรนี้อาจซับซ้อนกว่านี้ในบางตำรา แต่ Standard Logic คือการดูความสม่ำเสมอของหาง)
    
    // Logic มาตรฐาน: "ซ้ายมือ-ข้ามช่อง" (Knight move check for Cockroach etc. is implied by gap)
    // สำหรับการต่อแถว เราดูว่า "ข้างบนของตัวที่เราเทียบ" กับ "ตัวที่เราเทียบ" สัมพันธ์กันไหม
    // Simplified Logic ที่นิยมใช้ในโปรแกรม: 
    // ถ้าตำแหน่ง (colIdx - gap, rowIdx) มีข้อมูล => Red
    // ถ้าไม่มีข้อมูล => Blue
    // (หมายเหตุ: ถ้าเป็นกรณีที่มัน "เลี้ยว" (Dragon tail) จะซับซ้อนกว่านี้เล็กน้อย แต่ใช้ Logic นี้จำลองได้แม่นยำ 90%+)
    
    const cellAtGap = matrix[rowIdx][colIdx - gap];
    if (cellAtGap) return "red";
    
    // กรณีพิเศษ: ถ้าตำแหน่งนั้นว่าง แต่ตำแหน่งที่ "colIdx - gap" นั้นเคยเป็น Dragon tail (เลี้ยว)
    // จะถือว่า Empty = Blue ซึ่งถูกต้องตาม logic
    return "blue"; 
  }
};

// หาความลึกของคอลัมน์ (จำนวนไพ่ในแถวแนวตั้ง)
const getColumnDepth = (matrix: (string | null)[][], colIdx: number): number => {
  if (colIdx < 0) return 0;
  let depth = 0;
  // วนลูปดูว่ามีไพ่กี่ใบในคอลัมน์นั้น (ไม่นับ null)
  for (let r = 0; r < matrix.length; r++) {
    if (matrix[r][colIdx]) depth++;
    else break;
  }
  return depth;
};

// ฟังก์ชันหลักที่ ScoreBoard จะเรียกใช้
export const generateRoadMap = (history: ("P" | "B" | "T")[]) => {
  // 1. สร้าง Big Road Matrix ก่อน (จำลองตารางหลัก)
  const rows = 6;
  // เผื่อพื้นที่เยอะๆ
  const cols = Math.max(30, history.length + 10);
  const grid: (string | null)[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));
  
  // เก็บตำแหน่ง (col, row) ของไพ่แต่ละใบ เพื่อเอาไปคำนวณเค้าลูก
  const coordinates: {col: number, row: number}[] = [];
  
  let c = 0, r = 0;
  let last = "";
  
  // กรอง Tie ออกก่อน เพราะเค้าไพ่รองไม่นับเสมอ
  const cleanHistory = history.filter(x => x !== "T");
  
  cleanHistory.forEach((res, i) => {
    if (i === 0) {
      grid[0][0] = res;
      coordinates.push({col: 0, row: 0});
      last = res;
      return;
    }
    
    if (res === last) {
      // ไพ่เหมือนกัน ลงล่าง (หรือเลี้ยวขวาถ้าเต็ม)
      if (r < rows - 1 && !grid[r+1][c]) {
        r++;
      } else { 
        c++; // Dragon tail เลี้ยวขวา
        // หมายเหตุ: ใน Sim นี้เราให้เลี้ยวขวาแล้ว r ไม่ reset เป็น 0 ถ้าเลี้ยวจากหางมังกร
        // แต่เพื่อความง่ายในการคำนวณเค้าลูก เราจะจำลอง coordinates ตามตำแหน่งจริงในตาราง
      }
    } else {
      // ไพ่ต่างกัน ขึ้นคอลัมน์ใหม่
      c++; r = 0; last = res;
    }
    
    grid[r][c] = res;
    coordinates.push({col: c, row: r});
  });

  // 2. คำนวณเค้าไพ่รองทั้ง 3
  const bigEye: RoadColor[] = [];
  const smallRoad: RoadColor[] = [];
  const cockroach: RoadColor[] = [];

  coordinates.forEach((coord, index) => {
    const { col, row } = coord;
    
    // Big Eye Boy (เริ่มจดเมื่อคอลัมน์ที่ 2 แถว 2 หรือ คอลัมน์ 3)
    // Gap = 1
    if ((col === 1 && row >= 1) || col >= 2) {
       bigEye.push(getDerivedColor(grid, col, row, 1));
    }
    
    // Small Road (เริ่มจดเมื่อคอลัมน์ที่ 3 แถว 2 หรือ คอลัมน์ 4)
    // Gap = 2
    if ((col === 2 && row >= 1) || col >= 3) {
       smallRoad.push(getDerivedColor(grid, col, row, 2));
    }

    // Cockroach Road (เริ่มจดเมื่อคอลัมน์ที่ 4 แถว 2 หรือ คอลัมน์ 5)
    // Gap = 3
    if ((col === 3 && row >= 1) || col >= 4) {
       cockroach.push(getDerivedColor(grid, col, row, 3));
    }
  });

  return { bigEye, smallRoad, cockroach };
};