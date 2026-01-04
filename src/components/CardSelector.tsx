import { useState, useEffect } from "react";
import { Card, Rank, Suit, calculateHandValue, shouldPlayerDraw, shouldBankerDraw } from "@/lib/baccarat";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { X, Check } from "lucide-react";

interface CardSelectorProps {
  onConfirm: (playerCards: Card[], bankerCards: Card[]) => void;
  onCancel: () => void;
}

const suits: Suit[] = ["spades", "hearts", "clubs", "diamonds"];
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
  clubs: "text-slate-900 dark:text-slate-100",
  spades: "text-slate-900 dark:text-slate-100",
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

  // Logic ตรวจสอบไพ่ใบที่ 3
  const isNatural = playerCards.length >= 2 && bankerCards.length >= 2 && 
    (calculateHandValue(playerCards.slice(0, 2)) >= 8 || calculateHandValue(bankerCards.slice(0, 2)) >= 8);

  const playerNeedsThird = playerCards.length === 2 && bankerCards.length >= 2 && !isNatural && shouldPlayerDraw(playerScore);
  
  // Banker จะจั่วหรือไม่ ขึ้นอยู่กับไพ่ใบที่ 3 ของ Player (ถ้ามี)
  const bankerNeedsThird = bankerCards.length === 2 && !isNatural && 
    (playerCards.length === 2 || playerCards.length === 3) &&
    shouldBankerDraw(bankerScore, playerCards.length === 3 ? playerCards[2] : null);

  const canConfirm = playerCards.length >= 2 && bankerCards.length >= 2 &&
    (!playerNeedsThird || playerCards.length === 3) &&
    (!bankerNeedsThird || bankerCards.length === 3);

  // Auto-switch Logic: ช่วยสลับฝั่งให้ผู้ใช้
  useEffect(() => {
    if (playerCards.length === 1 && bankerCards.length === 0) setSelectingFor("banker");
    else if (playerCards.length === 1 && bankerCards.length === 1) setSelectingFor("player");
    else if (playerCards.length === 2 && bankerCards.length === 1) setSelectingFor("banker");
    else if (playerCards.length === 2 && bankerCards.length === 2) {
       if (playerNeedsThird) setSelectingFor("player");
       else if (bankerNeedsThird) setSelectingFor("banker");
    }
  }, [playerCards.length, bankerCards.length, playerNeedsThird, bankerNeedsThird]);

  const addCard = (suit: Suit, rank: Rank) => {
    const card: Card = { suit, rank, value: getCardValue(rank) };
    
    if (selectingFor === "player") {
      if (playerCards.length < 3) {
        setPlayerCards([...playerCards, card]);
      }
    } else {
      if (bankerCards.length < 3) {
        setBankerCards([...bankerCards, card]);
      }
    }
  };

  const removeCard = (side: "player" | "banker", index: number) => {
    if (side === "player") {
      setPlayerCards(playerCards.filter((_, i) => i !== index));
      setSelectingFor("player");
    } else {
      setBankerCards(bankerCards.filter((_, i) => i !== index));
      setSelectingFor("banker");
    }
  };

  return (
    <div className="bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 rounded-2xl border border-border/50 p-4 sm:p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold font-serif text-gold">ตั้งค่าไพ่ (Manual)</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>

      {/* Selected Cards Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Player Zone */}
        <div 
          onClick={() => playerCards.length < 3 && setSelectingFor("player")}
          className={cn(
            "p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden",
            selectingFor === "player" 
              ? "border-blue-500/50 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
              : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
          )}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-blue-500 font-bold uppercase tracking-wider">Player</span>
            <span className="text-2xl font-bold text-blue-500">{playerScore}</span>
          </div>
          <div className="flex gap-2 min-h-[50px]">
            {playerCards.map((card, i) => (
              <div key={i} className="relative group">
                 <div className="bg-white border border-gray-200 rounded px-2 py-1 flex items-center gap-1 shadow-sm">
                    <span className={cn("font-bold font-mono text-lg", suitColors[card.suit])}>
                        {card.rank}{suitSymbols[card.suit]}
                    </span>
                 </div>
                 <button 
                    onClick={(e) => { e.stopPropagation(); removeCard("player", i); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                 >
                    <X className="h-3 w-3" />
                 </button>
              </div>
            ))}
            {playerCards.length === 0 && <span className="text-muted-foreground text-sm italic py-2">แตะเพื่อเลือกไพ่</span>}
          </div>
        </div>

        {/* Banker Zone */}
        <div 
          onClick={() => bankerCards.length < 3 && setSelectingFor("banker")}
          className={cn(
            "p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden",
            selectingFor === "banker" 
              ? "border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
              : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
          )}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-red-500 font-bold uppercase tracking-wider">Banker</span>
            <span className="text-2xl font-bold text-red-500">{bankerScore}</span>
          </div>
          <div className="flex gap-2 min-h-[50px]">
             {bankerCards.map((card, i) => (
              <div key={i} className="relative group">
                 <div className="bg-white border border-gray-200 rounded px-2 py-1 flex items-center gap-1 shadow-sm">
                    <span className={cn("font-bold font-mono text-lg", suitColors[card.suit])}>
                        {card.rank}{suitSymbols[card.suit]}
                    </span>
                 </div>
                 <button 
                    onClick={(e) => { e.stopPropagation(); removeCard("banker", i); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                 >
                    <X className="h-3 w-3" />
                 </button>
              </div>
            ))}
            {bankerCards.length === 0 && <span className="text-muted-foreground text-sm italic py-2">แตะเพื่อเลือกไพ่</span>}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="text-center font-medium h-6">
        {canConfirm ? (
            <span className="text-green-500 flex items-center justify-center gap-2 animate-pulse">
                <Check className="h-4 w-4" /> ไพ่ครบแล้ว ยืนยันได้เลย
            </span>
        ) : (
            <span className="text-muted-foreground">
                กำลังเลือกให้: <span className={cn("font-bold uppercase", selectingFor==="player"?"text-blue-500":"text-red-500")}>{selectingFor}</span>
            </span>
        )}
      </div>

      {/* Card Grid (Fixed Layout) */}
      <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 overflow-x-auto">
        <div className="flex flex-col gap-2 min-w-[300px]">
          {suits.map((suit) => (
            <div key={suit} className="flex gap-2">
               <div className={cn("w-8 flex items-center justify-center text-xl", suitColors[suit])}>
                 {suitSymbols[suit]}
               </div>
               <div className="flex-1 flex flex-wrap gap-1">
                 {ranks.map((rank) => (
                    <button
                        key={`${suit}-${rank}`}
                        onClick={() => addCard(suit, rank)}
                        className={cn(
                            "w-8 h-9 rounded text-sm font-bold font-mono border transition-all",
                            "hover:scale-110 hover:shadow-md active:scale-95",
                            "bg-background border-border/50",
                            suitColors[suit]
                        )}
                    >
                        {rank}
                    </button>
                 ))}
               </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">ยกเลิก</Button>
        <Button 
            onClick={() => onConfirm(playerCards, bankerCards)} 
            disabled={!canConfirm}
            className={cn("w-full sm:w-auto font-bold", canConfirm && "bg-gold-gradient text-primary-foreground hover:opacity-90")}
        >
            ยืนยันผล
        </Button>
      </div>
    </div>
  );
};