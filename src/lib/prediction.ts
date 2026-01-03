// src/lib/prediction.ts

export type PredictionResult = {
  nextMove: "P" | "B" | null; // สูตรบอกให้ลงอะไร
  ruleName: string;           // ชื่อสูตร (มังกร, ปิงปอง, ฯลฯ)
  confidence: number;         // ความมั่นใจ (0-100%)
};

export const calculateNextMove = (history: ("P" | "B" | "T")[]): PredictionResult => {
  if (history.length < 3) {
    return { nextMove: null, ruleName: "รอข้อมูล...", confidence: 0 };
  }

  // กรองเสมอออกเพื่อคำนวณสูตร
  const cleanHistory = history.filter((h) => h !== "T");
  const last = cleanHistory[cleanHistory.length - 1];
  const last2 = cleanHistory[cleanHistory.length - 2];
  const last3 = cleanHistory[cleanHistory.length - 3];
  
  // 1. สูตรมังกร (Dragon): ออกสีเดิมติดกัน 4 ตาขึ้นไป -> ตามต่อ
  let streak = 0;
  for (let i = cleanHistory.length - 1; i >= 0; i--) {
    if (cleanHistory[i] === last) streak++;
    else break;
  }

  if (streak >= 4) {
    return {
      nextMove: last as "P" | "B",
      ruleName: `ตามมังกร ${last === "P" ? "น้ำเงิน" : "แดง"} (Dragon Loop)`,
      confidence: 85
    };
  }

  // 2. สูตรปิงปอง (Ping Pong): สลับไปมา 3 ครั้งขึ้นไป (P B P -> B)
  if (cleanHistory.length >= 3) {
    if (last !== last2 && last2 !== last3) {
      return {
        nextMove: last === "P" ? "B" : "P", // แทงสวนสีล่าสุด
        ruleName: "ตามปิงปอง (Ping Pong Switch)",
        confidence: 75
      };
    }
  }

  // 3. สูตรลูกคู่ (Double): มาแบบ 2 ตัด 2 (PP BB PP -> B)
  if (cleanHistory.length >= 4) {
      const last4 = cleanHistory[cleanHistory.length - 4];
      // เช็คว่าเป็น PP BB ...
      if (last === last2 && last3 === last4 && last !== last3) {
          return {
              nextMove: last === "P" ? "B" : "P", // จบคู่แล้วต้องเปลี่ยนสี
              ruleName: "เค้าไพ่ลูกคู่ (Double Stick)",
              confidence: 60
          };
      }
  }

  // 4. สูตรตัด (Cut): ถ้าไม่เข้าสูตรหลัก ให้ดูแนวโน้มระยะสั้น (3 ตาหลัง)
  // ถ้า P มาเยอะกว่า B ให้ตาม P
  const last6 = cleanHistory.slice(-6);
  const pCount = last6.filter(r => r === "P").length;
  const bCount = last6.filter(r => r === "B").length;

  if (Math.abs(pCount - bCount) >= 2) {
      const majority = pCount > bCount ? "P" : "B";
      return {
          nextMove: majority,
          ruleName: "ตามกระแสหลัก (Trend Follow)",
          confidence: 50
      };
  }

  return { nextMove: null, ruleName: "ไม่มีเค้าไพ่ชัดเจน", confidence: 20 };
};