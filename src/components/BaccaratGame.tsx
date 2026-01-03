import { useState, useCallback, useEffect } from "react";
import { PlayingCard } from "./PlayingCard";
import { ScoreBoard } from "./ScoreBoard";
import { Statistics } from "./Statistics";
import { CardSelector } from "./CardSelector";
import { Button } from "./ui/button";
import { Card, GameResult, createShoe, playHand, calculateHandValue, Suit } from "@/lib/baccarat";
import { calculateNextMove, PredictionResult } from "@/lib/prediction"; // Import Prediction AI
import { cn } from "@/lib/utils";
import { RotateCcw, PlayCircle, Settings2, Sparkles, BrainCircuit, Activity, Undo2, AlertTriangle, ArrowRightCircle } from "lucide-react";

// Mock Cards Helper
const generateMockCards = (winner: "P" | "B" | "T"): { pCards: Card[], bCards: Card[] } => {
  const suits: Suit[] = ["spades", "hearts", "clubs", "diamonds"];
  const getSuit = () => suits[Math.floor(Math.random() * suits.length)];
  if (winner === "P") {
    return { pCards: [{ suit: getSuit(), rank: "9", value: 9 }, { suit: getSuit(), rank: "K", value: 0 }], bCards: [{ suit: getSuit(), rank: "J", value: 0 }, { suit: getSuit(), rank: "Q", value: 0 }] };
  } else if (winner === "B") {
    return { pCards: [{ suit: getSuit(), rank: "J", value: 0 }, { suit: getSuit(), rank: "Q", value: 0 }], bCards: [{ suit: getSuit(), rank: "9", value: 9 }, { suit: getSuit(), rank: "K", value: 0 }] };
  } else {
    return { pCards: [{ suit: getSuit(), rank: "8", value: 8 }, { suit: getSuit(), rank: "K", value: 0 }], bCards: [{ suit: getSuit(), rank: "8", value: 8 }, { suit: getSuit(), rank: "Q", value: 0 }] };
  }
};

type AnalystOpinion = {
  finalDecision: string;
  reasoning: string;
  riskLevel: "Safe" | "Moderate" | "Risky";
  agreesWithPrediction: boolean;
};

export const BaccaratGame = () => {
  const [shoe, setShoe] = useState<Card[]>(() => createShoe());
  const [currentResult, setCurrentResult] = useState<GameResult | null>(null);
  const [history, setHistory] = useState<("P" | "B" | "T")[]>([]);
  const [isDealing, setIsDealing] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [showCardSelector, setShowCardSelector] = useState(false);

  // State สำหรับ 2 AI
  const [prediction, setPrediction] = useState<PredictionResult>({ nextMove: null, ruleName: "Waiting", confidence: 0 });
  const [analyst, setAnalyst] = useState<AnalystOpinion>({ 
    finalDecision: "รอเริ่มเกม", 
    reasoning: "ระบบกำลังเตรียมพร้อม...", 
    riskLevel: "Safe", 
    agreesWithPrediction: true 
  });

  // --- 1. Prediction AI (คำนวณสูตร) & 2. Analyst AI (วิเคราะห์ร่วม) ---
  const runAIAnalysis = useCallback((currentHistory: ("P" | "B" | "T")[]) => {
    // 1. เรียกใช้งาน Prediction AI
    const predResult = calculateNextMove(currentHistory);
    setPrediction(predResult);

    // 2. Analyst AI ทำงาน (วิเคราะห์ผลจาก Sim + ผลจาก Prediction)
    const cleanHistory = currentHistory.filter(h => h !== "T");
    const total = cleanHistory.length;
    
    let decision = "";
    let reason = "";
    let risk: "Safe" | "Moderate" | "Risky" = "Moderate";
    let agree = true;

    // Logic ของ Analyst AI
    if (total < 5) {
        decision = "ใจเย็นๆ (Wait)";
        reason = "ข้อมูลยังน้อยเกินไป ให้ Sim เดินเกมอีกสักพัก";
        risk = "Safe";
    } else {
        // เช็คความขัดแย้งของสถิติ
        const pCount = cleanHistory.filter(h => h === "P").length;
        const bCount = cleanHistory.filter(h => h === "B").length;
        const diff = Math.abs(pCount - bCount);
        
        // กรณีสูตรมั่นใจสูง
        if (predResult.confidence >= 80) {
            decision = `จัดเต็ม ${predResult.nextMove}`;
            reason = `สูตร "${predResult.ruleName}" แข็งมาก และสถิติ Sim เป็นใจ`;
            risk = "Safe";
        } 
        // กรณีสูตรมั่นใจปานกลาง
        else if (predResult.confidence >= 50) {
            // ถ้าสูตรบอก P แต่สถิติรวม B ออกเยอะกว่ามาก -> ขัดแย้ง
            if (predResult.nextMove === "P" && bCount > pCount + 3) {
                decision = "สวนสูตร (Contrarian)";
                reason = `สูตรบอก P (${predResult.ruleName}) แต่สถิติ Sim ไหล B หนักมาก เชื่อสถิติดีกว่า`;
                agree = false;
                risk = "Risky";
            } else {
                decision = `ตามสูตร ${predResult.nextMove} (เบาๆ)`;
                reason = `สูตร ${predResult.ruleName} พอไปได้ แต่ระวังเหวี่ยง`;
                risk = "Moderate";
            }
        } 
        // กรณีสูตรไม่มั่นใจ
        else {
            decision = "พักดูก่อน (Skip)";
            reason = "สูตรหาเค้าไม่เจอ และ Sim กำลังเหวี่ยงมั่ว";
            risk = "Safe";
        }

        // เช็คการออกเสมอ (Tie) ล่าสุด
        if (currentHistory[currentHistory.length-1] === "T") {
            reason += " (ล่าสุดออกเสมอ ระวังเค้าเปลี่ยน)";
            risk = "Risky";
        }
    }

    setAnalyst({
        finalDecision: decision,
        reasoning: reason,
        riskLevel: risk,
        agreesWithPrediction: agree
    });

  }, []);

  // ทำงานทุกครั้งที่ History เปลี่ยน (Sim ทำงานเสร็จ)
  useEffect(() => {
    runAIAnalysis(history);
  }, [history, runAIAnalysis]);

  // --- Game Actions ---
  const dealNewHand = useCallback(() => {
    if (isDealing) return;
    setIsDealing(true);
    setCurrentResult(null);
    setTimeout(() => {
      const { result, remainingShoe } = playHand(shoe);
      setShoe(remainingShoe);
      setCurrentResult(result);
      setHistory(prev => [...prev, result.winner]);
      setRoundNumber(prev => prev + 1);
      setIsDealing(false);
    }, 400);
  }, [shoe, isDealing]);

  const handleManualCards = useCallback((playerCards: Card[], bankerCards: Card[]) => {
    const pScore = calculateHandValue(playerCards);
    const bScore = calculateHandValue(bankerCards);
    let winner: "P" | "B" | "T" = pScore > bScore ? "P" : bScore > pScore ? "B" : "T";
    const result: GameResult = { playerCards, bankerCards, playerScore: pScore, bankerScore: bScore, winner, isNatural: pScore >= 8 || bScore >= 8 };
    setCurrentResult(result);
    setHistory(prev => [...prev, winner]);
    setRoundNumber(prev => prev + 1);
    setShowCardSelector(false);
  }, []);

  const addManualResult = (winner: "P" | "B" | "T") => {
    setHistory(prev => [...prev, winner]);
    setRoundNumber(prev => prev + 1);
    const { pCards, bCards } = generateMockCards(winner);
    const pScore = calculateHandValue(pCards);
    const bScore = calculateHandValue(bCards);
    setCurrentResult({ playerCards: pCards, bankerCards: bCards, playerScore: pScore, bankerScore: bScore, winner, isNatural: pScore >= 8 || bScore >= 8 });
  };

  const undoLastHand = () => {
    if (history.length === 0) return;
    setHistory(prev => prev.slice(0, -1));
    setRoundNumber(prev => Math.max(1, prev - 1));
    setCurrentResult(null);
  };

  const resetGame = useCallback(() => {
    setShoe(createShoe());
    setCurrentResult(null);
    setHistory([]);
    setRoundNumber(1);
  }, []);

  const renderHand = (cards: Card[], score: number, label: string, isWinner: boolean, isPlayer: boolean) => (
    <div className={cn("flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-300", isWinner && "win-pulse", isPlayer ? "bg-player/10" : "bg-banker/10")}>
      <div className={cn("text-xl sm:text-2xl font-serif font-bold", isPlayer ? "text-player" : "text-banker")}>{label}</div>
      <div className="flex gap-2 justify-center">{cards.map((c, i) => <PlayingCard key={i} suit={c.suit} rank={c.rank} delay={i * 100} />)}</div>
      <div className={cn("text-3xl font-bold mt-2 px-6 py-1 rounded-full", isPlayer ? "bg-player text-white" : "bg-banker text-white")}>{score}</div>
    </div>
  );

  const getWinnerText = () => {
    if (!currentResult) return null;
    const { winner, isNatural } = currentResult;
    let text = winner === "P" ? "PLAYER WINS!" : winner === "B" ? "BANKER WINS!" : "TIE!";
    let colorClass = winner === "P" ? "text-player" : winner === "B" ? "text-banker" : "text-tie";

    return (
      <div className="slide-up text-center">
        <div className={cn("text-2xl sm:text-4xl font-serif font-bold", colorClass)}>{text}</div>
        {isNatural && <div className="text-gold text-lg sm:text-xl mt-1">Natural!</div>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-table-felt p-2 sm:p-4 lg:p-6 pb-20">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <header className="flex justify-between items-center py-2">
          <h1 className="text-2xl font-serif font-bold text-gold text-shadow-gold">Baccarat Pro Sim</h1>
          <div className="bg-secondary/50 px-3 py-1 rounded-full border border-white/10 text-gold font-bold">Round: {roundNumber}</div>
        </header>

        {/* --- AI INTELLIGENCE CENTER (ส่วนแสดงผล 2 AI) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 1. ส่วนแสดงผล Prediction AI (สูตรคำนวณ) */}
            <div className="bg-black/30 rounded-xl border border-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <h3 className="text-blue-400 font-bold uppercase text-xs tracking-wider">Prediction AI (สูตร)</h3>
                </div>
                <div className="flex justify-between items-center">
                    <div>
                        <div className="text-sm text-gray-400">Next Move</div>
                        <div className={cn("text-3xl font-bold", prediction.nextMove === "P" ? "text-player" : prediction.nextMove === "B" ? "text-banker" : "text-gray-500")}>
                            {prediction.nextMove ? (prediction.nextMove === "P" ? "PLAYER" : "BANKER") : "-"}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-400">Confidence</div>
                        <div className="text-xl font-mono text-white">{prediction.confidence}%</div>
                    </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 bg-black/20 p-2 rounded truncate">
                    Rule: {prediction.ruleName}
                </div>
            </div>

            {/* 2. ส่วนแสดงผล Analyst AI (หัวหน้าวิเคราะห์) */}
            <div className="md:col-span-1 lg:col-span-2 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl border border-gold/40 p-4 relative overflow-hidden shadow-lg">
                <div className="absolute right-0 top-0 p-3 opacity-10"><BrainCircuit className="w-20 h-20 text-gold"/></div>
                
                <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                    <div className="bg-gold/10 p-3 rounded-full h-fit w-fit hidden sm:block">
                        <Sparkles className="w-6 h-6 text-gold animate-pulse"/>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-gold font-bold text-sm uppercase tracking-wider">Analyst AI (ความเห็นสุดท้าย)</h3>
                            {!analyst.agreesWithPrediction && (
                                <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-500/30">ขัดแย้งสูตร</span>
                            )}
                        </div>
                        
                        <div className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <ArrowRightCircle className={cn("w-6 h-6", analyst.riskLevel === "Safe" ? "text-green-500" : analyst.riskLevel === "Moderate" ? "text-yellow-500" : "text-red-500")} />
                            {analyst.finalDecision}
                        </div>
                        
                        <p className="text-sm text-gray-300 bg-black/20 p-2 rounded border-l-2 border-gold/50 italic">
                            "{analyst.reasoning}"
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="bg-secondary/30 rounded-lg p-3 border border-white/5 flex flex-wrap justify-center items-center gap-4">
            <div className="flex gap-2">
                <Button onClick={() => addManualResult("P")} className="bg-player hover:bg-player/80 w-14 h-12 font-bold shadow-lg border-b-4 border-player/50 active:border-b-0 active:translate-y-1">P</Button>
                <Button onClick={() => addManualResult("T")} className="bg-tie hover:bg-tie/80 w-12 h-12 font-bold shadow-lg border-b-4 border-tie/50 active:border-b-0 active:translate-y-1">T</Button>
                <Button onClick={() => addManualResult("B")} className="bg-banker hover:bg-banker/80 w-14 h-12 font-bold shadow-lg border-b-4 border-banker/50 active:border-b-0 active:translate-y-1">B</Button>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block"></div>
            <div className="flex gap-2">
                <Button onClick={dealNewHand} disabled={isDealing} className="bg-gold-gradient text-black hover:opacity-90 px-6 h-12 font-bold shadow-gold/20 shadow-lg"><PlayCircle className="mr-2 h-5 w-5" /> DEAL</Button>
                <Button onClick={undoLastHand} variant="secondary" size="icon" className="h-12 w-12" disabled={history.length === 0}><Undo2 className="h-5 w-5"/></Button>
                <Button onClick={() => setShowCardSelector(true)} variant="ghost" size="icon" className="h-12 w-12"><Settings2 className="h-5 w-5"/></Button>
                <Button onClick={resetGame} variant="ghost" size="icon" className="h-12 w-12 text-red-400"><RotateCcw className="h-5 w-5"/></Button>
            </div>
        </div>

        {/* Game Area */}
        {showCardSelector ? <CardSelector onConfirm={handleManualCards} onCancel={() => setShowCardSelector(false)} /> : (
          <div className="bg-card/30 backdrop-blur rounded-2xl border border-gold/20 p-4 min-h-[250px] flex flex-col justify-center relative">
            <div className="absolute top-4 w-full text-center">{currentResult && getWinnerText()}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              {currentResult ? (
                <>
                  {renderHand(currentResult.playerCards, currentResult.playerScore, "PLAYER", currentResult.winner === "P", true)}
                  {renderHand(currentResult.bankerCards, currentResult.bankerScore, "BANKER", currentResult.winner === "B", false)}
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-player/5 min-h-[160px] justify-center border-2 border-dashed border-player/10 opacity-50"><div className="text-xl font-bold text-player">PLAYER ZONE</div></div>
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-banker/5 min-h-[160px] justify-center border-2 border-dashed border-banker/10 opacity-50"><div className="text-xl font-bold text-banker">BANKER ZONE</div></div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ScoreBoard & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Statistics history={history} />
          <ScoreBoard history={history} />
        </div>
      </div>
    </div>
  );
};