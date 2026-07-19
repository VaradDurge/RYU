import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Increase body limit to handle audio base64 uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initializer for GoogleGenAI
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but not configured.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const SYSTEM_INSTRUCTION = `You are simulating a panel of six venture capital investors reacting to a
startup pitch. Each of the six has a distinct, fixed lens. Stay strictly
in character for each — do not let their reactions blend together or sound
like the same person with six different intros. Every reaction must be
specific to the actual pitch given, never generic.

The six personas, in this order:

1. UNIT ECONOMICS SKEPTIC — Ignores the vision entirely. Attacks the
   money: CAC, LTV, margin structure, whether the business model survives
   at scale. Tone: clipped, numbers-focused, slightly impatient with
   anything that isn't a number.

2. OPERATOR — Doesn't evaluate the idea itself. Attacks execution
   capability: can this specific team actually ship it, what breaks when
   this goes from 10 customers to 10,000, has this founder actually run
   something like this before. Tone: practical, direct, has clearly built
   things before.

3. MARKET SIZING CYNIC — Attacks the market size claim specifically. Push
   back hard if a TAM number sounds copy-pasted from a research report
   rather than built bottom-up. Ask what the real, defensible year-one
   addressable number is. Tone: dry, allergic to big round numbers without
   backup.

4. COMPETITIVE LANDSCAPE HAWK — Knows this space already. Names the kind
   of player (incumbent, adjacent startup, in-house feature at a bigger
   company) who could ship something similar fast, and asks why they
   won't. Tone: well-informed, slightly testing, wants a real answer not
   "we move faster."

5. TECHNICAL DILIGENCE PARTNER — Attacks whether there's a real technical
   moat or if this is a thin wrapper around someone else's model or API.
   Asks what's actually hard to replicate here. Tone: precise, technical,
   respects real depth and calls out the absence of it.

6. DISTRIBUTION REALIST — Ignores the product entirely. Attacks
   go-to-market: how does this founder actually get the first 100
   customers, what's the actual sales motion, is this sellable the way
   it's being described. Tone: blunt, has seen too many decks with no
   real distribution plan.

For each persona, using the exact input pitch provided (whether it arrived
as text or as audio), generate:
- reaction_line: one sentence, their immediate gut reaction, in their
  voice.
- sharp_objection: their single sharpest, most specific objection to this
  particular pitch — not a generic objection this persona would always
  raise, but the exact thing wrong or missing in what was just said.
- follow_up_question: the one question they would ask next if this were a
  real meeting.

Return only the six persona objects in the exact order listed above. Do
not add commentary outside the schema. Do not average or soften the
personas toward each other — they should sometimes flatly disagree with
each other, because real investors do.`;

const NEGOTIATOR_SYSTEM_INSTRUCTION = `You are simulating a panel of six venture capital investors in a multi-round negotiation reacting to a founder's response to their previous objections.

The six personas and their core perspectives are:
1. UNIT ECONOMICS SKEPTIC — Attacks the money, CAC, LTV, margin structure, scaling. Tone: clipped, numbers-focused.
2. OPERATOR — Attacks execution capability, team capacity, what breaks at scale. Tone: practical, direct.
3. MARKET SIZING CYNIC — Attacks bottom-up year-one TAM, round numbers. Tone: dry, allergic to copy-pasted claims.
4. COMPETITIVE LANDSCAPE HAWK — Names incumbents/fast-followers, demands real defensibility. Tone: well-informed, testing.
5. TECHNICAL DILIGENCE PARTNER — Attacks the technical moat vs thin API wrapper. Tone: precise, technical.
6. DISTRIBUTION REALIST — Attacks GTM, actual sales motion, how they get their first 100 clients. Tone: blunt.

For this round, you are given:
- The original startup pitch.
- The history of previous rounds (objections and responses).
- The founder's new response (which could be text or presented via an audio file).

Each persona must react specifically to whether the founder's response actually addressed their previous objection and follow-up question.
Stay strictly in character. They can say they are satisfied, still highly skeptical, or they can raise a new, different objection based on what was just said. They should sometimes disagree with each other on whether the response was good enough.

For each persona, generate:
- reaction_line: one sentence, their immediate reaction to this specific response, in their voice.
- sharp_objection: if they are still unsatisfied or have a new concern, state their single sharpest, most specific objection now. If they are satisfied, explain what they are happy with but note they are watching execution closely.
- follow_up_question: the next specific question they would ask if the meeting continued.

Return only the six persona objects in the exact same order. Do not add commentary outside the schema.`;

const VERDICT_SYSTEM_INSTRUCTION = `You are the final voting panel of the six venture capital investors.
Each of you must cast a final vote on whether you are "in" (want to invest or take to next-level partner meeting), "pass" (decline to invest), or "need_more_info" (need deep due diligence).

The six personas are:
1. UNIT ECONOMICS SKEPTIC
2. OPERATOR
3. MARKET SIZING CYNIC
4. COMPETITIVE LANDSCAPE HAWK
5. TECHNICAL DILIGENCE PARTNER
6. DISTRIBUTION REALIST

Review the entire startup pitch and the full history of rounds, responses, and objections.
Each persona must cast a vote and provide a one-sentence reason that stays strictly in character, based on what was discussed in this session (not generic).

Available votes: "in", "pass", "need_more_info".

Return only the schema.`;

// Endpoint 1: Simulate investor reactions to a startup pitch (text or audio)
app.post("/api/simulate", async (req, res) => {
  try {
    const { pitch, audio, mimeType } = req.body;

    if (!pitch && !audio) {
      return res.status(400).json({
        error: "Missing pitch text or audio recording. Please provide one of them.",
      });
    }

    const ai = getGeminiClient();

    // Prepare content parts
    const parts: any[] = [];

    if (audio) {
      parts.push({
        inlineData: {
          mimeType: mimeType || "audio/webm",
          data: audio,
        },
      });
      parts.push({
        text: "Analyze the startup pitch in this audio. Give the reactions for the 6 VCs. Also transcribe the audio in the transcription field.",
      });
    } else {
      parts.push({
        text: `Here is the startup pitch: "${pitch}"\n\nAnalyze this pitch and give the reactions for the 6 VCs. Since this is text input, the transcription field should just match the text input.`,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  persona_name: {
                    type: Type.STRING,
                    description: "Exactly one of: Unit Economics Skeptic, Operator, Market Sizing Cynic, Competitive Landscape Hawk, Technical Diligence Partner, Distribution Realist",
                  },
                  reaction_line: {
                    type: Type.STRING,
                    description: "Immediate gut reaction line (one sentence) strictly in their specific persona tone and voice.",
                  },
                  sharp_objection: {
                    type: Type.STRING,
                    description: "Single sharpest, most specific objection to this particular pitch.",
                  },
                  follow_up_question: {
                    type: Type.STRING,
                    description: "The one specific question they would ask next if this were a real meeting.",
                  },
                },
                required: ["persona_name", "reaction_line", "sharp_objection", "follow_up_question"],
              },
            },
            transcription: {
              type: Type.STRING,
              description: "The transcribed text of the startup pitch from the audio, or the same pitch text if text was provided.",
            },
          },
          required: ["personas", "transcription"],
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No response content received from Gemini.");
    }

    const parsed = JSON.parse(textOutput.trim());

    if (!parsed.personas || parsed.personas.length === 0) {
      return res.status(422).json({
        error: "We couldn't detect a clear startup pitch. Please try again with a slightly longer or clearer pitch!",
      });
    }

    return res.json(parsed);
  } catch (err: any) {
    console.error("Simulation error:", err);
    return res.status(500).json({
      error: "We had trouble analyzing your pitch. The audio might be too noisy/quiet or the text too short. Please try again!",
    });
  }
});

// Endpoint 2: Transcribe pitch audio only (transcription feature)
app.post("/api/transcribe", async (req, res) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "Missing audio recording." });
    }

    const ai = getGeminiClient();

    const audioPart = {
      inlineData: {
        mimeType: mimeType || "audio/webm",
        data: audio,
      },
    };

    const promptPart = {
      text: "Please transcribe this audio recording of a startup pitch verbatim. Do not add any extra commentary or introductory text; return ONLY the transcribed words.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [audioPart, promptPart] },
    });

    const transcription = response.text?.trim() || "";
    if (!transcription) {
      return res.status(422).json({
        error: "The recording was too quiet or unclear. Please try again with a clearer or louder voice!",
      });
    }

    return res.json({ transcription });
  } catch (err: any) {
    console.error("Transcription error:", err);
    return res.status(500).json({
      error: "We couldn't transcribe the audio. Please try speaking closer to the microphone or pasting the text directly.",
    });
  }
});

// Endpoint 3: Simulate negotiations (Feature 1)
app.post("/api/simulate-negotiate", async (req, res) => {
  try {
    const { pitch, history, newResponse, audio, mimeType } = req.body;

    if (!pitch) {
      return res.status(400).json({ error: "Missing original pitch context." });
    }
    if (!newResponse && !audio) {
      return res.status(400).json({ error: "Missing founder response. Please provide a typed response or audio recording." });
    }

    const ai = getGeminiClient();
    const parts: any[] = [];

    // If audio is provided, attach it as part of the prompt
    if (audio) {
      parts.push({
        inlineData: {
          mimeType: mimeType || "audio/webm",
          data: audio,
        },
      });
    }

    // Build historical context to feed into Gemini
    const historyText = history && history.length > 0 
      ? history.map((h: any, i: number) => {
          const roundNum = i + 1;
          const prevObjections = h.personas.map((p: any) => 
            `- ${p.persona_name}: Objection: "${p.sharp_objection}". Follow-up question: "${p.follow_up_question}"`
          ).join("\n");
          return `[ROUND ${roundNum}]\nFounder Response: "${h.response}"\nPartner reactions & objections:\n${prevObjections}`;
        }).join("\n\n")
      : "No previous rounds yet.";

    const promptText = `
ORIGINAL STARTUP PITCH:
"${pitch}"

CONVERSATION HISTORY SO FAR:
${historyText}

NEW FOUNDER RESPONSE IN THIS ROUND:
${audio ? "The founder spoke their response. Refer to the attached audio file. Please transcribe their spoken response into the 'transcription' field." : `"${newResponse}"`}

Simulate the reactions of the 6 partner personas to this new response. Return a JSON containing the structured array "personas" and the "transcription" of the founder's response.
    `;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        systemInstruction: NEGOTIATOR_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  persona_name: {
                    type: Type.STRING,
                    description: "Exactly one of: Unit Economics Skeptic, Operator, Market Sizing Cynic, Competitive Landscape Hawk, Technical Diligence Partner, Distribution Realist",
                  },
                  reaction_line: {
                    type: Type.STRING,
                    description: "Immediate gut reaction line (one sentence) reacting specifically to whether the response addressed their concern.",
                  },
                  sharp_objection: {
                    type: Type.STRING,
                    description: "New sharp objection or continued concern. If fully satisfied, explain why they are pleased, and what they will keep an eye on.",
                  },
                  follow_up_question: {
                    type: Type.STRING,
                    description: "Their next follow-up question for the founder.",
                  },
                },
                required: ["persona_name", "reaction_line", "sharp_objection", "follow_up_question"],
              },
            },
            transcription: {
              type: Type.STRING,
              description: "The transcription of the founder's new voice response, or the same text response if typed.",
            },
          },
          required: ["personas", "transcription"],
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No response content received from Gemini.");
    }

    const parsed = JSON.parse(textOutput.trim());
    return res.json(parsed);
  } catch (err: any) {
    console.error("Negotiation error:", err);
    return res.status(500).json({
      error: "The partners couldn't follow that response. Please make sure your reply is clear and try again!",
    });
  }
});

// Endpoint 4: Closing Verdict (Feature 2)
app.post("/api/verdict", async (req, res) => {
  try {
    const { pitch, history } = req.body;

    if (!pitch) {
      return res.status(400).json({ error: "Missing original pitch context." });
    }

    const ai = getGeminiClient();

    // Construct full negotiation logs
    const historyText = history && history.length > 0 
      ? history.map((h: any, i: number) => {
          const roundNum = i + 1;
          const objections = h.personas.map((p: any) => 
            `- ${p.persona_name}: Objection: "${p.sharp_objection}". Follow-up question: "${p.follow_up_question}"`
          ).join("\n");
          return `[ROUND ${roundNum}]\nFounder Response: "${h.response}"\nPartner reactions & objections:\n${objections}`;
        }).join("\n\n")
      : "No negotiation rounds took place (skipped directly to verdict).";

    const promptText = `
ORIGINAL STARTUP PITCH:
"${pitch}"

FULL CONVERSATION HISTORY:
${historyText}

Based on this complete session, each of the six VC investors must now cast their final vote ("in", "pass", "need_more_info") and explain their decision in one sentence. Stay strictly in character.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: promptText }],
      config: {
        systemInstruction: VERDICT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdicts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  persona_name: {
                    type: Type.STRING,
                    description: "Exactly one of: Unit Economics Skeptic, Operator, Market Sizing Cynic, Competitive Landscape Hawk, Technical Diligence Partner, Distribution Realist",
                  },
                  vote: {
                    type: Type.STRING,
                    description: "Must be exactly one of: in, pass, need_more_info",
                  },
                  reason: {
                    type: Type.STRING,
                    description: "One-sentence realistic justification based on what was discussed.",
                  },
                },
                required: ["persona_name", "vote", "reason"],
              },
            },
          },
          required: ["verdicts"],
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No response content received from Gemini.");
    }

    const parsed = JSON.parse(textOutput.trim());
    return res.json(parsed);
  } catch (err: any) {
    console.error("Verdict error:", err);
    return res.status(500).json({
      error: "The partners couldn't reach a final decision. Please try asking for the verdict again.",
    });
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
