import { Card, GameResult, calculateHandValue } from "./baccarat";

export type SimulationStats = {
  pWins: number;
  bWins: number;
  tWins: number;
  total: number;
  pProb: number;
  bProb: number;
  tProb: number;
  // เพิ่มค่านี้เพื่อส่งไพ่ตัวอย่างกลับไปแสดงผล
  exampleHand: GameResult | null;
};

// แปลงค่าไพ่เป็นคะแนน (High Performance)
const getVal = (card: Card) => {
  if (["10", "J", "Q", "K"].includes(card.rank)) return 0;
  if (card.rank === "A") return 1;
  return parseInt(card.rank);
};

// ฟังก์ชันจำลอง 1 ใบจาก Deck
const drawSimCard = (shoe: Card[], usedIndices: number[]): { card: Card, val: number } => {
    let idx = Math.floor(Math.random() * shoe.length);
    while (usedIndices.includes(idx)) {
        idx = Math.floor(Math.random() * shoe.length);
    }
    usedIndices.push(idx);
    return { card: shoe[idx], val: getVal(shoe[idx]) };
};

export const runSimulation = (currentShoe: Card[], iterations: number = 1000000): SimulationStats => {
  if (currentShoe.length < 6) {
    return { pWins: 0, bWins: 0, tWins: 0, total: 0, pProb: 0, bProb: 0, tProb: 0, exampleHand: null };
  }

  let pWins = 0;
  let bWins = 0;
  let tWins = 0;

  // เราจะเก็บตัวอย่างไพ่ของฝั่งที่ชนะ (เพื่อเอาไปโชว์เป็น Sim ชุดที่ 2)
  let examplePWin: GameResult | null = null;
  let exampleBWin: GameResult | null = null;

  for (let i = 0; i < iterations; i++) {
    const usedIndices: number[] = [];
    
    // --- เริ่มจำลองการแจกไพ่ ---
    // เก็บ Card Object จริงๆ ไว้ด้วยเฉพาะรอบที่เราจะเอาเป็นตัวอย่าง (เพื่อประหยัด RAM)
    // แต่เพื่อความเร็วสูงสุด เราจะดึง Object จริงเฉพาะตอนสร้าง Example เท่านั้น
    // ใน Loop ปกติเราใช้แค่ Index กับ Value
    
    // สุ่ม Index 6 ใบเตรียมไว้
    while (usedIndices.length < 6) {
        const r = Math.floor(Math.random() * currentShoe.length);
        if (!usedIndices.includes(r)) usedIndices.push(r);
    }

    const p1Val = getVal(currentShoe[usedIndices[0]]);
    const b1Val = getVal(currentShoe[usedIndices[1]]);
    const p2Val = getVal(currentShoe[usedIndices[2]]);
    const b2Val = getVal(currentShoe[usedIndices[3]]);

    let pScore = (p1Val + p2Val) % 10;
    let bScore = (b1Val + b2Val) % 10;

    let p3Val = -1;
    let b3Val = -1;

    // Natural Check
    let isNatural = false;
    if (pScore >= 8 || bScore >= 8) {
        isNatural = true;
    } else {
        // Player Rule
        if (pScore <= 5) {
            p3Val = getVal(currentShoe[usedIndices[4]]);
            pScore = (pScore + p3Val) % 10;
        }

        // Banker Rule
        let bDraws = false;
        if (p3Val === -1) { 
            if (bScore <= 5) bDraws = true;
        } else {
            if (bScore <= 2) bDraws = true;
            else if (bScore === 3 && p3Val !== 8) bDraws = true;
            else if (bScore === 4 && p3Val >= 2 && p3Val <= 7) bDraws = true;
            else if (bScore === 5 && p3Val >= 4 && p3Val <= 7) bDraws = true;
            else if (bScore === 6 && (p3Val === 6 || p3Val === 7)) bDraws = true;
        }

        if (bDraws) {
            // เลือกใบที่ถูกต้อง (ใบที่ 5 หรือ 6)
            const b3Index = p3Val === -1 ? usedIndices[4] : usedIndices[5];
            b3Val = getVal(currentShoe[b3Index]);
            bScore = (bScore + b3Val) % 10;
        }
    }

    // ตัดสินผล
    let winner: "P" | "B" | "T" = "T";
    if (pScore > bScore) {
        pWins++;
        winner = "P";
    } else if (bScore > pScore) {
        bWins++;
        winner = "B";
    } else {
        tWins++;
        winner = "T";
    }

    // เก็บตัวอย่างไพ่ (เก็บแค่ครั้งแรกที่เจอของแต่ละฝั่ง ก็พอแล้ว)
    if (winner === "P" && !examplePWin) {
        examplePWin = createGameResult(currentShoe, usedIndices, p3Val !== -1, b3Val !== -1);
    }
    if (winner === "B" && !exampleBWin) {
        exampleBWin = createGameResult(currentShoe, usedIndices, p3Val !== -1, b3Val !== -1);
    }
  }

  // เลือกส่งไพ่ตัวอย่างของฝั่งที่มีโอกาสชนะมากกว่า
  const likelyWinnerHand = pWins > bWins ? examplePWin : exampleBWin;

  return {
    pWins,
    bWins,
    tWins,
    total: iterations,
    pProb: parseFloat(((pWins / iterations) * 100).toFixed(2)),
    bProb: parseFloat(((bWins / iterations) * 100).toFixed(2)),
    tProb: parseFloat(((tWins / iterations) * 100).toFixed(2)),
    exampleHand: likelyWinnerHand // ส่งกลับไปโชว์
  };
};

// Helper สร้าง Object ผลลัพธ์เต็มรูปแบบ (สำหรับแสดงผล)
const createGameResult = (shoe: Card[], indices: number[], pDrew: boolean, bDrew: boolean): GameResult => {
    const pCards = [shoe[indices[0]], shoe[indices[2]]];
    const bCards = [shoe[indices[1]], shoe[indices[3]]];
    
    if (pDrew) pCards.push(shoe[indices[4]]);
    // ถ้า P ไม่จั่ว B จะจั่วใบที่ index 4, ถ้า P จั่ว B จะจั่วใบที่ index 5
    if (bDrew) bCards.push(shoe[pDrew ? indices[5] : indices[4]]);

    const pScore = calculateHandValue(pCards);
    const bScore = calculateHandValue(bCards);
    
    let winner: "P" | "B" | "T" = "T";
    if (pScore > bScore) winner = "P";
    else if (bScore > pScore) winner = "B";

    return {
        playerCards: pCards,
        bankerCards: bCards,
        playerScore: pScore,
        bankerScore: bScore,
        winner,
        isNatural: (pCards.length === 2 && bCards.length === 2) && (pScore >= 8 || bScore >= 8)
    };
};