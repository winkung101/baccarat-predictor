import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const detectCardsFromImage = async (imageBase64: string, apiKey: string, context: string) => {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a baccarat card detection AI. Analyze the image showing ${context} cards.

IMPORTANT: Focus only on detecting playing cards in this cropped region.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "cards": [{"rank": "A/2/3/4/5/6/7/8/9/10/J/Q/K", "suit": "hearts/diamonds/clubs/spades"}],
  "confidence": 0-100,
  "message": "Description of detected cards"
}

Rules:
- Detect 2-3 cards maximum
- Common card values: A=1, 2-9 face value, 10/J/Q/K=0
- If cards are unclear or not found, return empty cards array with low confidence
- Focus on card rank and suit identification`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Detect the ${context} cards in this cropped region.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 300,
      temperature: 0.1
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  let jsonStr = content;
  if (content.includes('```')) {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) jsonStr = match[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    return { cards: [], confidence: 0, message: "ไม่สามารถตรวจจับได้" };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not set');
    }

    const { imageBase64, playerImageBase64, bankerImageBase64, useRegions } = await req.json();

    // Region-based detection (more accurate)
    if (useRegions && playerImageBase64 && bankerImageBase64) {
      console.log("Using region-based detection for better accuracy");
      
      const [playerResult, bankerResult] = await Promise.all([
        detectCardsFromImage(playerImageBase64, LOVABLE_API_KEY, "PLAYER"),
        detectCardsFromImage(bankerImageBase64, LOVABLE_API_KEY, "BANKER")
      ]);

      console.log("Player result:", JSON.stringify(playerResult));
      console.log("Banker result:", JSON.stringify(bankerResult));

      const playerCards = playerResult.cards || [];
      const bankerCards = bankerResult.cards || [];
      const avgConfidence = Math.round((playerResult.confidence + bankerResult.confidence) / 2);
      
      const detected = playerCards.length > 0 && bankerCards.length > 0;

      return new Response(JSON.stringify({
        detected,
        playerCards,
        bankerCards,
        confidence: avgConfidence,
        message: detected 
          ? `ตรวจพบ Player ${playerCards.length} ใบ, Banker ${bankerCards.length} ใบ (Region Mode)`
          : "ไม่พบไพ่ในตำแหน่งที่กำหนด กรุณาปรับตำแหน่งกรอบ"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Full image detection (fallback)
    if (!imageBase64) {
      throw new Error('No image provided');
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a baccarat card detection AI. Analyze the image and detect playing cards.

IMPORTANT: Look for baccarat table layouts with Player and Banker hands.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "detected": true/false,
  "playerCards": [{"rank": "A/2/3/4/5/6/7/8/9/10/J/Q/K", "suit": "hearts/diamonds/clubs/spades"}],
  "bankerCards": [{"rank": "...", "suit": "..."}],
  "confidence": 0-100,
  "message": "Description of what was detected"
}

Rules:
- playerCards and bankerCards should have 2-3 cards each
- If cards are unclear, set detected to false
- Common card values: A=1, 2-9 face value, 10/J/Q/K=0
- Look for red/blue areas for Player/Banker hands
- If no cards found, return detected: false with empty arrays`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Detect the baccarat cards in this screenshot. Identify Player and Banker hands."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }),
    });

    const data = await response.json();
    console.log("AI Response:", JSON.stringify(data));

    const content = data.choices?.[0]?.message?.content || "";
    
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) jsonStr = match[1].trim();
    }

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      result = {
        detected: false,
        playerCards: [],
        bankerCards: [],
        confidence: 0,
        message: "ไม่สามารถตรวจจับไพ่ได้"
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", errorMessage);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      detected: false,
      playerCards: [],
      bankerCards: [],
      confidence: 0,
      message: "เกิดข้อผิดพลาด: " + errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
