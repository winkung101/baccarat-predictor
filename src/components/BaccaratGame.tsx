import { useState, useCallback } from "react";
import { PlayingCard } from "./PlayingCard";
import { ScoreBoard } from "./ScoreBoard";
import { Statistics } from "./Statistics";
import { Button } from "./ui/button";
import { Card, GameResult, createShoe, playHand } from "@/lib/baccarat";
import { cn } from "@/lib/utils";
import { RotateCcw, PlayCircle } from "lucide-react";

export const BaccaratGame = () => {
  const [shoe, setShoe] = useState<Card[]>(() => createShoe());
  const [currentResult, setCurrentResult] = useState<GameResult | null>(null);
  const [history, setHistory] = useState<("P" | "B" | "T")[]>([]);
  const [isDealing, setIsDealing] = useState(false);

  const dealNewHand = useCallback(() => {
    if (isDealing) return;

    setIsDealing(true);
    setCurrentResult(null);

    setTimeout(() => {
      const { result, remainingShoe } = playHand(shoe);
      setShoe(remainingShoe);
      setCurrentResult(result);
      setHistory((prev) => [...prev, result.winner]);
      setIsDealing(false);
    }, 300);
  }, [shoe, isDealing]);

  const resetGame = useCallback(() => {
    setShoe(createShoe());
    setCurrentResult(null);
    setHistory([]);
    setIsDealing(false);
  }, []);

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
          <p className="text-muted-foreground mt-2">
            Cards in shoe: <span className="text-gold">{shoe.length}</span>
          </p>
        </header>

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
