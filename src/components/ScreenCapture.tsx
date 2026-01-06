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
  Play,
  Target,
  Move,
  Settings2
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

interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragMode = "move" | "resize-tl" | "resize-tr" | "resize-bl" | "resize-br" | null;

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

const DEFAULT_PLAYER_REGION: CaptureRegion = { x: 10, y: 50, width: 35, height: 40 };
const DEFAULT_BANKER_REGION: CaptureRegion = { x: 55, y: 50, width: 35, height: 40 };

const MIN_SIZE = 10; // Minimum region size in percentage

export const ScreenCapture = ({ onCardsDetected }: ScreenCaptureProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Region selection
  const [showRegionSettings, setShowRegionSettings] = useState(false);
  const [playerRegion, setPlayerRegion] = useState<CaptureRegion>(DEFAULT_PLAYER_REGION);
  const [bankerRegion, setBankerRegion] = useState<CaptureRegion>(DEFAULT_BANKER_REGION);
  const [useRegionCapture, setUseRegionCapture] = useState(true);
  const [activeRegion, setActiveRegion] = useState<"player" | "banker" | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; region: CaptureRegion } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerCanvasRef = useRef<HTMLCanvasElement>(null);
  const bankerCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

  const cropRegion = (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    region: CaptureRegion
  ): string => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    const x = (region.x / 100) * videoWidth;
    const y = (region.y / 100) * videoHeight;
    const width = (region.width / 100) * videoWidth;
    const height = (region.height / 100) * videoHeight;

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(video, x, y, width, height, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  };

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.drawImage(video, 0, 0);
    
    const fullImageBase64 = canvas.toDataURL("image/png");
    setPreviewUrl(fullImageBase64);
    
    setIsAnalyzing(true);
    setError(null);

    try {
      let requestBody: { imageBase64?: string; playerImageBase64?: string; bankerImageBase64?: string; useRegions?: boolean } = {};

      if (useRegionCapture && playerCanvasRef.current && bankerCanvasRef.current) {
        const playerImageBase64 = cropRegion(video, playerCanvasRef.current, playerRegion);
        const bankerImageBase64 = cropRegion(video, bankerCanvasRef.current, bankerRegion);
        
        requestBody = {
          playerImageBase64,
          bankerImageBase64,
          useRegions: true
        };
      } else {
        requestBody = { imageBase64: fullImageBase64 };
      }

      const { data, error: fnError } = await supabase.functions.invoke("detect-cards", {
        body: requestBody
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
  }, [isAnalyzing, onCardsDetected, useRegionCapture, playerRegion, bankerRegion]);

  const manualCapture = () => {
    captureAndAnalyze();
  };

  // Drag handlers
  const handleRegionMouseDown = (region: "player" | "banker", mode: DragMode) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveRegion(region);
    setDragMode(mode);
    
    if (previewContainerRef.current) {
      const rect = previewContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const currentRegion = region === "player" ? playerRegion : bankerRegion;
      setDragStart({ x, y, region: { ...currentRegion } });
    }
  };

  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (!dragMode || !activeRegion || !previewContainerRef.current || !dragStart) return;

    const rect = previewContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const setRegion = activeRegion === "player" ? setPlayerRegion : setBankerRegion;
    const originalRegion = dragStart.region;

    const deltaX = x - dragStart.x;
    const deltaY = y - dragStart.y;

    if (dragMode === "move") {
      // Move the region
      setRegion({
        ...originalRegion,
        x: Math.max(0, Math.min(100 - originalRegion.width, originalRegion.x + deltaX)),
        y: Math.max(0, Math.min(100 - originalRegion.height, originalRegion.y + deltaY))
      });
    } else if (dragMode === "resize-br") {
      // Resize from bottom-right
      const newWidth = Math.max(MIN_SIZE, Math.min(100 - originalRegion.x, originalRegion.width + deltaX));
      const newHeight = Math.max(MIN_SIZE, Math.min(100 - originalRegion.y, originalRegion.height + deltaY));
      setRegion({
        ...originalRegion,
        width: newWidth,
        height: newHeight
      });
    } else if (dragMode === "resize-bl") {
      // Resize from bottom-left
      const newWidth = Math.max(MIN_SIZE, originalRegion.width - deltaX);
      const newX = Math.max(0, originalRegion.x + originalRegion.width - newWidth);
      const newHeight = Math.max(MIN_SIZE, Math.min(100 - originalRegion.y, originalRegion.height + deltaY));
      setRegion({
        x: newX,
        y: originalRegion.y,
        width: Math.min(newWidth, originalRegion.x + originalRegion.width),
        height: newHeight
      });
    } else if (dragMode === "resize-tr") {
      // Resize from top-right
      const newWidth = Math.max(MIN_SIZE, Math.min(100 - originalRegion.x, originalRegion.width + deltaX));
      const newHeight = Math.max(MIN_SIZE, originalRegion.height - deltaY);
      const newY = Math.max(0, originalRegion.y + originalRegion.height - newHeight);
      setRegion({
        x: originalRegion.x,
        y: newY,
        width: newWidth,
        height: Math.min(newHeight, originalRegion.y + originalRegion.height)
      });
    } else if (dragMode === "resize-tl") {
      // Resize from top-left
      const newWidth = Math.max(MIN_SIZE, originalRegion.width - deltaX);
      const newHeight = Math.max(MIN_SIZE, originalRegion.height - deltaY);
      const newX = Math.max(0, originalRegion.x + originalRegion.width - newWidth);
      const newY = Math.max(0, originalRegion.y + originalRegion.height - newHeight);
      setRegion({
        x: newX,
        y: newY,
        width: Math.min(newWidth, originalRegion.x + originalRegion.width),
        height: Math.min(newHeight, originalRegion.y + originalRegion.height)
      });
    }
  };

  const handlePreviewMouseUp = () => {
    setDragMode(null);
    setActiveRegion(null);
    setDragStart(null);
  };

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, []);

  const ResizeHandle = ({ position, onMouseDown }: { position: "tl" | "tr" | "bl" | "br"; onMouseDown: (e: React.MouseEvent) => void }) => {
    const positionClasses = {
      tl: "-top-1 -left-1 cursor-nwse-resize",
      tr: "-top-1 -right-1 cursor-nesw-resize",
      bl: "-bottom-1 -left-1 cursor-nesw-resize",
      br: "-bottom-1 -right-1 cursor-nwse-resize"
    };
    
    return (
      <div
        className={cn(
          "absolute w-3 h-3 bg-white border-2 rounded-sm z-10",
          positionClasses[position]
        )}
        onMouseDown={onMouseDown}
      />
    );
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 backdrop-blur-md rounded-2xl border border-indigo-500/30 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scan className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-indigo-200">AI Screen Detection</h3>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => setShowRegionSettings(!showRegionSettings)}
            size="sm"
            variant="outline"
            className={cn(
              "gap-2 border-indigo-500/50",
              showRegionSettings && "bg-indigo-600/30"
            )}
          >
            <Settings2 className="w-4 h-4" />
            ตั้งค่าตำแหน่ง
          </Button>
          
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

      {/* Region Settings Panel */}
      {showRegionSettings && (
        <div className="mb-4 p-3 bg-black/30 rounded-lg border border-indigo-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-200">ตั้งค่าตำแหน่งจับภาพ</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useRegionCapture}
                onChange={(e) => setUseRegionCapture(e.target.checked)}
                className="w-4 h-4 rounded border-indigo-500 bg-black/50 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-400">เปิดใช้งาน</span>
            </label>
          </div>
          
          {useRegionCapture && (
            <div className="grid grid-cols-2 gap-4">
              {/* Player Region Controls */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-player" />
                  <span className="text-xs font-medium text-player">Player Region</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500">X (%)</label>
                    <input
                      type="number"
                      value={playerRegion.x}
                      onChange={(e) => setPlayerRegion({ ...playerRegion, x: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs bg-black/50 border border-white/10 rounded"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Y (%)</label>
                    <input
                      type="number"
                      value={playerRegion.y}
                      onChange={(e) => setPlayerRegion({ ...playerRegion, y: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs bg-black/50 border border-white/10 rounded"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Width (%)</label>
                    <input
                      type="number"
                      value={playerRegion.width}
                      onChange={(e) => setPlayerRegion({ ...playerRegion, width: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs bg-black/50 border border-white/10 rounded"
                      min={5}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Height (%)</label>
                    <input
                      type="number"
                      value={playerRegion.height}
                      onChange={(e) => setPlayerRegion({ ...playerRegion, height: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs bg-black/50 border border-white/10 rounded"
                      min={5}
                      max={100}
                    />
                  </div>
                </div>
              </div>
              
              {/* Banker Region Controls */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-banker" />
                  <span className="text-xs font-medium text-banker">Banker Region</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500">X (%)</label>
                    <input
                      type="number"
                      value={bankerRegion.x}
                      onChange={(e) => setBankerRegion({ ...bankerRegion, x: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs bg-black/50 border border-white/10 rounded"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Y (%)</label>
                    <input
                      type="number"
                      value={bankerRegion.y}
                      onChange={(e) => setBankerRegion({ ...bankerRegion, y: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs bg-black/50 border border-white/10 rounded"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Width (%)</label>
                    <input
                      type="number"
                      value={bankerRegion.width}
                      onChange={(e) => setBankerRegion({ ...bankerRegion, width: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs bg-black/50 border border-white/10 rounded"
                      min={5}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Height (%)</label>
                    <input
                      type="number"
                      value={bankerRegion.height}
                      onChange={(e) => setBankerRegion({ ...bankerRegion, height: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-xs bg-black/50 border border-white/10 rounded"
                      min={5}
                      max={100}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <p className="text-[10px] text-gray-500 mt-3">
            <Move className="w-3 h-3 inline mr-1" />
            ลากกรอบเพื่อเลื่อนตำแหน่ง หรือลากมุมเพื่อปรับขนาด
          </p>
        </div>
      )}

      {/* Video preview (hidden but needed for capture) */}
      <video 
        ref={videoRef} 
        className="hidden" 
        playsInline 
        muted
      />
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={playerCanvasRef} className="hidden" />
      <canvas ref={bankerCanvasRef} className="hidden" />

      {/* Preview and Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Preview */}
        <div 
          ref={previewContainerRef}
          className="relative aspect-video bg-black/50 rounded-lg overflow-hidden border border-white/10 select-none"
          onMouseMove={handlePreviewMouseMove}
          onMouseUp={handlePreviewMouseUp}
          onMouseLeave={handlePreviewMouseUp}
        >
          {previewUrl ? (
            <>
              <img 
                src={previewUrl} 
                alt="Preview" 
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
              
              {/* Region overlays */}
              {useRegionCapture && (
                <>
                  {/* Player region */}
                  <div
                    className={cn(
                      "absolute border-2 border-player bg-player/20 transition-colors",
                      activeRegion === "player" && "ring-2 ring-player ring-offset-1"
                    )}
                    style={{
                      left: `${playerRegion.x}%`,
                      top: `${playerRegion.y}%`,
                      width: `${playerRegion.width}%`,
                      height: `${playerRegion.height}%`
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[10px] font-bold text-player bg-black/80 px-1.5 rounded">
                      PLAYER
                    </span>
                    {/* Move handle (center) */}
                    <div 
                      className="absolute inset-0 cursor-move"
                      onMouseDown={handleRegionMouseDown("player", "move")}
                    />
                    {/* Resize handles */}
                    <ResizeHandle position="tl" onMouseDown={handleRegionMouseDown("player", "resize-tl")} />
                    <ResizeHandle position="tr" onMouseDown={handleRegionMouseDown("player", "resize-tr")} />
                    <ResizeHandle position="bl" onMouseDown={handleRegionMouseDown("player", "resize-bl")} />
                    <ResizeHandle position="br" onMouseDown={handleRegionMouseDown("player", "resize-br")} />
                  </div>
                  
                  {/* Banker region */}
                  <div
                    className={cn(
                      "absolute border-2 border-banker bg-banker/20 transition-colors",
                      activeRegion === "banker" && "ring-2 ring-banker ring-offset-1"
                    )}
                    style={{
                      left: `${bankerRegion.x}%`,
                      top: `${bankerRegion.y}%`,
                      width: `${bankerRegion.width}%`,
                      height: `${bankerRegion.height}%`
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-[10px] font-bold text-banker bg-black/80 px-1.5 rounded">
                      BANKER
                    </span>
                    {/* Move handle (center) */}
                    <div 
                      className="absolute inset-0 cursor-move"
                      onMouseDown={handleRegionMouseDown("banker", "move")}
                    />
                    {/* Resize handles */}
                    <ResizeHandle position="tl" onMouseDown={handleRegionMouseDown("banker", "resize-tl")} />
                    <ResizeHandle position="tr" onMouseDown={handleRegionMouseDown("banker", "resize-tr")} />
                    <ResizeHandle position="bl" onMouseDown={handleRegionMouseDown("banker", "resize-bl")} />
                    <ResizeHandle position="br" onMouseDown={handleRegionMouseDown("banker", "resize-br")} />
                  </div>
                </>
              )}
            </>
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
          💡 <span className="text-gray-400">วิธีใช้:</span> ลากกรอบเพื่อเลื่อนตำแหน่ง หรือลากจุดขาวที่มุมเพื่อปรับขนาด 
          ระบบจะตรวจจับเฉพาะพื้นที่ที่กำหนดเพื่อความแม่นยำสูงสุด
        </p>
      </div>
    </div>
  );
};