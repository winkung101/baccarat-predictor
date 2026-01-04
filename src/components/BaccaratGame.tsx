import { useState, useCallback, useEffect, useRef } from "react";
import { PlayingCard } from "./PlayingCard";
import { ScoreBoard } from "./ScoreBoard";
import { Statistics } from "./Statistics";
import { CardSelector } from "./CardSelector";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, GameResult, createShoe, playHand, calculateHandValue, prepareShoe } from "@/lib/baccarat";
import { calculateNextMove, PredictionResult } from "@/lib/prediction";
import { runSimulation, SimulationStats } from "@/lib/simulation"; // ต้องแน่ใจว่า import ถูกต้อง
import { cn } from "@/lib/utils";
import { RotateCcw, PlayCircle, Edit2, Check, Settings2, PenTool, Activity, ArrowRightCircle, BarChart3, BrainCircuit, Cpu, Loader2, Sparkles, Undo2, Layers } from "lucide-react";
// Import Toast (ถ้าโปรเจคมี UI component นี้) หรือใช้ state แสดงข้อความง่ายๆ
// สมมติว่าใช้ Alert ง่ายๆ หรือแสดงข้อความในหน้าจอ

const generateMockCards = (winner: "P" | "B" | "T"): { pCards: Card[], bCards: Card[] } => {
  const suits = ["spades", "hearts", "clubs", "diamonds"] as const;
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
  const [shoe, setShoe] = useState<Card[]>(() => prepareShoe()); // ใช้ prepareShoe เพื่อตัดไพ่แต่แรก
  const [currentResult, setCurrentResult] = useState<GameResult | null>(null);
  const [forecastResult, setForecastResult] = useState<GameResult | null>(null);
  const [history, setHistory] = useState<("P" | "B" | "T")[]>([]);
  const [historyStack, setHistoryStack] = useState<{ history: ("P" | "B" | "T")[], result: GameResult | null, roundNumber: number }[]>([]);
  const [isDealing, setIsDealing] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [isEditingRound, setIsEditingRound] = useState(false);
  const [tempRoundNumber, setTempRoundNumber] = useState("1");
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [gameMessage, setGameMessage] = useState<string>(""); // ข้อความแจ้งเตือน (เช่น ตัดไพ่)

  // ... (ส่วน Simulation State และ Logic คงเดิม) ...
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult>({ nextMove: null, ruleName: "Waiting", confidence: 0 });
  const [simStats, setSimStats] = useState<SimulationStats>({ pWins: 0, bWins: 0, tWins: 0, total: 0, pProb: 0, bProb: 0, tProb: 0, exampleHand: null });
  const [analyst, setAnalyst] = useState<AnalystOpinion>({ finalDecision: "รอเริ่มเกม", reasoning: "ระบบพร้อมทำงาน...", riskLevel: "Safe", agreesWithPrediction: true });

  const runSmoothSimulation = useCallback(async (currentShoe: Card[]) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsSimulating(true);
    setProgress(0);
    setForecastResult(null);

    const TOTAL_ROUNDS = 1000000;
    const BATCH_SIZE = 50000;
    const TOTAL_BATCHES = Math.ceil(TOTAL_ROUNDS / BATCH_SIZE);

    let accP = 0, accB = 0, accT = 0;
    let bestExample: GameResult | null = null;

    for (let i = 0; i < TOTAL_BATCHES; i++) {
        if (signal.aborted) return;
        await new Promise(resolve => setTimeout(resolve, 0));
        const batchResult = runSimulation(currentShoe, BATCH_SIZE);
        accP += batchResult.pWins;
        accB += batchResult.bWins;
        accT += batchResult.tWins;
        if (!bestExample && batchResult.exampleHand) bestExample = batchResult.exampleHand;
        setProgress(Math.round(((i + 1) / TOTAL_BATCHES) * 100));
    }

    const total = accP + accB + accT;
    const finalStats: SimulationStats = {
        pWins: accP, bWins: accB, tWins: accT, total,
        pProb: parseFloat(((accP / total) * 100).toFixed(2)),
        bProb: parseFloat(((accB / total) * 100).toFixed(2)),
        tProb: parseFloat(((accT / total) * 100).toFixed(2)),
        exampleHand: bestExample
    };

    setSimStats(finalStats);
    if (bestExample) setForecastResult(bestExample);
    setIsSimulating(false);
    return finalStats;
  }, []);

  useEffect(() => {
    const analyze = async () => {
        const predResult = calculateNextMove(history);
        setPrediction(predResult);
        const simResult = await runSmoothSimulation(shoe);
        if (!simResult) return;

        const simMajority = simResult.pProb > simResult.bProb ? "P" : "B";
        const simDiff = Math.abs(simResult.pProb - simResult.bProb);
        let decision = "";
        let reason = "";
        let risk: "Safe" | "Moderate" | "Risky" = "Moderate";
        let agree = true;

        if (simDiff >= 1.5) {
            decision = `จัด ${simMajority}`;
            reason = `Sim 1M รอบ ชี้ชัด (+${simDiff.toFixed(2)}%)`;
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
        if (history.length > 0 && history[history.length-1] === "T") {
            reason += " (ระวังหลังเสมอ)";
            risk = "Risky";
        }
        setAnalyst({ finalDecision: decision, reasoning: reason, riskLevel: risk, agreesWithPrediction: agree });
    };
    analyze();
  }, [history, shoe, runSmoothSimulation]);

  // Actions
  const dealNewHand = useCallback(() => {
    if (isDealing) return;
    setIsDealing(true);
    setGameMessage(""); // เคลียร์ข้อความเก่า
    
    // Save state before dealing
    setHistoryStack((prev) => [...prev, { history: [...history], result: currentResult, roundNumber }]);

    setTimeout(() => {
      // ตรวจสอบ Cut Card (ถ้าไพ่เหลือน้อยกว่า 10% ของ 8 สำรับ คือประมาณ 40-50 ใบ)
      if (shoe.length < 52) {
          setGameMessage("⚠️ จบขอน (Cut Card Reached)! กรุณาเริ่มเกมใหม่");
          setIsDealing(false);
          return;
      }

      const { result, remainingShoe } = playHand(shoe);
      setShoe(remainingShoe);
      setCurrentResult(result);
      setHistory((prev) => [...prev, result.winner]);
      setRoundNumber((prev) => prev + 1);
      setIsDealing(false);
    }, 300);
  }, [shoe, isDealing, history, currentResult, roundNumber]);

  const handleManualCards = useCallback((playerCards: Card[], bankerCards: Card[]) => {
    // Save state before adding
    setHistoryStack((prev) => [...prev, { history: [...history], result: currentResult, roundNumber }]);
    
    const playerScore = calculateHandValue(playerCards);
    const bankerScore = calculateHandValue(bankerCards);
    let winner: "P" | "B" | "T" = playerScore > bankerScore ? "P" : bankerScore > playerScore ? "B" : "T";
    const result: GameResult = { playerCards, bankerCards, playerScore, bankerScore, winner, isNatural: playerScore >= 8 || bankerScore >= 8 };
    setCurrentResult(result);
    setHistory((prev) => [...prev, winner]);
    setRoundNumber((prev) => prev + 1);
    setShowCardSelector(false);
  }, [history, currentResult, roundNumber]);

  const addQuickResult = (winner: "P" | "B" | "T") => {
    // Save state before adding
    setHistoryStack((prev) => [...prev, { history: [...history], result: currentResult, roundNumber }]);
    
    const { pCards, bCards } = generateMockCards(winner);
    const result = { playerCards: pCards, bankerCards: bCards, playerScore: calculateHandValue(pCards), bankerScore: calculateHandValue(bCards), winner, isNatural: false };
    setCurrentResult(result);
    setHistory((prev) => [...prev, winner]);
    setRoundNumber((prev) => prev + 1);
  };

  const resetGame = useCallback(() => {
    const newShoe = prepareShoe(); // สับและตัดไพ่ใหม่
    setShoe(newShoe);
    
    // คำนวณจำนวนไพ่ที่หายไป (ตัดทิ้ง)
    const initialDeckSize = 8 * 52; 
    const burnedCount = initialDeckSize - newShoe.length;
    
    setGameMessage(`🔄 เริ่มขอนใหม่! ตัดไพ่ทิ้ง ${burnedCount} ใบ`);
    
    setCurrentResult(null);
    setHistory([]);
    setIsDealing(false);
    setRoundNumber(1);
    setShowCardSelector(false);
    setForecastResult(null);
    setSimStats({ pWins: 0, bWins: 0, tWins: 0, total: 0, pProb: 0, bProb: 0, tProb: 0, exampleHand: null });
    
    // ซ่อนข้อความหลังจาก 3 วินาที
    setTimeout(() => setGameMessage(""), 3000);
  }, []);

  const handleEditRound = () => { setTempRoundNumber(roundNumber.toString()); setIsEditingRound(true); };
  const handleSaveRound = () => { const num = parseInt(tempRoundNumber); if (!isNaN(num) && num >= 1) setRoundNumber(num); setIsEditingRound(false); };

  // Undo last result
  const undoLastResult = useCallback(() => {
    if (historyStack.length === 0) return;
    const lastState = historyStack[historyStack.length - 1];
    setHistory(lastState.history);
    setCurrentResult(lastState.result);
    setRoundNumber(lastState.roundNumber);
    setHistoryStack((prev) => prev.slice(0, -1));
  }, [historyStack]);

  // Save state before adding result
  const saveState = useCallback(() => {
    setHistoryStack((prev) => [...prev, { history: [...history], result: currentResult, roundNumber }]);
  }, [history, currentResult, roundNumber]);

  // ... (renderMiniHand และอื่นๆ เหมือนเดิม) ...
  const renderMiniHand = (cards: Card[], score: number, label: string, isWinner: boolean, isPlayer: boolean, isForecast: boolean = false) => (
    <div className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 w-full border-2",
        isWinner && !isForecast ? "border-gold/60 shadow-[0_0_15px_rgba(234,179,8,0.2)] bg-black/40" : 
        isForecast ? "bg-purple-900/10 border-purple-500/20" : 
        (isPlayer ? "bg-player/5 border-player/20" : "bg-banker/5 border-banker/20")
    )}>
      <div className="flex justify-between w-full items-center px-1 mb-2">
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", isPlayer ? "text-player" : "text-banker")}>{label}</span>
        <span className={cn("text-lg font-bold px-2.5 py-0.5 rounded-lg shadow-sm", isPlayer ? "bg-player text-white" : "bg-banker text-white")}>{score}</span>
      </div>
      <div className="flex gap-1 justify-center items-center w-full px-1">
        {cards.map((c, i) => (
          <PlayingCard key={i} suit={c.suit} rank={c.rank} delay={isForecast ? 0 : i * 50} className="w-8 h-12 sm:w-10 sm:h-14 text-[10px] sm:text-xs shadow-md" />
        ))}
        {cards.length === 0 && <div className="w-8 h-12 opacity-0"></div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-table-felt p-2 sm:p-4 lg:p-6 pb-20 font-sans">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header with Shoe Info */}
        <header className="flex flex-wrap justify-between items-center py-2 gap-2 bg-black/20 p-4 rounded-xl border border-white/5">
          <div className="flex items-center gap-3">
              <h1 className="text-xl font-serif font-bold text-gold text-shadow-gold">Baccarat Pro</h1>
              {/* Shoe Status (เพิ่มส่วนนี้) */}
              <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-black/40 px-2 py-1 rounded-full border border-white/10">
                  <Layers className="w-3 h-3" />
                  <span>Shoe: <span className={cn("font-bold", shoe.length < 100 ? "text-red-400" : "text-green-400")}>{shoe.length}</span> cards</span>
              </div>
          </div>
          
          <div className="flex gap-2">
             {/* Message Notification */}
             {gameMessage && (
                 <div className="bg-yellow-500/20 text-yellow-200 px-3 py-1 rounded text-xs animate-pulse border border-yellow-500/30 font-bold">
                     {gameMessage}
                 </div>
             )}
             
             <div className="bg-secondary/50 rounded px-3 py-1 border border-border/50 text-sm text-muted-foreground flex items-center gap-1">Hands: <span className="text-gold font-bold">{history.length}</span></div>
             {isEditingRound ? (
                <div className="flex items-center gap-1 bg-secondary/50 rounded px-2 border border-border/50">
                  <Input type="number" value={tempRoundNumber} onChange={(e) => setTempRoundNumber(e.target.value)} className="w-12 h-6 text-center p-0 bg-transparent border-none text-gold font-bold" onKeyDown={(e) => e.key === "Enter" && handleSaveRound()} />
                  <Check className="h-4 w-4 text-green-500 cursor-pointer" onClick={handleSaveRound} />
                </div>
             ) : (
                <div className="bg-secondary/50 rounded px-3 py-1 border border-border/50 text-sm text-muted-foreground flex items-center gap-1 cursor-pointer hover:bg-secondary/80" onClick={handleEditRound}>Round: <span className="text-gold font-bold">{roundNumber}</span> <Edit2 className="h-3 w-3 ml-1 opacity-50" /></div>
             )}
          </div>
        </header>

        {/* ... Dual Display, Dashboard, Controls, Stats เหมือนเดิม ... */}
        {/* Dual Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card/30 backdrop-blur-md rounded-2xl border border-white/10 p-4 relative overflow-hidden min-h-[180px] flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <div className="bg-black/40 px-3 py-1 text-[10px] text-gray-300 font-bold uppercase rounded-lg border border-white/5 flex items-center gap-2"><Activity className="w-3 h-3 text-green-400" /> Latest Result</div>
                    {currentResult && <div className={cn("text-lg font-serif font-bold animate-in zoom-in", currentResult.winner==="P"?"text-player":currentResult.winner==="B"?"text-banker":"text-tie")}>{currentResult.winner==="P"?"PLAYER WIN":currentResult.winner==="B"?"BANKER WIN":"TIE GAME"}</div>}
                </div>
                <div className="flex-1 flex gap-2 items-center justify-center">
                    {currentResult ? (
                        <>
                            {renderMiniHand(currentResult.playerCards, currentResult.playerScore, "Player", currentResult.winner === "P", true)}
                            {renderMiniHand(currentResult.bankerCards, currentResult.bankerScore, "Banker", currentResult.winner === "B", false)}
                        </>
                    ) : <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm italic border-2 border-dashed border-white/5 rounded-xl">รอผลการเล่น...</div>}
                </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/20 to-black/40 backdrop-blur-md rounded-2xl border border-purple-500/20 p-4 relative overflow-hidden min-h-[180px] flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <div className="bg-purple-900/40 px-3 py-1 text-[10px] text-purple-200 font-bold uppercase rounded-lg border border-purple-500/30 flex items-center gap-2"><Cpu className="w-3 h-3" /> Next Prediction</div>
                    {isSimulating ? (
                        <div className="text-[10px] text-purple-400 flex items-center gap-2 animate-pulse font-bold"><Loader2 className="w-3 h-3 animate-spin"/> {progress}%</div>
                    ) : forecastResult && (
                        <div className="text-[10px] bg-black/40 px-2 py-1 rounded text-gray-400 border border-white/5">P: <span className="text-player font-bold">{simStats.pProb}%</span> | B: <span className="text-banker font-bold">{simStats.bProb}%</span></div>
                    )}
                </div>
                <div className="flex-1 flex gap-2 items-center justify-center relative">
                    {forecastResult ? (
                        <>
                            {renderMiniHand(forecastResult.playerCards, forecastResult.playerScore, "Player", forecastResult.winner === "P", true, true)}
                            {renderMiniHand(forecastResult.bankerCards, forecastResult.bankerScore, "Banker", forecastResult.winner === "B", false, true)}
                        </>
                    ) : <div className="w-full h-full flex items-center justify-center text-purple-400/30 text-sm italic border-2 border-dashed border-purple-500/10 rounded-xl">กำลังคำนวณ...</div>}
                    
                    {isSimulating && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] z-10 rounded-xl flex flex-col items-center justify-center">
                            <div className="w-1/2 h-1 bg-gray-700 rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-purple-500 transition-all duration-100" style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className="text-xs text-purple-300 font-mono">Simulating... {progress}%</span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-black/20 rounded-xl border border-white/5 p-3 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-blue-400" /><span className="text-xs font-bold text-blue-400 uppercase">Formula</span></div>
                <div><div className={cn("text-2xl font-bold", prediction.nextMove==="P"?"text-player":prediction.nextMove==="B"?"text-banker":"text-gray-500")}>{prediction.nextMove || "-"}</div><div className="text-[10px] text-gray-400 truncate">{prediction.ruleName}</div></div>
                <div className="w-full bg-gray-700 h-1 mt-2 rounded-full overflow-hidden"><div className="bg-blue-400 h-full" style={{ width: `${prediction.confidence}%` }}></div></div>
            </div>

            <div className="bg-black/20 rounded-xl border border-white/5 p-3 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-1"><BarChart3 className="w-4 h-4 text-purple-400" /><span className="text-xs font-bold text-purple-400 uppercase">Sim 1M Stats</span></div>
                <div className="flex items-end gap-2 h-12">
                    <div className="flex-1 bg-gray-800 rounded-t relative h-full group"><div className="absolute bottom-0 w-full bg-player transition-all duration-500" style={{ height: `${simStats.pProb}%` }}></div><span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-white mix-blend-difference font-bold">{simStats.pProb}%</span></div>
                    <div className="flex-1 bg-gray-800 rounded-t relative h-full group"><div className="absolute bottom-0 w-full bg-tie/50 transition-all duration-500" style={{ height: `${simStats.tProb}%` }}></div><span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-white mix-blend-difference font-bold">{simStats.tProb}%</span></div>
                    <div className="flex-1 bg-gray-800 rounded-t relative h-full group"><div className="absolute bottom-0 w-full bg-banker transition-all duration-500" style={{ height: `${simStats.bProb}%` }}></div><span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-white mix-blend-difference font-bold">{simStats.bProb}%</span></div>
                </div>
            </div>

            <div className="md:col-span-2 lg:col-span-1 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl border border-gold/30 p-3 flex items-center gap-3 shadow-lg">
                <div className="bg-gold/10 p-2 rounded-full"><BrainCircuit className="w-6 h-6 text-gold" /></div>
                <div>
                    <div className="text-[10px] text-gold uppercase font-bold">AI Recommendation</div>
                    <div className="text-xl font-bold text-white flex items-center gap-2"><ArrowRightCircle className={cn("w-5 h-5", analyst.riskLevel==="Safe"?"text-green-500":analyst.riskLevel==="Moderate"?"text-yellow-500":"text-red-500")} />{analyst.finalDecision}</div>
                    <div className="text-[10px] text-gray-400 mt-1 leading-tight line-clamp-2">"{analyst.reasoning}"</div>
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="bg-secondary/30 rounded-xl border border-white/5 p-3 flex flex-col gap-3">
             <div className="flex gap-2">
                <Button onClick={() => addQuickResult("P")} disabled={isSimulating} className="flex-1 bg-player hover:bg-player/80 h-12 text-xl font-bold shadow-lg border-b-4 border-player/50 active:border-b-0 active:translate-y-1">P</Button>
                <Button onClick={() => addQuickResult("T")} disabled={isSimulating} className="flex-1 bg-tie hover:bg-tie/80 h-12 text-xl font-bold shadow-lg border-b-4 border-tie/50 active:border-b-0 active:translate-y-1">T</Button>
                <Button onClick={() => addQuickResult("B")} disabled={isSimulating} className="flex-1 bg-banker hover:bg-banker/80 h-12 text-xl font-bold shadow-lg border-b-4 border-banker/50 active:border-b-0 active:translate-y-1">B</Button>
             </div>
             <div className="flex gap-2">
                <Button onClick={dealNewHand} disabled={isDealing || isSimulating} className="flex-1 bg-gold-gradient text-black hover:opacity-90 font-bold shadow-lg h-10"><PlayCircle className="mr-2 w-4 h-4"/> Deal</Button>
                <Button onClick={undoLastResult} disabled={historyStack.length === 0 || isSimulating} variant="ghost" size="icon" className="border border-white/10 text-yellow-400 h-10 w-12" title="ย้อนกลับ"><Undo2 className="w-4 h-4"/></Button>
                <Button onClick={() => setShowCardSelector(true)} variant="ghost" size="icon" className="border border-white/10 h-10 w-12"><Settings2 className="w-4 h-4"/></Button>
                <Button onClick={resetGame} variant="ghost" size="icon" className="border border-white/10 text-red-400 h-10 w-12"><RotateCcw className="w-4 h-4"/></Button>
             </div>
        </div>

        {showCardSelector && <CardSelector onConfirm={handleManualCards} onCancel={() => setShowCardSelector(false)} />}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Statistics history={history} /><ScoreBoard history={history} /></div>
      </div>
    </div>
  );
};