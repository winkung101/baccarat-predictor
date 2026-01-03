import { useState, useCallback, useEffect } from "react";
import { PlayingCard } from "./PlayingCard";
import { ScoreBoard } from "./ScoreBoard";
import { Statistics } from "./Statistics";
import { CardSelector } from "./CardSelector";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, GameResult, createShoe, playHand, calculateHandValue, Suit } from "@/lib/baccarat";
import { cn } from "@/lib/utils";
import { RotateCcw, PlayCircle, Edit2, Check, Settings2, Sparkles, BrainCircuit, Activity, Undo2, AlertTriangle } from "lucide-react";

const suitSymbols: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

// Helper function for mock cards
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

type AIAnalysis = {
  trend: string;
  comment: string;
  riskLevel: "Low" | "Medium" | "High";
  recommendation: string;
  statComparison: string;
};

export const BaccaratGame = () => {
  // Game State
  const [shoe, setShoe] = useState<Card[]>(() => createShoe());
  const [currentResult, setCurrentResult] = useState<GameResult | null>(null);
  const [history, setHistory] = useState<("P" | "B" | "T")[]>([]);
  const [isDealing, setIsDealing] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [isEditingRound, setIsEditingRound] = useState(false);
  const [tempRoundNumber, setTempRoundNumber] = useState("1");
  const [showCardSelector, setShowCardSelector] = useState(false);

  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis>({
    trend: "กำลังเก็บข้อมูล...",
    comment: "เริ่มเกมใหม่ AI กำลังจับตาดูรูปแบบไพ่",
    riskLevel: "Low",
    recommendation: "รอดูสถานการณ์",
    statComparison: "-"
  });

  // --- AI LOGIC CORE ---
  const analyzeGame = useCallback((currentHistory: ("P" | "B" | "T")[]) => {
    if (currentHistory.length === 0) {
      setAiAnalysis({ trend: "รอข้อมูล", comment: "พร้อมวิเคราะห์ เริ่มเกมได้เลยครับ", riskLevel: "Low", recommendation: "รอดูสถานการณ์", statComparison: "-" });
      return;
    }

    const total = currentHistory.length;
    const pCount = currentHistory.filter(r => r === "P").length;
    const bCount = currentHistory.filter(r => r === "B").length;
    const tCount = currentHistory.filter(r => r === "T").length;

    const cleanHistory = currentHistory.filter(r => r !== 'T');
    const last = cleanHistory[cleanHistory.length - 1];
    
    // 1. Analyze Streak (Dragon)
    let streak = 0;
    for (let i = cleanHistory.length - 1; i >= 0; i--) {
      if (cleanHistory[i] === last) streak++;
      else break;
    }

    // 2. Analyze Ping Pong
    let isPingPong = false;
    if (cleanHistory.length >= 4) {
      const len = cleanHistory.length;
      if (cleanHistory[len-1] !== cleanHistory[len-2] && 
          cleanHistory[len-2] !== cleanHistory[len-3] && 
          cleanHistory[len-3] !== cleanHistory[len-4]) {
        isPingPong = true;
      }
    }

    // 3. Statistical Comparison (Theoretical: B ~45.8%, P ~44.6%)
    const pPercent = (pCount / total) * 100;
    const bPercent = (bCount / total) * 100;
    let statMsg = "";
    
    if (Math.abs(pPercent - bPercent) < 5) statMsg = "สถิติสูสีกันมาก (Balanced)";
    else if (pPercent > 55) statMsg = "Player ออกเยอะกว่าปกติ (+10%)";
    else if (bPercent > 55) statMsg = "Banker ออกเยอะกว่าปกติ (+10%)";
    else statMsg = "สถิติอยู่ในเกณฑ์ปกติ";

    // 4. Generate Comment & Recommendation
    let trendText = "";
    let commentText = "";
    let risk: "Low" | "Medium" | "High" = "Medium";
    let rec = "";

    if (streak >= 5) {
      trendText = `มังกร ${last === "P" ? "น้ำเงิน" : "แดง"} (Dragon)`;
      commentText = `โหดมาก! ${last === "P" ? "Player" : "Banker"} มาติดกัน ${streak} ตาแล้ว สถิติแบบนี้หายาก AI แนะนำว่า "อย่าสวน" จนกว่าไพ่จะเปลี่ยนเอง`;
      risk = "High";
      rec = `ตาม ${last} ต่อไป (Follow)`;
    } else if (isPingPong) {
      trendText = "ปิงปอง (Ping Pong)";
      commentText = "ไพ่สลับไปมาสวยงามมาก (P-B-P-B) ช่วงนี้เดาทางง่าย ให้แทงสลับสีไปเรื่อยๆ";
      risk = "Low";
      rec = last === "P" ? "แทง B (Banker)" : "แทง P (Player)";
    } else if (streak === 1 && !isPingPong) {
        // Choppy / Second stage
        const prev = cleanHistory[cleanHistory.length - 2];
        const prev2 = cleanHistory[cleanHistory.length - 3];
        // Check for 2-2-2 pattern
        if (cleanHistory.length >= 4 && cleanHistory[cleanHistory.length-1] === cleanHistory[cleanHistory.length-2]) {
             trendText = "ไพ่คู่ (Double Stick)";
             commentText = "ดูเหมือนไพ่จะเริ่มจับคู่ 2 ตัด ลองตามดูว่าจะเป็น 2 ตัวติดจริงไหม";
             rec = last === "P" ? "แทง P อีกที" : "แทง B อีกที";
             risk = "Medium";
        } else {
             trendText = "ไพ่เละ/ไม่มีเค้า (Choppy)";
             commentText = "ช่วงนี้ไพ่เหวี่ยงมาก ไม่มีรูปแบบชัดเจน แนะนำให้พักรอดูก่อน หรือเล่นเบาๆ";
             risk = "High";
             rec = "รอ (Wait)";
        }
    } else {
      trendText = `ไหล ${last === "P" ? "น้ำเงิน" : "แดง"} (${streak})`;
      commentText = `${last === "P" ? "Player" : "Banker"} เริ่มไหลมา ${streak} ตาติด ทรงไพ่ดูดี`;
      risk = "Medium";
      rec = `ตาม ${last} (Follow)`;
    }

    // Special case: Tie
    if (currentHistory[currentHistory.length - 1] === "T") {
        commentText += " (ล่าสุดออกเสมอ ระวังเค้าไพ่เปลี่ยน!)";
        risk = "High";
    }

    setAiAnalysis({
      trend: trendText,
      comment: commentText,
      riskLevel: risk,
      recommendation: rec,
      statComparison: statMsg
    });

  }, []);

  useEffect(() => {
    analyzeGame(history);
  }, [history, analyzeGame]);

  // --- GAMEPLAY FUNCTIONS ---

  const dealNewHand = useCallback(() => {
    if (isDealing) return;
    setIsDealing(true);
    setCurrentResult(null);

    setTimeout(() => {
      const { result, remainingShoe } = playHand(shoe);
      setShoe(remainingShoe);
      setCurrentResult(result);
      setHistory((prev) => [...prev, result.winner]);
      setRoundNumber((prev) => prev + 1);
      setIsDealing(false);
    }, 400);
  }, [shoe, isDealing]);

  const handleManualCards = useCallback((playerCards: Card[], bankerCards: Card[]) => {
    const playerScore = calculateHandValue(playerCards);
    const bankerScore = calculateHandValue(bankerCards);
    
    let winner: "P" | "B" | "T";
    if (playerScore > bankerScore) winner = "P";
    else if (bankerScore > playerScore) winner = "B";
    else winner = "T";

    const isNatural = calculateHandValue(playerCards.slice(0, 2)) >= 8 || calculateHandValue(bankerCards.slice(0, 2)) >= 8;

    const result: GameResult = { playerCards, bankerCards, playerScore, bankerScore, winner, isNatural };

    setCurrentResult(result);
    setHistory((prev) => [...prev, winner]);
    setRoundNumber((prev) => prev + 1);
    setShowCardSelector(false);
  }, []);

  const addManualResult = (winner: "P" | "B" | "T") => {
    setHistory((prev) => [...prev, winner]);
    setRoundNumber((prev) => prev + 1);
    
    const { pCards, bCards } = generateMockCards(winner);
    const pScore = calculateHandValue(pCards);
    const bScore = calculateHandValue(bCards);

    setCurrentResult({
        playerCards: pCards,
        bankerCards: bCards,
        playerScore: pScore,
        bankerScore: bScore,
        winner: winner,
        isNatural: pScore >= 8 || bScore >= 8
    });
  };

  const undoLastHand = () => {
    if (history.length === 0) return;
    setHistory((prev) => prev.slice(0, -1));
    setRoundNumber((prev) => Math.max(1, prev - 1));
    setCurrentResult(null);
  };

  const resetGame = useCallback(() => {
    setShoe(createShoe());
    setCurrentResult(null);
    setHistory([]);
    setIsDealing(false);
    setRoundNumber(1);
    setShowCardSelector(false);
  }, []);

  // --- UI RENDER HELPERS ---

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

  const renderHand = (cards: Card[], score: number, label: string, isWinner: boolean, isPlayer: boolean) => (
    <div className={cn(
      "flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-300",
      isWinner && "win-pulse",
      isPlayer ? "bg-player/10" : "bg-banker/10"
    )}>
      <div className={cn("text-xl sm:text-2xl font-serif font-bold", isPlayer ? "text-player" : "text-banker")}>{label}</div>
      <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
        {cards.map((card, index) => (
          <PlayingCard key={`${card.suit}-${card.rank}-${index}`} suit={card.suit} rank={card.rank} delay={index * 150 + (isPlayer ? 0 : 300)} />
        ))}
      </div>
      <div className={cn("text-3xl sm:text-4xl font-bold mt-2 px-6 py-2 rounded-full", isPlayer ? "bg-player text-player-foreground" : "bg-banker text-banker-foreground", isWinner && "glow-pulse")}>
        {score}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-table-felt p-2 sm:p-4 lg:p-6 pb-20">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header */}
        <header className="flex justify-between items-center py-2">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gold text-shadow-gold">Baccarat Analyst</h1>
          <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-full border border-white/10">
            <span className="text-muted-foreground text-sm">Round:</span>
            <span className="text-gold font-bold">{roundNumber}</span>
          </div>
        </header>

        {/* AI Analysis Panel (ไฮไลท์ของเวอร์ชันนี้) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Main AI Comment */}
            <div className="md:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gold/40 p-5 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-5"><BrainCircuit className="w-32 h-32 text-gold" /></div>
                
                <div className="flex items-start gap-4 relative z-10">
                    <div className="bg-gold/20 p-3 rounded-full animate-pulse">
                        <Sparkles className="w-6 h-6 text-gold" />
                    </div>
                    <div className="space-y-2 flex-1">
                        <h3 className="text-gold font-serif font-bold text-lg">AI Opinion (ความคิดเห็น AI)</h3>
                        <p className="text-white text-lg leading-relaxed font-medium">"{aiAnalysis.comment}"</p>
                        
                        <div className="flex flex-wrap gap-3 mt-4">
                            <div className="bg-black/30 px-3 py-1 rounded text-sm text-gray-300 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-400" /> 
                                Trend: <span className="text-white font-bold">{aiAnalysis.trend}</span>
                            </div>
                            <div className="bg-black/30 px-3 py-1 rounded text-sm text-gray-300">
                                Stat: <span className="text-white">{aiAnalysis.statComparison}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recommendation Box */}
            <div className={cn(
                "rounded-xl border p-5 flex flex-col justify-center items-center text-center shadow-xl relative overflow-hidden",
                aiAnalysis.riskLevel === "Low" ? "bg-green-900/20 border-green-500/30" :
                aiAnalysis.riskLevel === "Medium" ? "bg-yellow-900/20 border-yellow-500/30" :
                "bg-red-900/20 border-red-500/30"
            )}>
                <div className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Recommendation</div>
                <div className={cn(
                    "text-2xl font-bold mb-2",
                    aiAnalysis.recommendation.includes("P") ? "text-player" :
                    aiAnalysis.recommendation.includes("B") ? "text-banker" : "text-white"
                )}>
                    {aiAnalysis.recommendation}
                </div>
                
                <div className="flex items-center gap-2 mt-2 text-sm">
                    <AlertTriangle className={cn("w-4 h-4", 
                        aiAnalysis.riskLevel === "Low" ? "text-green-500" : 
                        aiAnalysis.riskLevel === "Medium" ? "text-yellow-500" : "text-red-500"
                    )} />
                    <span className="text-muted-foreground">Risk Level:</span>
                    <span className={cn("font-bold",
                        aiAnalysis.riskLevel === "Low" ? "text-green-400" : 
                        aiAnalysis.riskLevel === "Medium" ? "text-yellow-400" : "text-red-400"
                    )}>{aiAnalysis.riskLevel}</span>
                </div>
            </div>
        </div>

        {/* Manual Inputs & Controls */}
        <div className="bg-secondary/30 rounded-lg p-3 border border-white/5 flex flex-wrap justify-center items-center gap-4">
            <div className="flex gap-2">
                <Button onClick={() => addManualResult("P")} className="bg-player hover:bg-player/80 w-16 h-12 font-bold shadow-lg shadow-player/20 border-b-4 border-player/50 active:border-b-0 active:translate-y-1">P</Button>
                <Button onClick={() => addManualResult("T")} className="bg-tie hover:bg-tie/80 w-12 h-12 font-bold shadow-lg shadow-tie/20 border-b-4 border-tie/50 active:border-b-0 active:translate-y-1">T</Button>
                <Button onClick={() => addManualResult("B")} className="bg-banker hover:bg-banker/80 w-16 h-12 font-bold shadow-lg shadow-banker/20 border-b-4 border-banker/50 active:border-b-0 active:translate-y-1">B</Button>
            </div>
            
            <div className="h-8 w-px bg-white/10 hidden sm:block"></div>
            
            <div className="flex gap-2">
                <Button onClick={dealNewHand} disabled={isDealing} className="bg-gold-gradient text-black hover:opacity-90 min-w-[120px] h-12 font-bold shadow-gold/20 shadow-lg">
                    <PlayCircle className="mr-2 h-5 w-5" /> SIM (สุ่ม)
                </Button>
                <Button onClick={undoLastHand} variant="secondary" size="icon" className="h-12 w-12" disabled={history.length === 0}><Undo2 className="h-5 w-5"/></Button>
                <Button onClick={() => setShowCardSelector(true)} variant="ghost" size="icon" className="h-12 w-12"><Settings2 className="h-5 w-5"/></Button>
                <Button onClick={resetGame} variant="ghost" size="icon" className="h-12 w-12 text-red-400"><RotateCcw className="h-5 w-5"/></Button>
            </div>
        </div>

        {/* Card Selector Modal */}
        {showCardSelector && <CardSelector onConfirm={handleManualCards} onCancel={() => setShowCardSelector(false)} />}

        {/* Game Table (Simulation) */}
        {!showCardSelector && (
          <div className="bg-card/30 backdrop-blur rounded-2xl border border-gold/20 p-4 relative min-h-[300px] flex flex-col justify-center">
            {/* Winner Text */}
            <div className="h-12 flex items-center justify-center mb-4">
                {currentResult ? getWinnerText() : <div className="text-muted-foreground/40 text-lg animate-pulse">Waiting for result...</div>}
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {currentResult ? (
                <>
                  {renderHand(currentResult.playerCards, currentResult.playerScore, "PLAYER", currentResult.winner === "P", true)}
                  {renderHand(currentResult.bankerCards, currentResult.bankerScore, "BANKER", currentResult.winner === "B", false)}
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-player/5 min-h-[180px] justify-center border-2 border-dashed border-player/10 opacity-50"><div className="text-xl font-bold text-player">PLAYER</div></div>
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-banker/5 min-h-[180px] justify-center border-2 border-dashed border-banker/10 opacity-50"><div className="text-xl font-bold text-banker">BANKER</div></div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Stats and Scoreboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Statistics history={history} />
          <ScoreBoard history={history} />
        </div>
      </div>
    </div>
  );
};