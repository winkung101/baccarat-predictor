import { useState } from "react";
import { Card, Rank, Suit, calculateHandValue, shouldPlayerDraw, shouldBankerDraw } from "@/lib/baccarat";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface CardSelectorProps {
  onConfirm: (playerCards: Card[], bankerCards: Card[]) => void;
  onCancel: () => void;
}

const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const suitSymbols: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const suitColors: Record<Suit, string> = {
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-foreground",
  spades: "text-foreground",
};

const getCardValue = (rank: Rank): number => {
  if (rank === "A") return 1;
  if (["10", "J", "Q", "K"].includes(rank)) return 0;
  return parseInt(rank);
};

export const CardSelector = ({ onConfirm, onCancel }: CardSelectorProps) => {
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [bankerCards, setBankerCards] = useState<Card[]>([]);
  const [selectingFor, setSelectingFor] = useState<"player" | "banker">("player");

  const playerScore = calculateHandValue(playerCards);
  const bankerScore = calculateHandValue(bankerCards);

  // Determine if third card is needed
  const isNatural = playerCards.length >= 2 && bankerCards.length >= 2 && 
    (calculateHandValue(playerCards.slice(0, 2)) >= 8 || calculateHandValue(bankerCards.slice(0, 2)) >= 8);

  const playerNeedsThird = playerCards.length === 2 && bankerCards.length >= 2 && !isNatural && shouldPlayerDraw(playerScore);
  const bankerNeedsThird = bankerCards.length === 2 && !isNatural && 
    (playerCards.length === 2 || playerCards.length === 3) &&
    shouldBankerDraw(bankerScore, playerCards.length === 3 ? playerCards[2] : null);

  const canConfirm = playerCards.length >= 2 && bankerCards.length >= 2 &&
    (!playerNeedsThird || playerCards.length === 3) &&
    (!bankerNeedsThird || bankerCards.length === 3);

  const addCard = (suit: Suit, rank: Rank) => {
    const card: Card = { suit, rank, value: getCardValue(rank) };
    
    if (selectingFor === "player") {
      if (playerCards.length < 3) {
        setPlayerCards([...playerCards, card]);
        // Switch to banker after 2 player cards
        if (playerCards.length === 1) {
          setSelectingFor("banker");
        }
      }
    } else {
      if (bankerCards.length < 3) {
        setBankerCards([...bankerCards, card]);
        // Switch back to player for third card if needed
        if (bankerCards.length === 1 && playerCards.length === 2) {
          // Check if player needs third card
          const pScore = calculateHandValue(playerCards);
          const bScore = calculateHandValue([...bankerCards, card]);
          if (pScore < 8 && bScore < 8 && shouldPlayerDraw(pScore)) {
            setSelectingFor("player");
          }
        }
      }
    }
  };

  const removeCard = (side: "player" | "banker", index: number) => {
    if (side === "player") {
      setPlayerCards(playerCards.filter((_, i) => i !== index));
    } else {
      setBankerCards(bankerCards.filter((_, i) => i !== index));
    }
  };

  const handleConfirm = () => {
    onConfirm(playerCards, bankerCards);
  };

  const renderSelectedCards = (cards: Card[], side: "player" | "banker") => (
    <div className="flex gap-2 flex-wrap min-h-[40px]">
      {cards.map((card, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded bg-background/80 border",
            side === "player" ? "border-player/50" : "border-banker/50"
          )}
        >
          <span className={cn("font-mono font-bold", suitColors[card.suit])}>
            {card.rank}{suitSymbols[card.suit]}
          </span>
          <button
            onClick={() => removeCard(side, i)}
            className="text-muted-foreground hover:text-destructive ml-1"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {cards.length === 0 && (
        <span className="text-muted-foreground text-sm">ยังไม่มีไพ่</span>
      )}
    </div>
  );

  return (
    <div className="bg-card/90 backdrop-blur rounded-2xl border border-gold/30 p-4 sm:p-6 space-y-4">
      <h3 className="text-gold font-serif text-xl text-center">ตั้งค่าไพ่</h3>

      {/* Selected Cards Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div 
          className={cn(
            "p-3 rounded-lg border-2 cursor-pointer transition-all",
            selectingFor === "player" ? "border-player bg-player/10" : "border-border/50 bg-secondary/30"
          )}
          onClick={() => playerCards.length < 3 && setSelectingFor("player")}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-player font-semibold">Player</span>
            <span className="text-player font-bold">= {playerScore}</span>
          </div>
          {renderSelectedCards(playerCards, "player")}
          {playerCards.length < 3 && selectingFor === "player" && (
            <div className="text-xs text-muted-foreground mt-2">กำลังเลือกไพ่...</div>
          )}
        </div>

        <div 
          className={cn(
            "p-3 rounded-lg border-2 cursor-pointer transition-all",
            selectingFor === "banker" ? "border-banker bg-banker/10" : "border-border/50 bg-secondary/30"
          )}
          onClick={() => bankerCards.length < 3 && setSelectingFor("banker")}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-banker font-semibold">Banker</span>
            <span className="text-banker font-bold">= {bankerScore}</span>
          </div>
          {renderSelectedCards(bankerCards, "banker")}
          {bankerCards.length < 3 && selectingFor === "banker" && (
            <div className="text-xs text-muted-foreground mt-2">กำลังเลือกไพ่...</div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center text-sm text-muted-foreground">
        {playerCards.length < 2 && "เลือกไพ่ Player 2 ใบ"}
        {playerCards.length >= 2 && bankerCards.length < 2 && "เลือกไพ่ Banker 2 ใบ"}
        {playerCards.length >= 2 && bankerCards.length >= 2 && !canConfirm && (
          playerNeedsThird ? "เลือกไพ่ใบที่ 3 ของ Player" : 
          bankerNeedsThird ? "เลือกไพ่ใบที่ 3 ของ Banker" : ""
        )}
        {canConfirm && "พร้อมยืนยันผล"}
      </div>

      {/* Card Picker */}
      <div className="bg-secondary/50 rounded-lg p-3">
        <div className="grid grid-cols-13 gap-1">
          {suits.map((suit) => (
            ranks.map((rank) => (
              <button
                key={`${suit}-${rank}`}
                onClick={() => addCard(suit, rank)}
                className={cn(
                  "p-1 sm:p-2 rounded text-xs sm:text-sm font-mono font-bold",
                  "bg-background/80 hover:bg-background border border-border/50",
                  "transition-all hover:scale-105",
                  suitColors[suit]
                )}
              >
                {rank}
                <span className="hidden sm:inline">{suitSymbols[suit]}</span>
              </button>
            ))
          ))}
        </div>
      </div>

      {/* Quick Suit Selector (Mobile Friendly) */}
      <div className="flex justify-center gap-2 sm:hidden">
        {suits.map((suit) => (
          <div key={suit} className={cn("text-2xl", suitColors[suit])}>
            {suitSymbols[suit]}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-muted-foreground/50 text-muted-foreground"
        >
          ยกเลิก
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="bg-gold-gradient text-primary-foreground"
        >
          ยืนยันผล
        </Button>
      </div>
    </div>
  );
};
