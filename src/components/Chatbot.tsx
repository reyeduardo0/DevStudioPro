import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Mic, MicOff } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_INSTRUCTION = `Tu nombre es Dev, la arquitecta de IA y asistente virtual de DevStudio Pro.
Tu objetivo es guiar a los clientes basándote en esta información:
- Precios base: Landing Page (800€), E-Commerce (2.000€), App Administrativa (2.500€), Plataforma con IA (3.000€).
- Extras: SEO Avanzado (+450€), Sistema de Usuarios (+600€), Pasarela de Pagos (+800€), Chatbot IA (+1.200€).
- Regla: Todos los precios en Euros (€). Sé profesional y persuasiva. Menciona que ahora cuento con integración directa con el Cotizador Inteligente para dar recomendaciones personalizadas.`;

const DEV_AVATAR = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&h=256&auto=format&fit=crop";
const USER_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=User&backgroundColor=6366f1";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
    { role: 'model', text: '¡Hola! Soy Dev, la arquitecta de IA de DevStudio Pro. Estoy aquí para ayudarte a transformar tu visión en una realidad digital. ¿En qué puedo asesorarte hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Voice mode states
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isConnectingVoice, setIsConnectingVoice] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

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
    if (!ai) return;
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
      if (!chatRef.current) {
        setMessages(prev => [...prev, { role: 'model', text: 'El asistente de IA no está configurado correctamente (falta la clave de API).' }]);
        return;
      }
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

    setMicError(null);
    setIsConnectingVoice(true);
    try {
      if (!ai) throw new Error("AI not initialized");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("MediaDevicesNotSupported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      mediaStreamRef.current = stream;

      // Setup Audio Context for output after getting permission
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      await audioContextRef.current.resume();
      nextPlayTimeRef.current = audioContextRef.current.currentTime;

      const inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
      await inputAudioCtx.resume();
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
          outputAudioTranscription: {},
          inputAudioTranscription: {},
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

            // Handle Transcriptions
            if (message.serverContent?.modelTurn) {
              const parts = message.serverContent.modelTurn.parts;
              parts.forEach(part => {
                if (part.text) {
                  setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'model' && lastMsg.text.startsWith('🎙️')) {
                      return [...prev.slice(0, -1), { role: 'model', text: part.text }];
                    } else if (lastMsg && lastMsg.role === 'model') {
                      return [...prev.slice(0, -1), { role: 'model', text: lastMsg.text + part.text }];
                    }
                    return [...prev, { role: 'model', text: part.text }];
                  });
                }
              });
            }

            // Correct Transcription Handling based on skill
            const msg: any = message;
            if (msg.inputTranscription) {
              setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'user') {
                  return [...prev.slice(0, -1), { role: 'user', text: msg.inputTranscription }];
                }
                return [...prev, { role: 'user', text: msg.inputTranscription }];
              });
            }
            if (msg.outputTranscription) {
              // Usually the text is already in modelTurn, but depends on version
            }

            const base64Audio = message.serverContent?.modelTurn?.parts.find(p => p.inlineData)?.inlineData?.data;
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

    } catch (err: any) {
      console.error("Failed to start voice mode:", err);
      setIsConnectingVoice(false);
      
      let errorMessage = 'Error al conectar con el servidor de voz.';
      const isIframe = window.self !== window.top;

      if (err.message === 'MediaDevicesNotSupported') {
        errorMessage = 'Tu navegador no soporta el acceso al micrófono en este entorno. Por favor, intenta abrir la aplicación en una nueva pestaña o usa un navegador moderno.';
      } else if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        if (isIframe) {
          errorMessage = 'El micrófono está bloqueado en esta vista previa incrustada. Por favor, haz clic en el botón "Abrir en una nueva pestaña" (arriba a la derecha) para poder usar la voz.';
        } else {
          errorMessage = 'Permiso de micrófono denegado. Haz clic en el ícono del candado 🔒 en la barra de direcciones de tu navegador y permite el acceso al micrófono.';
        }
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No se encontró ningún micrófono conectado a tu dispositivo.';
      }
      
      setMicError(errorMessage);
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
              <div className="relative">
                <img 
                  src={DEV_AVATAR} 
                  alt="Dev Avatar" 
                  className="w-10 h-10 rounded-full border-2 border-[#B8FA2E] object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-[#0A0A0A] rounded-full"></span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Asistente Dev</h3>
                <p className="text-xs text-green-600 dark:text-[#B8FA2E] flex items-center gap-1">
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-[#111827] relative">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <img 
                    src={msg.role === 'user' ? USER_AVATAR : DEV_AVATAR} 
                    alt="Avatar" 
                    className="w-8 h-8 rounded-full flex-shrink-0 object-contain mt-1 border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5"
                    referrerPolicy="no-referrer"
                  />
                  <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-tr-sm' : 'bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-200 rounded-tl-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[85%] flex-row">
                  <img 
                    src={DEV_AVATAR} 
                    alt="Dev Avatar" 
                    className="w-8 h-8 rounded-full flex-shrink-0 object-contain mt-1 border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5"
                    referrerPolicy="no-referrer"
                  />
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
          <div className="bg-gray-50 dark:bg-[#0A0A0A] border-t border-gray-200 dark:border-white/10 flex flex-col">
            {micError && (
              <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 p-3 flex items-start gap-2">
                <div className="text-red-500 mt-0.5">
                  <MicOff size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                    {micError}
                  </p>
                  <button 
                    onClick={() => setMicError(null)}
                    className="text-xs font-medium text-red-600 dark:text-red-300 mt-1 hover:underline"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}
            <div className="p-4">
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
