import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  DollarSign,
  Wrench,
  BarChart3,
  Eye,
  Code2,
  Route,
  Mic,
  Square,
  Sparkles,
  AlertCircle,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  X,
  Volume2,
  VolumeX,
  FileText,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  MessageSquare,
  Vote,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
} from "lucide-react";

// Types for responses
interface PersonaReaction {
  persona_name: string;
  reaction_line: string;
  sharp_objection: string;
  follow_up_question: string;
}

interface SimulationResult {
  personas: PersonaReaction[];
  transcription: string;
}

interface Verdict {
  persona_name: string;
  vote: "in" | "pass" | "need_more_info";
  reason: string;
}

interface VerdictResult {
  verdicts: Verdict[];
}

interface HistoryRound {
  response: string;
  personas: PersonaReaction[];
}

// Preset pitches for quick stage demos
const PITCH_PRESETS = [
  {
    id: "uber-pets",
    label: "🐶 Uber for Pets",
    pitch: "An on-demand pet transportation and mobile care platform that connects busy pet parents with background-checked drivers equipped with specialized safety crates and climate-controlled vans.",
  },
  {
    id: "ai-reviewer",
    label: "💻 Browser Local AI Code Reviewer",
    pitch: "A secure browser extension that uses lightweight local edge models to perform real-time, zero-data-leakage code quality reviews directly in GitHub before developers commit, protecting proprietary enterprise IP.",
  },
  {
    id: "bottom-up-saas",
    label: "📊 Bottom-Up SaaS Analytics",
    pitch: "A self-serve attribution and metrics platform for product-led growth startups that aggregates developer usage, tracking users from their initial GitHub clone through to enterprise subscription.",
  },
];

// Persona visual metadata
const PERSONA_METADATA: Record<string, {
  subtitle: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  iconBgClass: string;
  borderAccentClass: string;
  icon: any;
}> = {
  "Unit Economics Skeptic": {
    subtitle: "The Margin Hunter",
    bgClass: "bg-rose-50/70",
    borderClass: "border-rose-100 hover:border-rose-300",
    textClass: "text-rose-800",
    iconBgClass: "bg-rose-100 text-rose-700",
    borderAccentClass: "border-l-4 border-l-rose-500",
    icon: DollarSign,
  },
  "Operator": {
    subtitle: "Execution Realist",
    bgClass: "bg-amber-50/70",
    borderClass: "border-amber-100 hover:border-amber-300",
    textClass: "text-amber-800",
    iconBgClass: "bg-amber-100 text-amber-700",
    borderAccentClass: "border-l-4 border-l-amber-500",
    icon: Wrench,
  },
  "Market Sizing Cynic": {
    subtitle: "TAM Investigator",
    bgClass: "bg-yellow-50/70",
    borderClass: "border-yellow-100 hover:border-yellow-300",
    textClass: "text-yellow-800",
    iconBgClass: "bg-yellow-100 text-yellow-700",
    borderAccentClass: "border-l-4 border-l-yellow-500",
    icon: BarChart3,
  },
  "Competitive Landscape Hawk": {
    subtitle: "Defensibility Analyst",
    bgClass: "bg-sky-50/70",
    borderClass: "border-sky-100 hover:border-sky-300",
    textClass: "text-sky-800",
    iconBgClass: "bg-sky-100 text-sky-700",
    borderAccentClass: "border-l-4 border-l-sky-500",
    icon: Eye,
  },
  "Technical Diligence Partner": {
    subtitle: "The Moat Auditor",
    bgClass: "bg-violet-50/70",
    borderClass: "border-violet-100 hover:border-violet-300",
    textClass: "text-violet-800",
    iconBgClass: "bg-violet-100 text-violet-700",
    borderAccentClass: "border-l-4 border-l-violet-500",
    icon: Code2,
  },
  "Distribution Realist": {
    subtitle: "Go-To-Market Specialist",
    bgClass: "bg-emerald-50/70",
    borderClass: "border-emerald-100 hover:border-emerald-300",
    textClass: "text-emerald-800",
    iconBgClass: "bg-emerald-100 text-emerald-700",
    borderAccentClass: "border-l-4 border-l-emerald-500",
    icon: Route,
  },
};

const LOADING_STATUS_LOGS = [
  "Unit Economics Skeptic is calculating your customer acquisition margins...",
  "Competitive Landscape Hawk is checking crunchbase for incumbents...",
  "Technical Diligence Partner is reviewing your architectural moat...",
  "Distribution Realist is questioning your viral GTM GTM loop assumptions...",
  "Operator is stress-testing your scalability models...",
  "Market Sizing Cynic is auditing your bottom-up TAM formulas...",
  "Compiling partner objections and follow-up questions..."
];

const VERDICT_LOADING_LOGS = [
  "Unit Economics Skeptic is reviewing margin consistency...",
  "Operator is analyzing negotiation viability...",
  "Market Sizing Cynic is finalizing bottom-up defensible metrics...",
  "Competitive Landscape Hawk is doing background peer review...",
  "Technical Diligence Partner is reviewing architectural moat commitments...",
  "Distribution Realist is calculating final conversion expectations...",
  "Summoning the partners to cast their final votes..."
];

export default function App() {
  // Input states (Initial Pitch)
  const [pitchText, setPitchText] = useState("");
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  // Multi-Round Reply states
  const [replyText, setReplyText] = useState("");
  const [isReplyRecordingMode, setIsReplyRecordingMode] = useState(false);
  const [isReplyRecording, setIsReplyRecording] = useState(false);
  const [replyRecordingDuration, setReplyRecordingDuration] = useState(0);
  const [replyAudioUrl, setReplyAudioUrl] = useState<string | null>(null);
  const [replyAudioBlob, setReplyAudioBlob] = useState<Blob | null>(null);
  const [replyAudioBase64, setReplyAudioBase64] = useState<string | null>(null);
  const [replyMimeType, setReplyMimeType] = useState<string | null>(null);

  // General Simulation states
  const [currentRound, setCurrentRound] = useState(1); // 1, 2, or 3
  const [negotiationHistory, setNegotiationHistory] = useState<HistoryRound[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [expandedPersonas, setExpandedPersonas] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Verdict states
  const [loadingVerdict, setLoadingVerdict] = useState(false);
  const [verdictResult, setVerdictResult] = useState<VerdictResult | null>(null);

  // Feature 3: Spoken reactions & audio state
  const [isMuted, setIsMuted] = useState(false);

  // References for MediaRecorder (Pitch)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // References for MediaRecorder (Reply)
  const replyMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const replyAudioChunksRef = useRef<Blob[]>([]);
  const replyTimerIntervalRef = useRef<number | null>(null);

  // Log rotation timer
  const logIntervalRef = useRef<number | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (replyTimerIntervalRef.current) clearInterval(replyTimerIntervalRef.current);
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // Cycle loading status logs
  useEffect(() => {
    if (loading || loadingVerdict) {
      setCurrentLogIndex(0);
      logIntervalRef.current = window.setInterval(() => {
        setCurrentLogIndex((prev) => (prev + 1) % LOADING_STATUS_LOGS.length);
      }, 1600);
    } else {
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current);
        logIntervalRef.current = null;
      }
    }
  }, [loading, loadingVerdict]);

  // Cancel speech synthesis on mute toggle
  useEffect(() => {
    if (isMuted && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [isMuted]);

  // FEATURE 3: Spoken Reactions Sequence Executor
  const speakReactions = (personas: PersonaReaction[]) => {
    if (isMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    let currentIndex = 0;

    const speakNext = () => {
      if (currentIndex >= personas.length || isMuted) return;
      const persona = personas[currentIndex];
      const text = `${persona.persona_name} says: ${persona.reaction_line}`;
      const utterance = new SpeechSynthesisUtterance(text);

      // Unique custom voice pitches & speeds per persona for realistic simulation
      let pitch = 1.0;
      let rate = 1.0;

      switch (persona.persona_name) {
        case "Unit Economics Skeptic":
          rate = 1.25;
          pitch = 0.8;
          break;
        case "Operator":
          rate = 1.0;
          pitch = 0.95;
          break;
        case "Market Sizing Cynic":
          rate = 0.85;
          pitch = 0.75;
          break;
        case "Competitive Landscape Hawk":
          rate = 1.15;
          pitch = 1.15;
          break;
        case "Technical Diligence Partner":
          rate = 1.0;
          pitch = 1.05;
          break;
        case "Distribution Realist":
          rate = 1.1;
          pitch = 0.9;
          break;
      }

      utterance.pitch = pitch;
      utterance.rate = rate;

      // Assign custom browser voice indices where available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const enVoices = voices.filter((v) => v.lang.startsWith("en"));
        const useVoices = enVoices.length > 0 ? enVoices : voices;

        let voiceIndex = 0;
        switch (persona.persona_name) {
          case "Unit Economics Skeptic":
            voiceIndex = 0;
            break;
          case "Operator":
            voiceIndex = Math.min(1, useVoices.length - 1);
            break;
          case "Market Sizing Cynic":
            voiceIndex = Math.min(2, useVoices.length - 1);
            break;
          case "Competitive Landscape Hawk":
            voiceIndex = Math.min(3, useVoices.length - 1);
            break;
          case "Technical Diligence Partner":
            voiceIndex = Math.min(4, useVoices.length - 1);
            break;
          case "Distribution Realist":
            voiceIndex = Math.min(5, useVoices.length - 1);
            break;
        }
        utterance.voice = useVoices[voiceIndex];
      }

      utterance.onend = () => {
        currentIndex++;
        speakNext();
      };
      utterance.onerror = () => {
        currentIndex++;
        speakNext();
      };

      window.speechSynthesis.speak(utterance);
    };

    // Trigger sequential speech
    speakNext();
  };

  // Recording triggers for Pitch
  const startPitchRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result?.toString().split(",")[1] || null;
          setAudioBase64(base64data);
          setMimeType(blob.type);
        };
        reader.readAsDataURL(blob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      setError(null);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      setError("Please allow microphone frame permissions in your browser to record audio.");
    }
  };

  const stopPitchRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const discardPitchRecording = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setAudioBase64(null);
    setMimeType(null);
    setRecordingDuration(0);
  };

  // Recording triggers for Reply
  const startReplyRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      replyMediaRecorderRef.current = mediaRecorder;
      replyAudioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          replyAudioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(replyAudioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setReplyAudioUrl(url);
        setReplyAudioBlob(blob);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result?.toString().split(",")[1] || null;
          setReplyAudioBase64(base64data);
          setReplyMimeType(blob.type);
        };
        reader.readAsDataURL(blob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsReplyRecording(true);
      setReplyRecordingDuration(0);
      setError(null);

      replyTimerIntervalRef.current = window.setInterval(() => {
        setReplyRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      setError("Please allow microphone frame permissions to record audio response.");
    }
  };

  const stopReplyRecording = () => {
    if (replyMediaRecorderRef.current && isReplyRecording) {
      replyMediaRecorderRef.current.stop();
      setIsReplyRecording(false);
      if (replyTimerIntervalRef.current) {
        clearInterval(replyTimerIntervalRef.current);
        replyTimerIntervalRef.current = null;
      }
    }
  };

  const discardReplyRecording = () => {
    setReplyAudioUrl(null);
    setReplyAudioBlob(null);
    setReplyAudioBase64(null);
    setReplyMimeType(null);
    setReplyRecordingDuration(0);
  };

  // Transcribe pitch audio to text
  const handleTranscribePitch = async () => {
    if (!audioBase64) return;
    setTranscribing(true);
    setError(null);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: audioBase64,
          mimeType: mimeType,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to transcribe audio.");
      }

      setPitchText(data.transcription);
      setIsRecordingMode(false);
      discardPitchRecording();
    } catch (err: any) {
      setError(err.message || "Failed to transcribe audio.");
    } finally {
      setTranscribing(false);
    }
  };

  // Transcribe reply audio to text
  const handleTranscribeReply = async () => {
    if (!replyAudioBase64) return;
    setTranscribing(true);
    setError(null);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: replyAudioBase64,
          mimeType: replyMimeType,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to transcribe audio response.");
      }

      setReplyText(data.transcription);
      setIsReplyRecordingMode(false);
      discardReplyRecording();
    } catch (err: any) {
      setError(err.message || "Failed to transcribe response audio.");
    } finally {
      setTranscribing(false);
    }
  };

  // Submit initial pitch
  const handleGetInitialReactions = async () => {
    const hasInput = (isRecordingMode && audioBase64) || (!isRecordingMode && pitchText.trim().length > 0);
    if (!hasInput) {
      setError("Please write or record your startup pitch first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setVerdictResult(null);
    setNegotiationHistory([]);
    setCurrentRound(1);
    setExpandedPersonas({});

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitch: isRecordingMode ? undefined : pitchText,
          audio: isRecordingMode ? audioBase64 : undefined,
          mimeType: isRecordingMode ? mimeType : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Simulation failed.");
      }

      setResult(data);
      // Automatically read reaction lines aloud sequential
      speakReactions(data.personas);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please check your pitch text or voice recording clarity.");
    } finally {
      setLoading(false);
    }
  };

  // FEATURE 1: Submit Negotiation Response (Round 2 & 3)
  const handleGetNegotiateReaction = async () => {
    const hasInput =
      (isReplyRecordingMode && replyAudioBase64) || (!isReplyRecordingMode && replyText.trim().length > 0);
    if (!hasInput) {
      setError("Please provide your response to address the partners' objections.");
      return;
    }

    setLoading(true);
    setError(null);

    const originalPitchContext = result?.transcription || pitchText;
    const currentReplyContent = isReplyRecordingMode ? "SPOKEN AUDIO RESPONSE" : replyText;

    try {
      const response = await fetch("/api/simulate-negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitch: originalPitchContext,
          history: negotiationHistory,
          newResponse: isReplyRecordingMode ? undefined : replyText,
          audio: isReplyRecordingMode ? replyAudioBase64 : undefined,
          mimeType: isReplyRecordingMode ? replyMimeType : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Negotiation round failed.");
      }

      // Add completed previous round to history
      const updatedHistory = [
        ...negotiationHistory,
        {
          response: data.transcription || currentReplyContent,
          personas: result?.personas || [],
        },
      ];

      setNegotiationHistory(updatedHistory);
      setResult(data);
      const nextRound = currentRound + 1;
      setCurrentRound(nextRound);

      // Clean up input states
      setReplyText("");
      discardReplyRecording();
      setExpandedPersonas({});

      // Play reactions voice sequence
      speakReactions(data.personas);

      // Feature 1 Rule: After round 3 completes (meaning 3 rounds total of feedbacks are showing, and we have submitted 2 replies), automatically trigger Feature 2
      if (nextRound >= 3) {
        // Automatically fetch Closing Verdict using updated history
        await handleGetVerdict(updatedHistory);
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit response to the partners.");
    } finally {
      setLoading(false);
    }
  };

  // FEATURE 2: Get Final Verdict call
  const handleGetVerdict = async (overrideHistory?: HistoryRound[]) => {
    setLoadingVerdict(true);
    setError(null);

    const activeHistory = overrideHistory || negotiationHistory;
    const originalPitchContext = result?.transcription || pitchText;

    // Stop speaking reactions during final verdict process
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    try {
      const response = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitch: originalPitchContext,
          history: activeHistory,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to compile partners' votes.");
      }

      setVerdictResult(data);
    } catch (err: any) {
      setError(err.message || "Could not retrieve closing votes. Please try requesting verdict again.");
    } finally {
      setLoadingVerdict(false);
    }
  };

  // Clear session state to start over
  const handleStartOver = () => {
    setPitchText("");
    setReplyText("");
    discardPitchRecording();
    discardReplyRecording();
    setResult(null);
    setVerdictResult(null);
    setNegotiationHistory([]);
    setCurrentRound(1);
    setExpandedPersonas({});
    setError(null);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const handleSelectPreset = (presetPitch: string) => {
    setIsRecordingMode(false);
    setPitchText(presetPitch);
    discardPitchRecording();
    setError(null);
  };

  const togglePersonaExpand = (personaName: string) => {
    setExpandedPersonas((prev) => ({
      ...prev,
      [personaName]: !prev[personaName],
    }));
  };

  const handleExpandAll = () => {
    if (!result) return;
    const allExpanded: Record<string, boolean> = {};
    result.personas.forEach((p) => {
      allExpanded[p.persona_name] = true;
    });
    setExpandedPersonas(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedPersonas({});
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Get total vote counts for UI header
  const getInVotesCount = () => {
    if (!verdictResult) return 0;
    return verdictResult.verdicts.filter((v) => v.vote === "in").length;
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-between" id="app_root">
      {/* Top Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 py-4 px-6 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight text-zinc-900">
                VC Roundtable Simulator
              </h1>
              <p className="text-xs font-mono text-zinc-500 tracking-wider">
                PARTNER MEETING LEVEL-6 DILIGENCE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* FEATURE 3: Mute / Unmute speech synthesis button */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                isMuted
                  ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                  : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200"
              }`}
              title={isMuted ? "Unmute spoken reactions" : "Mute spoken reactions"}
              id="btn_mute_toggle"
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-rose-500" />
                  Muted
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-600 animate-bounce" />
                  Read Aloud
                </>
              )}
            </button>

            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE NEGOTIATOR v2
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* STATE 1: LOADING VERDICT OR SIMULATION */}
          {(loading || loadingVerdict) && (
            <motion.div
              key="meeting-loading"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white rounded-2xl border border-zinc-200 p-8 md:p-12 shadow-lg text-center max-w-xl mx-auto space-y-8"
            >
              <div className="relative flex items-center justify-center">
                {/* Boardroom Round Table Animation */}
                <div className="w-24 h-24 rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center relative animate-spin [animation-duration:9s]">
                  <div className="absolute top-1 w-3 h-3 rounded-full bg-rose-500" title="Skeptic" />
                  <div className="absolute right-1 w-3 h-3 rounded-full bg-amber-500" title="Operator" />
                  <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-yellow-500" title="Cynic" />
                  <div className="absolute bottom-1 left-1 w-3 h-3 rounded-full bg-sky-500" title="Hawk" />
                  <div className="absolute left-1 w-3 h-3 rounded-full bg-violet-500" title="Technical" />
                  <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-500" title="Distribution" />
                </div>
                <div className="absolute w-12 h-12 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-md">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-bold font-display tracking-tight text-zinc-900">
                  {loadingVerdict ? "Summoning Partner Votes" : "Investor Roundtable in Session"}
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  {loadingVerdict ? "COMPILING FINAL TERM SHEET DECISION" : `DUE DILIGENCE ACTIVE (ROUND ${currentRound} OF 3)`}
                </p>
              </div>

              {/* Status indicator logs */}
              <div className="h-16 flex items-center justify-center bg-zinc-50 border border-zinc-150 rounded-xl px-4">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentLogIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-sm text-zinc-700 font-medium font-sans text-center"
                  >
                    {loadingVerdict ? VERDICT_LOADING_LOGS[currentLogIndex] : LOADING_STATUS_LOGS[currentLogIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                <motion.div
                  className="bg-zinc-950 h-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "95%" }}
                  transition={{ duration: 12, ease: "easeOut" }}
                />
              </div>

              <p className="text-xs text-zinc-400">
                Partners will not soften their opinions. Every reaction represents their pure criteria.
              </p>
            </motion.div>
          )}

          {/* STATE 2: CLOSING VERDICT SCREEN */}
          {verdictResult && !loadingVerdict && (
            <motion.div
              key="closing-verdict-results"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Verdict Header Scoreboard */}
              <div className="bg-zinc-900 rounded-3xl p-8 md:p-10 text-white text-center shadow-xl border border-zinc-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Vote className="w-48 h-48" />
                </div>

                <span className="inline-block px-3 py-1.5 bg-white/10 text-amber-300 rounded-full font-mono text-xs font-semibold uppercase tracking-wider mb-4">
                  Final Roundtable Verdict
                </span>

                <h2 className="text-4xl md:text-5xl font-black font-display tracking-tight leading-none">
                  {getInVotesCount()} of 6 partners would take this further
                </h2>

                <p className="text-zinc-400 mt-3 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                  Based on your original pitch and {negotiationHistory.length} negotiation round{negotiationHistory.length === 1 ? "" : "s"} of feedback, here is where you stand with each VC.
                </p>

                {/* Scoreboard count indicator */}
                <div className="mt-6 flex justify-center gap-2">
                  {verdictResult.verdicts.map((v, idx) => (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full ${
                        v.vote === "in"
                          ? "bg-emerald-500"
                          : v.vote === "need_more_info"
                          ? "bg-yellow-500"
                          : "bg-rose-500"
                      }`}
                      title={`${v.persona_name}: ${v.vote.toUpperCase()}`}
                    />
                  ))}
                </div>
              </div>

              {/* Pitch Context Accordion in Verdict */}
              <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm space-y-4">
                <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                  Original Pitch Evaluated
                </h3>
                <blockquote className="bg-zinc-50 border-l-4 border-l-zinc-800 p-4 rounded-r-xl italic text-zinc-700 text-sm md:text-base">
                  &ldquo;{result?.transcription || pitchText}&rdquo;
                </blockquote>
              </div>

              {/* Six partners individual verdicts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {verdictResult.verdicts.map((verdict, idx) => {
                  const meta = PERSONA_METADATA[verdict.persona_name] || {
                    subtitle: "Investor Panelist",
                    bgClass: "bg-zinc-50",
                    borderClass: "border-zinc-200",
                    textClass: "text-zinc-800",
                    iconBgClass: "bg-zinc-100 text-zinc-600",
                    borderAccentClass: "border-l-4 border-l-zinc-400",
                    icon: DollarSign,
                  };
                  const IconComponent = meta.icon;

                  // Vote Badge Styles
                  let badgeText = "PASS";
                  let badgeClass = "bg-rose-100 text-rose-800 border-rose-200";
                  let VoteIcon = ThumbsDown;

                  if (verdict.vote === "in") {
                    badgeText = "IN (INVEST)";
                    badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
                    VoteIcon = ThumbsUp;
                  } else if (verdict.vote === "need_more_info") {
                    badgeText = "NEED MORE INFO";
                    badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-200";
                    VoteIcon = HelpCircle;
                  }

                  return (
                    <div
                      key={verdict.persona_name}
                      className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm flex flex-col justify-between ${meta.borderAccentClass}`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg ${meta.iconBgClass} flex items-center justify-center font-bold`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-zinc-900 text-sm leading-snug">
                                {idx + 1}. {verdict.persona_name}
                              </h4>
                              <p className="text-xs text-zinc-500">
                                {meta.subtitle}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-xxs font-bold tracking-wider uppercase border ${badgeClass} flex items-center gap-1`}>
                            <VoteIcon className="w-3 h-3" />
                            {badgeText}
                          </span>
                        </div>

                        <div className="bg-zinc-50 rounded-xl p-3.5 border border-zinc-150">
                          <span className="text-xxs font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                            Closing decision rationale:
                          </span>
                          <p className="text-zinc-800 text-sm leading-relaxed italic">
                            &ldquo;{verdict.reason}&rdquo;
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Start Over Button */}
              <div className="flex justify-center pt-6">
                <button
                  onClick={handleStartOver}
                  className="py-4 px-10 rounded-2xl font-bold text-base bg-zinc-950 hover:bg-zinc-850 text-white shadow-lg flex items-center gap-2 transition-all active:scale-98"
                  id="btn_start_over"
                >
                  <RotateCcw className="w-5 h-5" />
                  Start from Scratch
                </button>
              </div>
            </motion.div>
          )}

          {/* STATE 3: PITCH INPUT SCREEN */}
          {!loading && !loadingVerdict && !result && !verdictResult && (
            <motion.div
              key="pitch-input-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Introduction Card */}
              <div className="bg-white rounded-3xl p-6 md:p-8 border border-zinc-200 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Sparkles className="w-32 h-32" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-zinc-900">
                  Negotiate with the Partners
                </h2>
                <p className="text-zinc-600 mt-2 text-sm md:text-base leading-relaxed">
                  Submit your startup pitch. You can then defend your claims, address objections over a multi-round loop, and trigger final investment votes from six individual VC persona judges.
                </p>

                {/* Preset Pitch Selectors */}
                <div className="mt-5 border-t border-zinc-100 pt-4">
                  <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
                    Quick Sandbox Presets:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PITCH_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset.pitch)}
                        className="text-xs px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-medium transition-all active:scale-98"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pitch Editor Workspace */}
              <div className="bg-white rounded-3xl border border-zinc-200 shadow-lg overflow-hidden">
                {/* Mode Selector Tabs */}
                <div className="flex border-b border-zinc-100 bg-zinc-50/50 p-2 gap-2">
                  <button
                    onClick={() => {
                      setIsRecordingMode(false);
                      discardPitchRecording();
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      !isRecordingMode
                        ? "bg-white text-zinc-900 shadow-xs border border-zinc-150"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Write Startup Pitch
                  </button>
                  <button
                    onClick={() => setIsRecordingMode(true)}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      isRecordingMode
                        ? "bg-white text-zinc-900 shadow-xs border border-zinc-150"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    Record Voice Pitch
                  </button>
                </div>

                <div className="p-6">
                  {/* Editor View */}
                  {!isRecordingMode ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                          Startup Elevator Pitch
                        </label>
                        <span className="text-xs font-mono text-zinc-400">
                          {pitchText.length} characters
                        </span>
                      </div>
                      <textarea
                        value={pitchText}
                        onChange={(e) => setPitchText(e.target.value)}
                        placeholder="Paste or type your pitch here (a few sentences is enough, e.g., describing what problem you solve, who your customers are, and your business model)..."
                        className="w-full h-40 md:h-48 p-4 text-zinc-800 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 resize-none placeholder-zinc-400 text-sm md:text-base leading-relaxed"
                        id="pitch_textarea"
                      />
                    </div>
                  ) : (
                    /* Recorder View */
                    <div className="py-6 flex flex-col items-center justify-center space-y-6">
                      <div className="text-center space-y-1">
                        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                          Multimodal Voice Recorder
                        </span>
                        <h3 className="text-lg font-bold text-zinc-900">
                          {isRecording ? "Listening to your pitch..." : "Speak naturally about your startup"}
                        </h3>
                        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                          Gemini will read your voice directly to analyze tone, passion, and flow.
                        </p>
                      </div>

                      {/* Record Button */}
                      <div className="relative flex items-center justify-center">
                        {isRecording && (
                          <span className="absolute w-24 h-24 rounded-full bg-rose-500/15 animate-ping" />
                        )}
                        <button
                          onClick={isRecording ? stopPitchRecording : startPitchRecording}
                          className={`w-18 h-18 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95 ${
                            isRecording ? "bg-rose-600 hover:bg-rose-700" : "bg-zinc-900 hover:bg-zinc-850"
                          }`}
                          id="voice_record_button"
                          title={isRecording ? "Stop Recording" : "Start Recording"}
                        >
                          {isRecording ? <Square className="w-6 h-6 fill-white" /> : <Mic className="w-6 h-6" />}
                        </button>
                      </div>

                      {/* Duration Counter */}
                      <div className="font-mono text-xl font-bold text-zinc-800">
                        {formatTime(recordingDuration)}
                      </div>

                      {/* Audio Playback Preview & Helper transcription */}
                      {audioUrl && !isRecording && (
                        <div className="w-full max-w-md bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-zinc-500 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Recorded Successfully
                            </span>
                            <button
                              onClick={discardPitchRecording}
                              className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                            >
                              Discard
                            </button>
                          </div>
                          <audio src={audioUrl} controls className="w-full h-8" />

                          {/* Audio Transcription helper button */}
                          <div className="pt-2 border-t border-zinc-200/60">
                            <button
                              type="button"
                              onClick={handleTranscribePitch}
                              disabled={transcribing}
                              className="w-full py-2 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                              id="btn_transcribe_audio"
                            >
                              {transcribing ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  Transcribing Speech...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  Transcribe Voice Pitch to Text (to edit)
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Error Displays */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3"
                    >
                      <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-rose-800 font-medium">{error}</div>
                    </motion.div>
                  )}

                  {/* Action Bar */}
                  <div className="mt-6 pt-6 border-t border-zinc-100 flex items-center justify-between">
                    <button
                      onClick={handleStartOver}
                      className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 rounded-lg transition-all"
                    >
                      Clear State
                    </button>

                    <button
                      onClick={handleGetInitialReactions}
                      disabled={
                        (!isRecordingMode && pitchText.trim().length === 0) ||
                        (isRecordingMode && !audioBase64) ||
                        isRecording
                      }
                      className={`py-3.5 px-6 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-md transition-all active:scale-98 ${
                        (!isRecordingMode && pitchText.trim().length === 0) ||
                        (isRecordingMode && !audioBase64) ||
                        isRecording
                          ? "bg-zinc-250 text-zinc-400 cursor-not-allowed shadow-none"
                          : "bg-zinc-950 hover:bg-zinc-850 text-white"
                      }`}
                      id="btn_get_reactions"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      Get Initial Reactions
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STATE 4: REACTION BOARD & ACTIVE NEGOTIATION */}
          {result && !loading && !loadingVerdict && !verdictResult && (
            <motion.div
              key="simulation-results"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Pitch Summary Overview */}
              <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                    DILIGENCED STARTUP PITCH
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-900 text-white">
                    Round {currentRound} of 3
                  </span>
                </div>
                <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-150">
                  <p className="text-zinc-700 text-sm md:text-base leading-relaxed italic">
                    &ldquo;{result.transcription}&rdquo;
                  </p>
                </div>
              </div>

              {/* Expansion Control Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-display text-zinc-900">
                    Investor Reactions Panel
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Click cards to review sharp objections and follow-up questions
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExpandAll}
                    className="text-xs font-semibold py-2 px-3 rounded-lg border border-zinc-250 bg-white hover:bg-zinc-50 text-zinc-700 shadow-xs"
                  >
                    Expand All Details
                  </button>
                  <button
                    onClick={handleCollapseAll}
                    className="text-xs font-semibold py-2 px-3 rounded-lg border border-zinc-250 bg-white hover:bg-zinc-50 text-zinc-700 shadow-xs"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* 6 Persona Reaction Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="reactions_grid">
                {result.personas.map((persona, idx) => {
                  const meta = PERSONA_METADATA[persona.persona_name] || {
                    subtitle: "Investor Panelist",
                    bgClass: "bg-zinc-50",
                    borderClass: "border-zinc-200",
                    textClass: "text-zinc-800",
                    iconBgClass: "bg-zinc-100 text-zinc-600",
                    borderAccentClass: "border-l-4 border-l-zinc-400",
                    icon: DollarSign,
                  };
                  const IconComponent = meta.icon;
                  const isExpanded = !!expandedPersonas[persona.persona_name];

                  return (
                    <motion.div
                      key={persona.persona_name}
                      layout="position"
                      onClick={() => togglePersonaExpand(persona.persona_name)}
                      className={`rounded-2xl border ${meta.borderClass} ${meta.bgClass} ${meta.borderAccentClass} p-5 shadow-sm transition-all cursor-pointer flex flex-col justify-between`}
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg ${meta.iconBgClass} flex items-center justify-center font-bold`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-zinc-900 text-base leading-tight">
                                {idx + 1}. {persona.persona_name}
                              </h4>
                              <p className="text-xs text-zinc-500 font-medium">
                                {meta.subtitle}
                              </p>
                            </div>
                          </div>
                          <div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-zinc-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-zinc-400 animate-pulse" />
                            )}
                          </div>
                        </div>

                        {/* Immediate reaction (collapsed preview) */}
                        <div className="mt-4 text-zinc-800 text-sm md:text-sm leading-relaxed font-semibold">
                          &ldquo;{persona.reaction_line}&ldquo;
                        </div>

                        {/* Expanded details */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden mt-4 pt-4 border-t border-zinc-250/50 space-y-4"
                            >
                              <div className="space-y-1">
                                <span className="text-xs font-mono font-bold text-rose-700 uppercase tracking-wide">
                                  Sharp Objection:
                                </span>
                                <p className="text-zinc-700 text-sm leading-relaxed bg-white/50 p-2.5 rounded-lg border border-rose-100/60 font-sans">
                                  {persona.sharp_objection}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <span className="text-xs font-mono font-bold text-zinc-700 uppercase tracking-wide">
                                  Follow-up Question:
                                </span>
                                <p className="text-zinc-800 text-sm leading-relaxed font-semibold italic bg-white/50 p-2.5 rounded-lg border border-zinc-150/60 font-sans">
                                  &ldquo;{persona.follow_up_question}&rdquo;
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Click indicator when collapsed */}
                      {!isExpanded && (
                        <div className="text-xxs font-mono text-zinc-400 mt-3 text-right">
                          Click to expand objections & follow-up questions
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* FEATURE 1: MULTI-ROUND NEGOTIATION INTERACTIVE FORM */}
              {currentRound < 3 ? (
                <div className="bg-white rounded-3xl border border-zinc-200 shadow-md overflow-hidden mt-6">
                  <div className="bg-zinc-900 p-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-amber-300 animate-pulse" />
                      <h4 className="font-bold text-sm md:text-base font-display">
                        Respond to the Panel (Round {currentRound} of 2 responses remaining)
                      </h4>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      ADDRESS OBJECTIONS
                    </span>
                  </div>

                  {/* Selector Tabs for reply input */}
                  <div className="flex border-b border-zinc-100 bg-zinc-50/50 p-2 gap-2">
                    <button
                      onClick={() => {
                        setIsReplyRecordingMode(false);
                        discardReplyRecording();
                      }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                        !isReplyRecordingMode
                          ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Write Reply
                    </button>
                    <button
                      onClick={() => setIsReplyRecordingMode(true)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                        isReplyRecordingMode
                          ? "bg-white text-zinc-900 shadow-xs border border-zinc-200"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      Record Voice Reply
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    {!isReplyRecordingMode ? (
                      /* Written reply textarea */
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Address one or more of their objections... (explain your financial margins, defensive technical moat, or specific customer acquisition plan)"
                        className="w-full h-24 p-3 text-zinc-800 border border-zinc-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 text-sm"
                      />
                    ) : (
                      /* Vocal reply recording box */
                      <div className="py-4 flex flex-col items-center justify-center space-y-3">
                        <p className="text-xs text-zinc-500 text-center">
                          {isReplyRecording ? "Recording your reply..." : "Speak directly to defend your startup idea"}
                        </p>

                        <div className="flex items-center gap-4">
                          <button
                            onClick={isReplyRecording ? stopReplyRecording : startReplyRecording}
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-all active:scale-95 ${
                              isReplyRecording ? "bg-rose-600 hover:bg-rose-700" : "bg-zinc-900 hover:bg-zinc-800"
                            }`}
                          >
                            {isReplyRecording ? <Square className="w-4 h-4 fill-white" /> : <Mic className="w-4 h-4" />}
                          </button>

                          <div className="font-mono text-sm font-bold text-zinc-800">
                            {formatTime(replyRecordingDuration)}
                          </div>
                        </div>

                        {/* Speech reply playback pre-transcription */}
                        {replyAudioUrl && !isReplyRecording && (
                          <div className="w-full max-w-sm bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 text-center">
                            <audio src={replyAudioUrl} controls className="w-full h-8" />
                            <div className="flex justify-between items-center pt-1.5">
                              <button
                                type="button"
                                onClick={handleTranscribeReply}
                                disabled={transcribing}
                                className="px-3 py-1 rounded-md bg-zinc-150 hover:bg-zinc-200 text-zinc-700 text-xxs font-bold flex items-center gap-1"
                              >
                                {transcribing ? "Transcribing..." : "Transcribe reply to text"}
                              </button>
                              <button
                                onClick={discardReplyRecording}
                                className="text-xxs text-rose-600 font-semibold"
                              >
                                Discard Recording
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {error && (
                      <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs font-semibold rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    {/* Multi-round controls bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-100">
                      {/* Skip to Verdict early button */}
                      <button
                        onClick={() => handleGetVerdict()}
                        className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center justify-center gap-1.5 border border-zinc-200"
                      >
                        <Vote className="w-4 h-4 text-amber-500" />
                        Get Final Verdict Early
                      </button>

                      <button
                        onClick={handleGetNegotiateReaction}
                        disabled={
                          (!isReplyRecordingMode && replyText.trim().length === 0) ||
                          (isReplyRecordingMode && !replyAudioBase64) ||
                          isReplyRecording
                        }
                        className={`w-full sm:w-auto py-2.5 px-6 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98 ${
                          (!isReplyRecordingMode && replyText.trim().length === 0) ||
                          (isReplyRecordingMode && !replyAudioBase64) ||
                          isReplyRecording
                            ? "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"
                            : "bg-zinc-900 hover:bg-zinc-800 text-white"
                        }`}
                      >
                        Submit Response to Panel
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Back & start over control bars */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
                <button
                  onClick={handleStartOver}
                  className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-all"
                >
                  Restart Session
                </button>

                {/* Manual Verdict trigger is shown only if round < 3 (if currentRound === 3 the automatic trigger has already been fired) */}
                {currentRound < 3 && (
                  <button
                    onClick={() => handleGetVerdict()}
                    className="py-2.5 px-6 rounded-xl font-bold text-xs bg-zinc-900 hover:bg-zinc-800 text-white shadow-md flex items-center gap-1.5"
                  >
                    <Vote className="w-4 h-4 text-amber-300 animate-pulse" />
                    Get Final Verdict
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 px-6 text-center text-xs text-zinc-400 font-mono tracking-wide">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>VC Roundtable Simulator &copy; 2026. Sandbox Environment.</p>
          <p className="flex items-center gap-1.5 justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Backend Proxy Secured &bull; Gemini-3.5-Flash
          </p>
        </div>
      </footer>
    </div>
  );
}
