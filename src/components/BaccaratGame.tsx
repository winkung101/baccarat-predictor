import { useState, useCallback, useEffect } from "react";
import { PlayingCard } from "./PlayingCard";
import { ScoreBoard } from "./ScoreBoard";
import { Statistics } from "./Statistics";
import { CardSelector } from "./CardSelector";
import { Button } from "./ui/button";
import { Card, GameResult, createShoe, playHand, calculateHandValue, Suit } from "@/lib/baccarat";
import { calculateNextMove, PredictionResult } from "@/lib/prediction";
import { runSimulation, SimulationStats } from "@/lib/simulation"; 
import { cn } from "@/lib/utils";
import { RotateCcw, PlayCircle, Settings2, Sparkles, BrainCircuit, Activity, Undo2, ArrowRightCircle, BarChart3, Loader2, Cpu, History, Zap } from "lucide-react";

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
  
  // ชุดที่ 1: ผลลัพธ์จริง (History)
  const [currentResult, setCurrentResult] = useState<GameResult | null>(null);
  
  // ชุดที่ 2: ผลลัพธ์คาดการณ์ (Simulation Forecast)
  const [forecastResult, setForecastResult] = useState<GameResult | null>(null);

  const [history, setHistory] = useState<("P" | "B" | "T")[]>([]);
  const [isDealing, setIsDealing] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // AI States
  const [prediction, setPrediction] = useState<PredictionResult>({ nextMove: null, ruleName: "Waiting", confidence: 0 });
  const [simStats, setSimStats] = useState<SimulationStats>({ pWins: 0, bWins: 0, tWins: 0, total: 0, pProb: 0, bProb: 0, tProb: 0, exampleHand: null });
  const [analyst, setAnalyst] = useState<AnalystOpinion>({ finalDecision: "รอเริ่มเกม", reasoning: "ระบบพร้อม...", riskLevel: "Safe", agreesWithPrediction: true });

  // --- Core Intelligence (Run 1M Sim Every Time) ---
  const runAIAnalysis = useCallback((currentHistory: ("P" | "B" | "T")[], currentShoe: Card[]) => {
    setIsCalculating(true);
    setForecastResult(null); // เคลียร์ผลคาดการณ์เก่าออกก่อน

    setTimeout(() => {
        // 1. สูตร Pattern
        const predResult = calculateNextMove(currentHistory);
        setPrediction(predResult);

        // 2. Sim 1,000,000 รอบ (Run ใหม่สดๆ)
        const simResult = runSimulation(currentShoe, 1000000); 
        setSimStats(simResult);
        
        // อัปเดตไพ่ชุดที่ 2 (Forecast) จากผล Sim
        if (simResult.exampleHand) {
            setForecastResult(simResult.exampleHand);
        }

        // 3. Analyst Analysis
        const cleanHistory = currentHistory.filter(h => h !== "T");
        let decision = "";
        let reason = "";
        let risk: "Safe" | "Moderate" | "Risky" = "Moderate";
        let agree = true;

        const simMajority = simResult.pProb > simResult.bProb ? "P" : "B";
        const simDiff = Math.abs(simResult.pProb - simResult.bProb);
        
        if (simDiff >= 1.5) {
            decision = `จัด ${simMajority}`;
            reason = `Sim 1M รอบ ชี้ขาด (+${simDiff.toFixed(2)}%)`;
            risk = "Safe";
            if (predResult.nextMove && predResult.nextMove !== simMajority) agree = false;
        } else if (predResult.confidence >= 70 && predResult.nextMove) {
            decision = `ตามสูตร ${predResult.nextMove}`;
            reason = `Sim สูสี เชื่อสูตร ${predResult.ruleName}`;
            risk = "Moderate";
        } else {
            decision = "พัก (Skip)";
            reason = `Sim 50/50 ไม่มีจังหวะเข้า`;
            risk = "Safe";
        }

        if (currentHistory.length > 0 && currentHistory[currentHistory.length-1] === "T") {
            reason += " (ระวังหลังเสมอ)";
            risk = "Risky";
        }

        setAnalyst({ finalDecision: decision, reasoning: reason, riskLevel: risk, agreesWithPrediction: agree });
        setIsCalculating(false);
    }, 10); 
  }, []);

  // Trigger Sim ใหม่ทุกครั้งที่ history เปลี่ยน
  useEffect(() => {
    runAIAnalysis(history, shoe);
  }, [history, shoe, runAIAnalysis]);

  // Actions
  const dealNewHand = useCallback(() => {
    if (isDealing) return;
    setIsDealing(true);
    // ไม่เคลียร์ forecastResult ตรงนี้ เพื่อให้เห็นภาพคาดการณ์ค้างไว้จนกว่าผลใหม่จะมา
    setTimeout(() => {
      const { result, remainingShoe } = playHand(shoe);
      setShoe(remainingShoe);
      setCurrentResult(result); // อัปเดตไพ่ชุดที่ 1
      setHistory(prev => [...prev, result.winner]);
      setRoundNumber(prev => prev + 1);
      setIsDealing(false);
    }, 400);
  }, [shoe, isDealing]);

  const addManualResult = (winner: "P" | "B" | "T") => {
    const { pCards, bCards } = generateMockCards(winner);
    const pScore = calculateHandValue(pCards);
    const bScore = calculateHandValue(bCards);
    const result: GameResult = { playerCards: pCards, bankerCards: bCards, playerScore: pScore, bankerScore: bScore, winner, isNatural: pScore >= 8 || bScore >= 8 };
    
    setCurrentResult(result); // อัปเดตไพ่ชุดที่ 1
    setHistory(prev => [...prev, winner]); 
    setRoundNumber(prev => prev + 1);
  };

  const undoLastHand = () => {
    if (history.length === 0) return;
    setHistory(prev => prev.slice(0, -1));
    setRoundNumber(prev => Math.max(1, prev - 1));
    setCurrentResult(null);
    setForecastResult(null);
  };

  const resetGame = useCallback(() => {
    setShoe(createShoe());
    setCurrentResult(null);
    setForecastResult(null);
    setHistory([]);
    setRoundNumber(1);
  }, []);

  // Helper Render Hand
  const renderMiniHand = (cards: Card[], score: number, label: string, isWinner: boolean, isPlayer: boolean, isForecast: boolean = false) => (
    <div className={cn(
        "flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-300 w-full",
        isWinner && !isForecast && "win-pulse border-2 border-gold/50",
        isForecast ? "bg-black/40 border border-white/10" : (isPlayer ? "bg-player/10" : "bg-banker/10")
    )}>
      <div className="flex justify-between w-full items-center">
        <span className={cn("text-xs font-bold uppercase", isPlayer ? "text-player" : "text-banker")}>{label}</span>
        <span className={cn("text-lg font-bold px-2 rounded-full", isPlayer ? "bg-player text-white" : "bg-banker text-white")}>{score}</span>
      </div>
      <div className="flex gap-1 justify-center h-16 items-center">
        {cards.map((c, i) => <PlayingCard key={i} suit={c.suit} rank={c.rank} delay={i * 50} className="w-10 h-14 sm:w-12 sm:h-16 text-xs" />)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-table-felt p-2 sm:p-4 pb-20 font-sans">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex justify-between items-center py-2 bg-black/20 p-4 rounded-xl border border-white/5">
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-gold text-shadow-gold">Baccarat Pro Sim</h1>
          <div className="bg-secondary/80 px-4 py-1.5 rounded-full border border-gold/20 text-gold font-bold text-sm shadow-inner">Round: {roundNumber}</div>
        </header>

        {/* --- DUAL SIMULATOR DISPLAY (ไพ่ 2 ชุด) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* ชุดที่ 1: ผลลัพธ์จริง/ล่าสุด (Actual Result) */}
            <div className="bg-card/40 backdrop-blur-md rounded-xl border border-white/10 p-4 relative overflow-hidden group">
                <div className="absolute top-0 left-0 bg-black/60 px-3 py-1 text-[10px] text-gray-300 font-bold uppercase tracking-wider rounded-br-lg z-10 flex items-center gap-2">
                    <History className="w-3 h-3" /> Latest Result (ผลล่าสุด)
                </div>
                
                <div className="mt-6 flex gap-2">
                    {currentResult ? (
                        <>
                            {renderMiniHand(currentResult.playerCards, currentResult.playerScore, "Player", currentResult.winner === "P", true)}
                            {renderMiniHand(currentResult.bankerCards, currentResult.bankerScore, "Banker", currentResult.winner === "B", false)}
                        </>
                    ) : (
                         <div className="w-full h-32 flex items-center justify-center text-gray-500 text-sm italic border-2 border-dashed border-white/10 rounded-lg">
                            รอผลการเล่น...
                         </div>
                    )}
                </div>
            </div>

            {/* ชุดที่ 2: คาดการณ์ถัดไป (Forecast 1M Sim) */}
            <div className="bg-gradient-to-br from-purple-900/20 to-black/40 backdrop-blur-md rounded-xl border border-purple-500/30 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 bg-purple-600/80 px-3 py-1 text-[10px] text-white font-bold uppercase tracking-wider rounded-br-lg z-10 flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Next Prediction (คาดการณ์ตาถัดไป)
                </div>
                {isCalculating && <Loader2 className="absolute top-2 right-2 w-4 h-4 text-purple-400 animate-spin" />}

                <div className="mt-6 flex gap-2 relative">
                    {/* Overlay ตอนคำนวณ */}
                    {isCalculating && (
                        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-lg">
                            <Cpu className="w-8 h-8 text-purple-400 animate-pulse mb-2" />
                            <span className="text-xs text-purple-200 font-mono">Simulating 1M Rounds...</span>
                        </div>
                    )}

                    {forecastResult ? (
                        <>
                            {renderMiniHand(forecastResult.playerCards, forecastResult.playerScore, "Player", forecastResult.winner === "P", true, true)}
                            {renderMiniHand(forecastResult.bankerCards, forecastResult.bankerScore, "Banker", forecastResult.winner === "B", false, true)}
                        </>
                    ) : (
                         <div className="w-full h-32 flex items-center justify-center text-purple-300/50 text-sm italic border-2 border-dashed border-purple-500/20 rounded-lg">
                            กำลังจำลอง 1,000,000 รอบ...
                         </div>
                    )}
                </div>
                
                {/* Stats Bar เล็กๆ ใต้การคาดการณ์ */}
                <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-400 justify-center bg-black/20 py-1 rounded">
                    <span>Sim Stats:</span>
                    <span className="text-player font-bold">P {simStats.pProb}%</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-banker font-bold">B {simStats.bProb}%</span>
                </div>
            </div>
        </div>

        {/* --- AI ANALYST & CONTROLS --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
             {/* Analyst Decision Box */}
             <div className="lg:col-span-2 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl border border-gold/30 p-4 flex items-center gap-4 shadow-lg">
                <div className="bg-gold/10 p-3 rounded-full hidden sm:block">
                    <BrainCircuit className="w-8 h-8 text-gold" />
                </div>
                <div className="flex-1">
                    <div className="text-xs text-gold uppercase tracking-widest font-bold mb-1">AI Recommendation</div>
                    <div className="flex items-center gap-2 text-2xl font-bold text-white">
                        <ArrowRightCircle className={cn("w-6 h-6", analyst.riskLevel === "Safe" ? "text-green-500" : analyst.riskLevel === "Moderate" ? "text-yellow-500" : "text-red-500")} />
                        {analyst.finalDecision}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">"{analyst.reasoning}"</p>
                </div>
                <div className="text-right hidden sm:block">
                     <div className="text-[10px] text-gray-500 uppercase">Formula</div>
                     <div className={cn("font-bold", prediction.nextMove==="P"?"text-player":prediction.nextMove==="B"?"text-banker":"text-gray-400")}>{prediction.nextMove || "-"}</div>
                </div>
             </div>

             {/* Controls */}
             <div className="bg-secondary/30 rounded-xl border border-white/5 p-4 flex flex-col justify-center gap-3">
                 <div className="flex justify-center gap-2 w-full">
                    <Button onClick={() => addManualResult("P")} className="flex-1 bg-player hover:bg-player/80 h-10 font-bold border-b-4 border-player/50 active:border-b-0 active:translate-y-1">P</Button>
                    <Button onClick={() => addManualResult("T")} className="flex-1 bg-tie hover:bg-tie/80 h-10 font-bold border-b-4 border-tie/50 active:border-b-0 active:translate-y-1">T</Button>
                    <Button onClick={() => addManualResult("B")} className="flex-1 bg-banker hover:bg-banker/80 h-10 font-bold border-b-4 border-banker/50 active:border-b-0 active:translate-y-1">B</Button>
                 </div>
                 <div className="flex justify-center gap-2 w-full">
                    <Button onClick={dealNewHand} disabled={isDealing} className="flex-1 bg-gold-gradient text-black hover:opacity-90 font-bold"><PlayCircle className="mr-1 w-4 h-4"/> Deal</Button>
                    <Button onClick={undoLastHand} variant="secondary" size="icon" className="w-10"><Undo2 className="w-4 h-4"/></Button>
                    <Button onClick={() => setShowCardSelector(true)} variant="ghost" size="icon" className="w-10"><Settings2 className="w-4 h-4"/></Button>
                    <Button onClick={resetGame} variant="ghost" size="icon" className="w-10 text-red-400"><RotateCcw className="w-4 h-4"/></Button>
                 </div>
             </div>
        </div>

        {/* Card Selector Modal */}
        {showCardSelector && <CardSelector onConfirm={handleManualCards} onCancel={() => setShowCardSelector(false)} />}

        {/* Stats & Scoreboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Statistics history={history} />
          <ScoreBoard history={history} />
        </div>
      </div>
    </div>
  );
};