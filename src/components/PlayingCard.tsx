import { cn } from "@/lib/utils";

interface PlayingCardProps {
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  rank: string;
  delay?: number;
  className?: string;
}

const suitSymbols = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const suitColors = {
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-gray-900",
  spades: "text-gray-900",
};

export const PlayingCard = ({ suit, rank, delay = 0, className }: PlayingCardProps) => {
  return (
    <div
      className={cn(
        "card-playing w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 flex flex-col items-center justify-between p-1.5 sm:p-2 deal-animation",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top left */}
      <div className={cn("self-start flex flex-col items-center leading-none", suitColors[suit])}>
        <span className="text-sm sm:text-base md:text-lg font-bold">{rank}</span>
        <span className="text-base sm:text-lg md:text-xl">{suitSymbols[suit]}</span>
      </div>

      {/* Center */}
      <div className={cn("text-2xl sm:text-3xl md:text-4xl", suitColors[suit])}>
        {suitSymbols[suit]}
      </div>

      {/* Bottom right */}
      <div className={cn("self-end flex flex-col items-center leading-none rotate-180", suitColors[suit])}>
        <span className="text-sm sm:text-base md:text-lg font-bold">{rank}</span>
        <span className="text-base sm:text-lg md:text-xl">{suitSymbols[suit]}</span>
      </div>
    </div>
  );
};
