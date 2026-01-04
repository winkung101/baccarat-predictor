import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "@/lib/baccarat";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  Camera, 
  MonitorPlay, 
  StopCircle, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Scan,
  Pause,
  Play
} from "lucide-react";

interface DetectedCard {
  rank: string;
  suit: string;
}

interface DetectionResult {
  detected: boolean;
  playerCards: DetectedCard[];
  bankerCards: DetectedCard[];
  confidence: number;
  message: string;
}

interface ScreenCaptureProps {
  onCardsDetected: (playerCards: Card[], bankerCards: Card[]) => void;
}

const rankToValue = (rank: string): number => {
  if (rank === "A" || rank === "1") return 1;
  if (["10", "J", "Q", "K"].includes(rank.toUpperCase())) return 0;
  return parseInt(rank) || 0;
};

const convertDetectedCard = (card: DetectedCard): Card => ({
  suit: card.suit.toLowerCase() as "hearts" | "diamonds" | "clubs" | "spades",
  rank: card.rank.toUpperCase() as Card["rank"],
  value: rankToValue(card.rank)
});

export const ScreenCapture = ({ onCardsDetected }: ScreenCaptureProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCapture = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      stream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };

      setIsCapturing(true);
      setIsPaused(false);
      
      // Start auto-detection interval (every 3 seconds)
      startAutoDetection();
      
    } catch (err) {
      console.error("Screen capture error:", err);
      setError("ไม่สามารถจับภาพหน้าจอได้ กรุณาอนุญาตการเข้าถึง");
    }
  };

  const startAutoDetection = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      if (!isPaused && isCapturing) {
        captureAndAnalyze();
      }
    }, 3000);
  };

  const stopCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsCapturing(false);
    setIsPaused(false);
    setPreviewUrl(null);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    if (isPaused) {
      startAutoDetection();
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current frame
    ctx.drawImage(video, 0, 0);
    
    // Get base64 image
    const imageBase64 = canvas.toDataURL("image/png");
    setPreviewUrl(imageBase64);
    
    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("detect-cards", {
        body: { imageBase64 }
      });

      if (fnError) throw fnError;

      console.log("Detection result:", data);
      setLastResult(data);

      if (data.detected && data.playerCards?.length > 0 && data.bankerCards?.length > 0) {
        const playerCards = data.playerCards.map(convertDetectedCard);
        const bankerCards = data.bankerCards.map(convertDetectedCard);
        onCardsDetected(playerCards, bankerCards);
      }

    } catch (err) {
      console.error("Analysis error:", err);
      setError("เกิดข้อผิดพลาดในการวิเคราะห์");
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, onCardsDetected]);

  // Manual capture button
  const manualCapture = () => {
    captureAndAnalyze();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, []);

  return (
    <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 backdrop-blur-md rounded-2xl border border-indigo-500/30 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scan className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-indigo-200">AI Screen Detection</h3>
        </div>
        
        <div className="flex gap-2">
          {!isCapturing ? (
            <Button
              onClick={startCapture}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              <MonitorPlay className="w-4 h-4" />
              เริ่มจับภาพ
            </Button>
          ) : (
            <>
              <Button
                onClick={togglePause}
                size="sm"
                variant="outline"
                className={cn(
                  "gap-2 border-indigo-500/50",
                  isPaused ? "text-green-400" : "text-yellow-400"
                )}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? "ดำเนินการต่อ" : "หยุดชั่วคราว"}
              </Button>
              <Button
                onClick={manualCapture}
                size="sm"
                variant="outline"
                className="gap-2 border-indigo-500/50"
                disabled={isAnalyzing}
              >
                <Camera className="w-4 h-4" />
                จับภาพ
              </Button>
              <Button
                onClick={stopCapture}
                size="sm"
                variant="destructive"
                className="gap-2"
              >
                <StopCircle className="w-4 h-4" />
                หยุด
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Video preview (hidden but needed for capture) */}
      <video 
        ref={videoRef} 
        className="hidden" 
        playsInline 
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Preview and Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Preview */}
        <div className="relative aspect-video bg-black/50 rounded-lg overflow-hidden border border-white/10">
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              {isCapturing ? "กำลังจับภาพหน้าจอ..." : "คลิก \"เริ่มจับภาพ\" เพื่อเริ่มต้น"}
            </div>
          )}
          
          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="flex items-center gap-2 text-indigo-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>กำลังวิเคราะห์...</span>
              </div>
            </div>
          )}

          {isCapturing && !isPaused && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500/80 px-2 py-1 rounded text-xs text-white">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          )}
        </div>

        {/* Detection Result */}
        <div className="bg-black/30 rounded-lg p-4 border border-white/10">
          <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">ผลการตรวจจับ</h4>
          
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {lastResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {lastResult.detected ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  lastResult.detected ? "text-green-400" : "text-yellow-400"
                )}>
                  {lastResult.detected ? "ตรวจพบไพ่!" : "ไม่พบไพ่"}
                </span>
                <span className="text-xs text-gray-500">
                  ({lastResult.confidence}% confidence)
                </span>
              </div>

              <p className="text-xs text-gray-400">{lastResult.message}</p>

              {lastResult.detected && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-player/20 rounded p-2 border border-player/30">
                    <span className="text-[10px] text-player font-bold">PLAYER</span>
                    <div className="flex gap-1 mt-1">
                      {lastResult.playerCards.map((card, i) => (
                        <span key={i} className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
                          {card.rank}{card.suit[0].toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-banker/20 rounded p-2 border border-banker/30">
                    <span className="text-[10px] text-banker font-bold">BANKER</span>
                    <div className="flex gap-1 mt-1">
                      {lastResult.bankerCards.map((card, i) => (
                        <span key={i} className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
                          {card.rank}{card.suit[0].toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">ยังไม่มีผลการตรวจจับ</p>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/5">
        <p className="text-[10px] text-gray-500">
          💡 <span className="text-gray-400">วิธีใช้:</span> คลิก "เริ่มจับภาพ" แล้วเลือกหน้าต่างที่มีโต๊ะบาคาร่า 
          ระบบจะตรวจจับไพ่อัตโนมัติทุก 3 วินาที หรือคลิก "จับภาพ" เพื่อตรวจจับทันที
        </p>
      </div>
    </div>
  );
};
