import { useState, useCallback } from "react";
import { PlayingCard } from "./PlayingCard";
import { ScoreBoard } from "./ScoreBoard";
import { Statistics } from "./Statistics";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, GameResult, createShoe, playHand } from "@/lib/baccarat";
import { cn } from "@/lib/utils";
import { RotateCcw, PlayCircle, Edit2, Check } from "lucide-react";

const suitSymbols: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const formatCard = (card: Card) => `${card.rank}${suitSymbols[card.suit]}`;

export const BaccaratGame = () => {
  const [shoe, setShoe] = useState<Card[]>(() => createShoe());
  const [currentResult, setCurrentResult] = useState<GameResult | null>(null);
  const [history, setHistory] = useState<("P" | "B" | "T")[]>([]);
  const [isDealing, setIsDealing] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);
  const [isEditingRound, setIsEditingRound] = useState(false);
  const [tempRoundNumber, setTempRoundNumber] = useState("1");

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
    }, 300);
  }, [shoe, isDealing]);

  const resetGame = useCallback(() => {
    setShoe(createShoe());
    setCurrentResult(null);
    setHistory([]);
    setIsDealing(false);
    setRoundNumber(1);
  }, []);

  const handleEditRound = () => {
    setTempRoundNumber(roundNumber.toString());
    setIsEditingRound(true);
  };

  const handleSaveRound = () => {
    const num = parseInt(tempRoundNumber);
    if (!isNaN(num) && num >= 1) {
      setRoundNumber(num);
    }
    setIsEditingRound(false);
  };

  const renderHand = (cards: Card[], score: number, label: string, isWinner: boolean, isPlayer: boolean) => (
    <div className={cn(
      "flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-300",
      isWinner && "win-pulse",
      isPlayer ? "bg-player/10" : "bg-banker/10"
    )}>
      <div className={cn(
        "text-xl sm:text-2xl font-serif font-bold",
        isPlayer ? "text-player" : "text-banker"
      )}>
        {label}
      </div>

      <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
        {cards.map((card, index) => (
          <PlayingCard
            key={`${card.suit}-${card.rank}-${index}`}
            suit={card.suit}
            rank={card.rank}
            delay={index * 150 + (isPlayer ? 0 : 300)}
          />
        ))}
      </div>

      <div className={cn(
        "text-3xl sm:text-4xl font-bold mt-2 px-6 py-2 rounded-full",
        isPlayer ? "bg-player text-player-foreground" : "bg-banker text-banker-foreground",
        isWinner && "glow-pulse"
      )}>
        {score}
      </div>
    </div>
  );

  const getWinnerText = () => {
    if (!currentResult) return null;
    const { winner, isNatural } = currentResult;

    let text = "";
    let colorClass = "";

    if (winner === "P") {
      text = "PLAYER WINS!";
      colorClass = "text-player";
    } else if (winner === "B") {
      text = "BANKER WINS!";
      colorClass = "text-banker";
    } else {
      text = "TIE!";
      colorClass = "text-tie";
    }

    return (
      <div className="slide-up text-center">
        <div className={cn("text-2xl sm:text-4xl font-serif font-bold", colorClass)}>
          {text}
        </div>
        {isNatural && (
          <div className="text-gold text-lg sm:text-xl mt-1">Natural!</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-table-felt p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="text-center py-4">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-gold text-shadow-gold">
            Baccarat Simulator
          </h1>
          
          {/* Game Info */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-4">
            {/* Round Number - Editable */}
            <div className="bg-secondary/50 rounded-lg px-4 py-2 border border-border/50 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">รอบที่</span>
              {isEditingRound ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={tempRoundNumber}
                    onChange={(e) => setTempRoundNumber(e.target.value)}
                    className="w-16 h-8 text-center bg-background/50 border-gold/30 text-gold font-bold"
                    min={1}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveRound()}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveRound}
                    className="h-8 w-8 p-0 text-gold hover:bg-gold/20"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-gold font-bold text-xl">{roundNumber}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditRound}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-gold hover:bg-gold/20"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className="bg-secondary/50 rounded-lg px-4 py-2 border border-border/50">
              <span className="text-muted-foreground text-sm">เปิดไปแล้ว</span>
              <span className="text-gold font-bold text-xl ml-2">{history.length}</span>
              <span className="text-muted-foreground text-sm ml-1">มือ</span>
            </div>
            
            <div className="bg-secondary/50 rounded-lg px-4 py-2 border border-border/50">
              <span className="text-muted-foreground text-sm">ไพ่เหลือ</span>
              <span className="text-gold font-bold text-xl ml-2">{shoe.length}</span>
              <span className="text-muted-foreground text-sm ml-1">ใบ</span>
            </div>
          </div>
        </header>

        {/* Current Cards Display */}
        {currentResult && (
          <div className="bg-secondary/30 rounded-xl border border-gold/20 p-4">
            <h3 className="text-gold font-serif text-lg text-center mb-3">ไพ่ที่เปิด (รอบที่ {roundNumber - 1})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Player Cards */}
              <div className="flex items-center justify-center gap-2 bg-player/10 rounded-lg p-3">
                <span className="text-player font-semibold">P:</span>
                <div className="flex gap-2">
                  {currentResult.playerCards.map((card, i) => (
                    <span 
                      key={i} 
                      className={cn(
                        "font-mono text-lg font-bold px-2 py-1 bg-background/80 rounded",
                        card.suit === "hearts" || card.suit === "diamonds" ? "text-red-500" : "text-foreground"
                      )}
                    >
                      {formatCard(card)}
                    </span>
                  ))}
                </div>
                <span className="text-player font-bold ml-2">= {currentResult.playerScore}</span>
              </div>
              
              {/* Banker Cards */}
              <div className="flex items-center justify-center gap-2 bg-banker/10 rounded-lg p-3">
                <span className="text-banker font-semibold">B:</span>
                <div className="flex gap-2">
                  {currentResult.bankerCards.map((card, i) => (
                    <span 
                      key={i} 
                      className={cn(
                        "font-mono text-lg font-bold px-2 py-1 bg-background/80 rounded",
                        card.suit === "hearts" || card.suit === "diamonds" ? "text-red-500" : "text-foreground"
                      )}
                    >
                      {formatCard(card)}
                    </span>
                  ))}
                </div>
                <span className="text-banker font-bold ml-2">= {currentResult.bankerScore}</span>
              </div>
            </div>
          </div>
        )}

        {/* Game Table */}
        <div className="bg-card/30 backdrop-blur rounded-2xl border border-gold/20 p-4 sm:p-6 lg:p-8">
          {/* Winner Announcement */}
          <div className="h-16 sm:h-20 flex items-center justify-center mb-4">
            {currentResult && getWinnerText()}
          </div>

          {/* Cards Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-12">
            {currentResult ? (
              <>
                {renderHand(
                  currentResult.playerCards,
                  currentResult.playerScore,
                  "PLAYER",
                  currentResult.winner === "P",
                  true
                )}
                {renderHand(
                  currentResult.bankerCards,
                  currentResult.bankerScore,
                  "BANKER",
                  currentResult.winner === "B",
                  false
                )}
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-player/10 min-h-[200px] justify-center">
                  <div className="text-xl sm:text-2xl font-serif font-bold text-player">PLAYER</div>
                  <div className="text-muted-foreground">กดปุ่มเพื่อเริ่มเกม</div>
                </div>
                <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-banker/10 min-h-[200px] justify-center">
                  <div className="text-xl sm:text-2xl font-serif font-bold text-banker">BANKER</div>
                  <div className="text-muted-foreground">กดปุ่มเพื่อเริ่มเกม</div>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button
              onClick={dealNewHand}
              disabled={isDealing}
              className="bg-gold-gradient text-primary-foreground hover:opacity-90 text-lg px-8 py-6 font-semibold glow-pulse"
            >
              <PlayCircle className="mr-2 h-6 w-6" />
              {isDealing ? "กำลังแจก..." : "เปิดไพ่"}
            </Button>

            <Button
              onClick={resetGame}
              variant="outline"
              className="border-gold/50 text-gold hover:bg-gold/10 text-lg px-8 py-6"
            >
              <RotateCcw className="mr-2 h-5 w-5" />
              เริ่มใหม่
            </Button>
          </div>
        </div>

        {/* Stats and Scoreboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Statistics history={history} />
          <ScoreBoard history={history} />
        </div>
      </div>
    </div>
  );
};
