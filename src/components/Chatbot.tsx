import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Mic, MicOff } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `Eres el asistente virtual de DevStudio Pro, una agencia de desarrollo de software premium.
Tu objetivo es responder dudas de los clientes basándote ÚNICAMENTE en la siguiente información de la página:
- Servicios: Desarrollo Web Premium, Apps Administrativas, Integración de IA.
- Portafolio: E-Commerce Global (con IA predictiva), Dashboard Financiero (análisis en tiempo real).
- Metodología (4 pasos): 1. Descubrimiento, 2. Diseño UI/UX, 3. Desarrollo, 4. Lanzamiento.
- Precios base: Landing Page (800€), E-Commerce (2,500€), App Administrativa (4,000€), Plataforma con IA (5,500€).
- Extras: SEO Avanzado (+450€), Sistema de Usuarios (+600€), Pasarela de Pagos (+800€), Chatbot IA (+1,200€).
- Planes de Suscripción (Desarrollo Web): Starter (99€/mes), Business (249€/mes), Enterprise (A Medida).
- Planes de Suscripción (Apps): Starter (199€/mes), Business (499€/mes), Enterprise (A Medida).
IMPORTANTE: Todos los precios están en Euros (€). Nunca menciones dólares ($) ni otras monedas.
Sé amable, profesional, conciso y persuasivo. Invita al usuario a usar el configurador de cotización o a contactarnos.`;

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
    { role: 'model', text: '¡Hola! Soy el asistente de DevStudio Pro. ¿En qué puedo ayudarte hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Voice mode states
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isConnectingVoice, setIsConnectingVoice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const playbackSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    if (!chatRef.current) {
      chatRef.current = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        }
      });
    }
    
    // Cleanup on unmount
    return () => {
      stopVoiceMode();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || isVoiceMode) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userText });
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Lo siento, ha ocurrido un error al procesar tu mensaje. Por favor, intenta de nuevo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoiceMode = async () => {
    if (isVoiceMode || isConnectingVoice) {
      stopVoiceMode();
      return;
    }

    setIsConnectingVoice(true);
    try {
      // Setup Audio Context for output
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextPlayTimeRef.current = audioContextRef.current.currentTime;

      // Setup Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      const source = inputAudioCtx.createMediaStreamSource(stream);
      const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputAudioCtx.destination);

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            setIsConnectingVoice(false);
            setIsVoiceMode(true);
            setMessages(prev => [...prev, { role: 'model', text: '🎙️ Modo voz activado. Te escucho...' }]);

            processor.onaudioprocess = (e) => {
              const channelData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(channelData.length);
              for (let i = 0; i < channelData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, channelData[i])) * 0x7FFF;
              }
              const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.interrupted) {
              playbackSourcesRef.current.forEach(src => {
                try { src.stop(); } catch (e) {}
              });
              playbackSourcesRef.current = [];
              if (audioContextRef.current) {
                nextPlayTimeRef.current = audioContextRef.current.currentTime;
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const binaryString = atob(base64Audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytes.buffer);
              const audioBuffer = audioContextRef.current.createBuffer(1, pcm16.length, 24000);
              const channelData = audioBuffer.getChannelData(0);
              for (let i = 0; i < pcm16.length; i++) {
                channelData[i] = pcm16[i] / 0x7FFF;
              }

              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current.destination);

              if (nextPlayTimeRef.current < audioContextRef.current.currentTime) {
                nextPlayTimeRef.current = audioContextRef.current.currentTime;
              }
              source.start(nextPlayTimeRef.current);
              nextPlayTimeRef.current += audioBuffer.duration;
              playbackSourcesRef.current.push(source);
              
              source.onended = () => {
                playbackSourcesRef.current = playbackSourcesRef.current.filter(s => s !== source);
              };
            }
          },
          onclose: () => {
            stopVoiceMode();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            stopVoiceMode();
          }
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error("Failed to start voice mode:", err);
      setIsConnectingVoice(false);
      setMessages(prev => [...prev, { role: 'model', text: '❌ Error al acceder al micrófono o conectar con el servidor de voz.' }]);
    }
  };

  const stopVoiceMode = () => {
    setIsVoiceMode(false);
    setIsConnectingVoice(false);
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      audioContextRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => {
        try { session.close(); } catch (e) {}
      });
      sessionRef.current = null;
    }
    playbackSourcesRef.current.forEach(src => {
      try { src.stop(); } catch (e) {}
    });
    playbackSourcesRef.current = [];
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[350px] sm:w-[400px] h-[500px] max-h-[80vh] bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div className="bg-gray-50 dark:bg-[#0A0A0A] p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#B8FA2E] rounded-full flex items-center justify-center text-[#0A0A0A]">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Asistente DevStudio</h3>
                <p className="text-xs text-green-600 dark:text-[#B8FA2E] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-[#B8FA2E] animate-pulse"></span>
                  En línea
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-[#111827]">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300' : 'bg-[#B8FA2E]/20 text-[#B8FA2E]'}`}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-tr-sm' : 'bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-200 rounded-tl-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-2 max-w-[85%] flex-row">
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-1 bg-[#B8FA2E]/20 text-[#B8FA2E]">
                    <Bot size={14} />
                  </div>
                  <div className="p-3 rounded-2xl text-sm bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-200 rounded-tl-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-[#B8FA2E]" />
                    <span className="text-xs text-gray-500">Escribiendo...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-gray-50 dark:bg-[#0A0A0A] border-t border-gray-200 dark:border-white/10">
            <form onSubmit={handleSend} className="flex gap-2">
              <button
                type="button"
                onClick={toggleVoiceMode}
                disabled={isConnectingVoice}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${isVoiceMode ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20'} disabled:opacity-50`}
                title={isVoiceMode ? "Detener voz" : "Hablar por voz"}
              >
                {isConnectingVoice ? <Loader2 size={18} className="animate-spin" /> : (isVoiceMode ? <MicOff size={18} /> : <Mic size={18} />)}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isVoiceMode ? "Habla ahora..." : "Escribe tu pregunta..."}
                disabled={isLoading || isVoiceMode}
                className="flex-1 bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#B8FA2E]/50 disabled:opacity-50"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isLoading || isVoiceMode}
                className="w-10 h-10 bg-[#B8FA2E] text-[#0A0A0A] rounded-xl flex items-center justify-center hover:bg-[#a3e61c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send size={18} className={input.trim() && !isLoading && !isVoiceMode ? 'translate-x-0.5 -translate-y-0.5 transition-transform' : ''} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full bg-[#B8FA2E] text-[#0A0A0A] shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center ${isOpen ? 'rotate-90 scale-0 opacity-0 absolute' : 'rotate-0 scale-100 opacity-100'}`}
      >
        <MessageCircle size={28} />
      </button>
    </div>
  );
}
