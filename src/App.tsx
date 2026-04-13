/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';
import Chatbot from './components/Chatbot';

function AnimatedCounter({ from = 0, to, duration = 2.5, prefix, suffix }: { from?: number, to: number, duration?: number, prefix?: React.ReactNode, suffix?: React.ReactNode }) {
  const [count, setCount] = useState(from);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (nodeRef.current) {
      observer.observe(nodeRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (inView) {
      let startTimestamp: number | null = null;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
        // easeOutExpo for smoother deceleration
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setCount(Math.floor(easeProgress * (to - from) + from));
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };
      window.requestAnimationFrame(step);
    }
  }, [inView, from, to, duration]);

  return (
    <div ref={nodeRef} className="text-4xl md:text-5xl font-bold text-white mb-2 flex items-baseline justify-center gap-0.5">
      {prefix && <span>{prefix}</span>}
      <span className="tabular-nums tracking-tight">{count}</span>
      {suffix && <span>{suffix}</span>}
    </div>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState('web');
  const [activeDemoTab, setActiveDemoTab] = useState('web');
  const [pricingType, setPricingType] = useState('web');
  const [subscriptionType, setSubscriptionType] = useState('web');
  const [selectedProject, setSelectedProject] = useState('landing');
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [totalPrice, setTotalPrice] = useState(800);
  const [expandedService, setExpandedService] = useState<number | null>(null);

  // OCR State
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrData, setOcrData] = useState<{ provider: string, total: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contact Form State
  const [contactForm, setContactForm] = useState({ name: '', email: '', details: '' });
  const [contactErrors, setContactErrors] = useState({ name: '', email: '', details: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let isValid = true;
    const errors = { name: '', email: '', details: '' };

    if (!contactForm.name.trim()) {
      errors.name = 'El nombre es obligatorio';
      isValid = false;
    }
    
    if (!contactForm.email.trim()) {
      errors.email = 'El email es obligatorio';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email)) {
      errors.email = 'Email inválido';
      isValid = false;
    }

    if (!contactForm.details.trim()) {
      errors.details = 'Los detalles son obligatorios';
      isValid = false;
    } else if (contactForm.details.trim().length < 10) {
      errors.details = 'Por favor, proporciona más detalles (mínimo 10 caracteres)';
      isValid = false;
    }

    setContactErrors(errors);

    if (isValid) {
      setIsSubmitting(true);
      // Simulate API call
      setTimeout(() => {
        setIsSubmitting(false);
        setSubmitSuccess(true);
        setContactForm({ name: '', email: '', details: '' });
        setTimeout(() => setSubmitSuccess(false), 5000);
      }, 1500);
    }
  };

  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start center", "end center"]
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setOcrImage(base64String);
      setOcrLoading(true);
      setOcrData(null);

      try {
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });
        
        // Extract base64 data without the data:image/... prefix
        const base64Data = base64String.split(',')[1];

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type
              }
            },
            "Extract the provider name (proveedor) and the total amount to pay (total a pagar) from this invoice or ticket. Return ONLY a valid JSON object with 'provider' and 'total' keys. Do not include markdown formatting or any other text."
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                provider: { type: Type.STRING, description: "The name of the provider or store." },
                total: { type: Type.STRING, description: "The total amount to pay, including currency symbol if present." }
              },
              required: ["provider", "total"]
            }
          }
        });

        if (response.text) {
          const data = JSON.parse(response.text);
          setOcrData(data);
        }
      } catch (error) {
        console.error("Error extracting data:", error);
        setOcrData({ provider: "Error al extraer", total: "---" });
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const [bars, setBars] = useState([
    { id: 1, height: 30, isHighlight: false },
    { id: 2, height: 45, isHighlight: false },
    { id: 3, height: 60, isHighlight: false },
    { id: 4, height: 85, isHighlight: true },
    { id: 5, height: 50, isHighlight: false },
    { id: 6, height: 70, isHighlight: false }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBars(prev => prev.map((bar, i) => {
        let newHeight = bar.height + (Math.random() * 40 - 20);
        newHeight = Math.max(20, Math.min(95, newHeight));
        
        // Make the 4th bar (index 3) always trend high to show the main "increase"
        if (i === 3) {
          newHeight = Math.max(75, Math.min(100, bar.height + (Math.random() * 20 - 5)));
        }

        return { 
          ...bar, 
          height: newHeight,
          isHighlight: i === 3 || newHeight > 80 
        };
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    let total = 0;
    if (selectedProject === 'landing') total += 800;
    if (selectedProject === 'ecommerce') total += 2500;
    if (selectedProject === 'admin_app') total += 4000;
    if (selectedProject === 'ia_integration') total += 5500;

    if (features['seo']) total += 450;
    if (features['login']) total += 600;
    if (features['payments']) total += 800;
    if (features['chatbot']) total += 1200;

    setTotalPrice(total);
  }, [selectedProject, features]);

  const toggleFeature = (feature: string) => {
    setFeatures((prev) => ({ ...prev, [feature]: !prev[feature] }));
  };

  return (
    <div className="bg-gray-50 text-gray-900 dark:bg-[#0A0A0A] dark:text-white overflow-x-hidden antialiased selection:bg-[#B8FA2E] selection:text-[#0A0A0A] min-h-screen transition-colors duration-300 font-sans">
      <nav className="fixed w-full z-50 bg-white/70 dark:bg-[#0A0A0A]/70 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 py-4 transition-all duration-300">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <a href="#" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#B8FA2E] rounded-xl flex items-center justify-center font-display font-bold text-[#0A0A0A] text-xl">
              D
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-gray-900 dark:text-white">
              DevStudio <span className="text-[#B8FA2E]">Pro</span>
            </span>
          </a>
          <div className="hidden md:flex gap-8 text-sm font-medium text-gray-600 dark:text-gray-300">
            <a href="#servicios" className="hover:text-[#B8FA2E] dark:hover:text-[#B8FA2E] transition-colors">Servicios</a>
            <a href="#portafolio" className="hover:text-[#B8FA2E] dark:hover:text-[#B8FA2E] transition-colors">Portafolio</a>
            <a href="#proceso" className="hover:text-[#B8FA2E] dark:hover:text-[#B8FA2E] transition-colors">Metodología</a>
            <a href="#suscripciones" className="hover:text-[#B8FA2E] dark:hover:text-[#B8FA2E] transition-colors">Planes</a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDark(!isDark)}
              className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-[#B8FA2E] transition-colors"
              title="Cambiar tema"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
                </svg>
              )}
            </button>

            <a
              href="#contacto"
              className="hidden md:inline-flex px-6 py-2.5 rounded-lg bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-white hover:bg-[#B8FA2E] hover:text-[#0A0A0A] dark:hover:bg-[#B8FA2E] dark:hover:text-[#0A0A0A] text-sm font-semibold transition-all duration-300 border border-transparent dark:border-white/10"
            >
              Contactar
            </a>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-[#0A0A0A] border-b border-gray-200 dark:border-white/10 shadow-xl py-4 px-6 flex flex-col gap-4 animate-in slide-in-from-top-2">
            <a href="#servicios" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-800 dark:text-gray-200 font-medium hover:text-[#B8FA2E] dark:hover:text-[#B8FA2E] py-2">Servicios</a>
            <a href="#portafolio" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-800 dark:text-gray-200 font-medium hover:text-[#B8FA2E] dark:hover:text-[#B8FA2E] py-2">Portafolio</a>
            <a href="#proceso" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-800 dark:text-gray-200 font-medium hover:text-[#B8FA2E] dark:hover:text-[#B8FA2E] py-2">Metodología</a>
            <a href="#suscripciones" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-800 dark:text-gray-200 font-medium hover:text-[#B8FA2E] dark:hover:text-[#B8FA2E] py-2">Planes</a>
            <a href="#contacto" onClick={() => setIsMobileMenuOpen(false)} className="mt-2 text-center w-full px-6 py-3 rounded-lg bg-[#B8FA2E] text-[#0A0A0A] font-bold">Contactar</a>
          </div>
        )}
      </nav>

      <section id="inicio" className="relative min-h-screen flex items-center justify-center pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgNTBMNTAgMCIgc3Ryb2tlPSJyZ2JhKDE1MCwgMTUwLCAxNTAsIDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')] opacity-20 dark:opacity-10 pointer-events-none"></div>
        <div className="absolute w-[400px] h-[400px] bg-[#B8FA2E]/15 rounded-full blur-[100px] top-0 left-[-10%] mix-blend-screen animate-[float_12s_ease-in-out_infinite]"></div>
        <div className="absolute w-[600px] h-[600px] bg-green-600/10 rounded-full blur-[100px] bottom-[-20%] right-[-10%] mix-blend-screen animate-[float_12s_ease-in-out_infinite]" style={{ animationDelay: '-5s' }}></div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div 
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 dark:bg-white/5 backdrop-blur-md border border-[#B8FA2E]/50 dark:border-[#B8FA2E]/20 text-green-800 dark:text-[#B8FA2E] text-xs lg:text-sm font-semibold mb-8 shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B8FA2E] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#B8FA2E]"></span>
                </span>
                Revolucionando el Desarrollo Digital
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight text-gray-900 dark:text-white">
                Escale su Negocio al <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#B8FA2E] to-[#10B981]">Siguiente Nivel</span>
              </h1>
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-10 leading-relaxed max-w-xl font-light">
                Diseñamos y desarrollamos portales web, aplicaciones administrativas con <strong className="text-gray-800 dark:text-gray-200 font-semibold">Inteligencia Artificial</strong> y soluciones e-commerce para empresas que exigen excelencia, automatización y resultados reales.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
                <a href="#configurador" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#B8FA2E] text-[#0A0A0A] font-bold hover:bg-gray-100 dark:hover:bg-white transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(184,250,46,0.6)] flex items-center justify-center gap-2 group">
                  Cotizar mi Proyecto
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </a>
                <a href="#portafolio" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/70 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/5 text-gray-800 dark:text-white font-semibold hover:bg-gray-200 dark:hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2 group">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/5 flex items-center justify-center group-hover:bg-[#B8FA2E]/20 transition-colors">
                    <svg className="w-4 h-4 text-[#B8FA2E]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                  </div>
                  Ver Demos
                </a>
              </div>
            </div>

            <div 
              className="relative lg:h-[600px] flex items-center justify-center perspective-[1000px]"
            >
              <div className="relative z-20 w-full max-w-lg rounded-2xl bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden transform-style-3d transition-all duration-700 hover:rotate-0 hover:scale-105">
                <div className="bg-gray-100/80 dark:bg-[#111827]/80 px-4 py-3 border-b border-gray-200 dark:border-white/5 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  <div className="mx-auto text-[10px] text-gray-500 font-medium tracking-widest">APP ADMINISTRATIVA</div>
                </div>
                <div className="p-6 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-md">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center gap-2">
                        Análisis de Ventas
                        <span 
                          className="w-2 h-2 rounded-full bg-[#B8FA2E] shadow-[0_0_8px_#B8FA2E]"
                        />
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sincronizando en tiempo real...</p>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-green-50 dark:bg-[#B8FA2E]/10 border border-green-200 dark:border-[#B8FA2E]/20 text-green-800 dark:text-[#B8FA2E] text-xs font-bold flex items-center gap-2 relative overflow-hidden">
                      <div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#B8FA2E]/20 to-transparent animate-sweep"
                      />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#B8FA2E] animate-glow-pulse"></span>
                      IA Predictiva
                    </div>
                  </div>
                  <div className="h-32 w-full flex items-end gap-3 mb-8 relative">
                    {/* Animated Bars */}
                    {bars.map((bar, i) => (
                      <motion.div 
                        key={bar.id}
                        animate={{ 
                          height: `${bar.height}%`,
                          backgroundColor: bar.isHighlight ? '#B8FA2E' : '',
                        }}
                        transition={{ type: "spring", stiffness: 60, damping: 15 }}
                        className={`w-1/6 rounded-t-md relative ${bar.isHighlight ? 'shadow-[0_0_20px_rgba(184,250,46,0.3)]' : 'bg-gray-200 dark:bg-white/10'}`}
                      >
                        {bar.isHighlight && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-[#B8FA2E] dark:bg-white dark:text-[#0A0A0A] text-xs font-bold py-1 px-2 rounded whitespace-nowrap"
                          >
                            +{Math.round(bar.height)}%
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div 
                      className="h-12 w-full rounded-xl bg-gray-100 dark:bg-white/5 flex items-center px-4 gap-4 relative overflow-hidden"
                    >
                      <div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-sweep"
                        style={{ animationDelay: '0.5s' }}
                      />
                      <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-[#B8FA2E]/20 text-green-700 dark:text-[#B8FA2E] flex items-center justify-center text-xs">✓</div>
                      <div className="flex-1">
                        <div className="h-2 w-32 bg-gray-300 dark:bg-white/40 rounded-full mb-2"></div>
                        <div className="h-1.5 w-20 bg-gray-200 dark:bg-white/10 rounded-full"></div>
                      </div>
                    </div>
                    <div 
                      className="h-12 w-full rounded-xl bg-gray-100 dark:bg-white/5 flex items-center px-4 gap-4 relative overflow-hidden"
                    >
                      <div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-sweep"
                        style={{ animationDelay: '1.5s' }}
                      />
                      <div className="w-6 h-6 rounded-full border border-gray-300 dark:border-white/20 flex items-center justify-center">
                        <div 
                          className="w-2 h-2 bg-[#B8FA2E] rounded-full"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="h-2 w-40 bg-gray-300 dark:bg-white/20 rounded-full mb-2"></div>
                        <div className="h-1.5 w-24 bg-gray-200 dark:bg-white/10 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div 
                className="absolute z-30 -right-6 top-16 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-gray-200 dark:border-white/10 animate-float-slow"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src="https://i.pravatar.cc/150?img=68" alt="Robot Amable IA" className="w-12 h-12 rounded-full object-cover shadow-[0_0_15px_rgba(184,250,46,0.4)] border-2 border-[#B8FA2E] bg-white" />
                    <div 
                      className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#B8FA2E] rounded-full border-2 border-white dark:border-[#111827] animate-glow-pulse"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Asistente Activo</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">"He agendado 3 citas hoy"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-[#0A0A0A] border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-12 items-center mb-16">
            <div className="lg:w-1/2">
              <h2 className="font-display text-4xl lg:text-5xl font-bold text-white leading-tight">
                Más que código,<br />
                construimos el <span className="text-[#B8FA2E]">futuro de su<br />negocio</span>.
              </h2>
            </div>
            <div className="lg:w-1/2">
              <p className="text-lg text-gray-400 leading-relaxed border-l-2 border-white/10 pl-6">
                Nacimos con una premisa simple: la tecnología de élite y la Inteligencia Artificial no deberían ser un privilegio exclusivo de las megacorporaciones.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-[#111827] border border-white/5 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
              <AnimatedCounter 
                to={98} 
                suffix={<span className="text-[#B8FA2E] drop-shadow-[0_0_12px_rgba(184,250,46,0.6)]">%</span>} 
              />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Clientes Felices</p>
            </div>
            <div className="bg-[#111827] border border-white/5 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
              <AnimatedCounter prefix="+" to={250} />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Proyectos Web</p>
            </div>
            <div className="bg-[#111827] border border-white/5 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
              <AnimatedCounter prefix="+" to={10} />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Años de Experiencia</p>
            </div>
            <div className="bg-[#111827] border border-white/5 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
              <AnimatedCounter prefix="+" to={15} />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Tecnologías Dominadas</p>
            </div>
          </div>
        </div>
      </section>

      {/* Servicios */}
      <section id="servicios" className="py-24 bg-white dark:bg-[#0A0A0A] border-t border-gray-200 dark:border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">Soluciones que <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#B8FA2E] to-[#10B981]">escalan su negocio</span></h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">Desarrollamos tecnología a medida para optimizar sus procesos y aumentar sus ventas.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Service 1 */}
            <div className="p-8 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-[#B8FA2E]/50 transition-colors group">
              <div className="w-14 h-14 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-[#B8FA2E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Desarrollo Web Premium</h3>
              <p className="text-gray-600 dark:text-gray-400">Sitios web ultrarrápidos, optimizados para SEO y diseñados para convertir visitantes en clientes.</p>
            </div>
            {/* Service 2 */}
            <div className="p-8 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-[#B8FA2E]/50 transition-colors group">
              <div className="w-14 h-14 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-[#B8FA2E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Apps Administrativas</h3>
              <p className="text-gray-600 dark:text-gray-400">Sistemas a medida para gestionar su inventario, personal, clientes y finanzas en un solo lugar.</p>
            </div>
            {/* Service 3 */}
            <div className="p-8 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-[#B8FA2E]/50 transition-colors group">
              <div className="w-14 h-14 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-[#B8FA2E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Integración de IA</h3>
              <p className="text-gray-600 dark:text-gray-400">Automatice la atención al cliente y el análisis de datos con agentes de Inteligencia Artificial.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Demos */}
      <section id="portafolio" className="py-24 bg-white dark:bg-[#0A0A0A] border-t border-gray-200 dark:border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Experimente nuestro <span className="text-[#B8FA2E]">Nivel de Excelencia</span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400">Interactúe con nuestras demos en vivo ahora mismo.</p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            {['web', 'admin', 'ia'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveDemoTab(tab)}
                className={`px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 ${
                  activeDemoTab === tab
                    ? 'bg-[#B8FA2E] text-[#0A0A0A] shadow-[0_0_20px_rgba(184,250,46,0.4)]'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 border border-transparent dark:border-white/10'
                }`}
              >
                {tab === 'web' ? 'Proyectos Web' : tab === 'admin' ? 'Apps Administrativas' : 'Soluciones IA (Demo)'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="max-w-5xl mx-auto">
            {activeDemoTab === 'web' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid md:grid-cols-3 gap-6"
              >
                {[
                  {
                    img: 'https://s0.wp.com/mshots/v1/https://mi-solucion-digital.netlify.app/?w=1920&h=1080',
                    url: 'https://mi-solucion-digital.netlify.app/',
                    title: 'Mi Solución Digital'
                  },
                  {
                    img: 'https://picsum.photos/seed/web2/600/400',
                    url: '#',
                    title: 'E-Commerce Global'
                  },
                  {
                    img: 'https://picsum.photos/seed/web3/600/400',
                    url: '#',
                    title: 'Dashboard Financiero'
                  }
                ].map((project, i) => (
                  <div key={i} className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111827] shadow-sm hover:shadow-xl transition-shadow duration-500">
                    {/* Browser Chrome */}
                    <div className="h-8 bg-gray-200 dark:bg-[#1F2937] flex items-center px-3 gap-1.5 z-10 relative border-b border-gray-300 dark:border-white/5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]"></div>
                    </div>
                    <div className="relative overflow-hidden bg-white dark:bg-[#0A0A0A]">
                      <img src={project.img} alt={project.title} className="w-full aspect-video object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center">
                        <a href={project.url} target="_blank" rel="noopener noreferrer" className="px-6 py-2.5 bg-[#B8FA2E] text-[#0A0A0A] font-bold rounded-lg transform translate-y-8 group-hover:translate-y-0 transition-all duration-500 ease-out hover:bg-white hover:scale-105 shadow-lg">
                          Ver Ejemplo
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeDemoTab === 'admin' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111827] overflow-hidden flex flex-col md:flex-row min-h-[400px]"
              >
                {/* Sidebar */}
                <div className="w-full md:w-64 bg-gray-50 dark:bg-[#0A0A0A] border-r border-gray-200 dark:border-white/10 p-6 flex flex-col gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#B8FA2E]"></div>
                    <span className="font-bold text-gray-900 dark:text-white">ERP System</span>
                  </div>
                  <div className="space-y-2">
                    <div className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white text-sm font-medium flex items-center gap-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                      Dashboard
                    </div>
                    <div className="px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-medium flex items-center gap-3 cursor-pointer transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      Facturación
                    </div>
                  </div>
                </div>
                {/* Main Content */}
                <div className="flex-1 p-4 sm:p-8 overflow-hidden">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6 sm:mb-8">Resumen Financiero</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
                    <div className="p-4 sm:p-6 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                      <p className="text-xs sm:text-sm text-gray-500 mb-2">Ingresos (Mes)</p>
                      <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">45.230,00 €</p>
                    </div>
                    <div className="p-4 sm:p-6 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                      <p className="text-xs sm:text-sm text-gray-500 mb-2">Facturas Pendientes</p>
                      <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">14</p>
                    </div>
                  </div>
                  {/* Table */}
                  <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                    <table className="w-full text-left text-sm min-w-[500px]">
                      <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 text-xs uppercase font-semibold">
                        <tr>
                          <th className="px-6 py-4">Cliente</th>
                          <th className="px-6 py-4">Fecha</th>
                          <th className="px-6 py-4">Estado</th>
                          <th className="px-6 py-4 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                        <tr className="bg-white dark:bg-transparent">
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">TechCorp Inc.</td>
                          <td className="px-6 py-4 text-gray-500">12 Oct 2023</td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-md bg-green-100 dark:bg-[#B8FA2E]/20 text-green-800 dark:text-[#B8FA2E] text-xs font-bold">Pagado</span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">1.250,00 €</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeDemoTab === 'ia' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid md:grid-cols-2 gap-8"
              >
                {/* Upload Area */}
                <div className="border border-gray-200 dark:border-[#B8FA2E]/30 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-gray-50 dark:bg-[#111827] min-h-[400px] relative overflow-hidden">
                  {ocrImage ? (
                    <>
                      <img 
                        src={ocrImage} 
                        alt="Uploaded Invoice" 
                        className={`absolute inset-0 w-full h-full object-contain transition-all duration-500 ${ocrLoading ? 'opacity-80' : 'opacity-30 blur-sm'}`} 
                      />
                      {ocrLoading && (
                        <motion.div
                          className="absolute left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#B8FA2E]/40 border-b-2 border-[#B8FA2E] shadow-[0_8px_20px_rgba(184,250,46,0.6)] z-0 pointer-events-none"
                          initial={{ top: "-40%" }}
                          animate={{ top: "100%" }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear"
                          }}
                        />
                      )}
                    </>
                  ) : null}
                  <div className="relative z-10 flex flex-col items-center">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Escáner OCR con IA</h3>
                    <p className="text-gray-500 mb-8">Arrastre una factura o ticket aquí para extraer los datos.</p>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={ocrLoading}
                      className="px-6 py-3 rounded-lg bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {ocrLoading ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-gray-900 dark:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Procesando...
                        </>
                      ) : (
                        'Seleccionar Archivo'
                      )}
                    </button>
                  </div>
                </div>
                {/* Results Area */}
                <div className="border border-gray-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111827] overflow-hidden flex flex-col relative">
                  {ocrLoading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-[#111827]/50 backdrop-blur-sm z-20 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-[#B8FA2E] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Analizando documento...</span>
                      </div>
                    </div>
                  )}
                  <div className="p-6 border-b border-gray-200 dark:border-white/10">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold">
                      <span className={`w-2 h-2 rounded-full ${ocrData ? 'bg-[#B8FA2E]' : 'bg-gray-400'}`}></span>
                      Datos Extraídos
                    </div>
                  </div>
                  <div className="p-6 space-y-6 flex-1">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">Proveedor</label>
                      <div className="w-full bg-gray-100 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-gray-900 dark:text-white font-mono text-sm min-h-[46px]">
                        {ocrData ? ocrData.provider : (ocrImage ? '...' : 'Amazon Web Services')}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#B8FA2E] mb-2">Total a Pagar</label>
                      <div className="w-1/2 bg-green-50 dark:bg-[#B8FA2E]/10 border border-green-200 dark:border-[#B8FA2E]/30 rounded-lg px-4 py-3 text-green-800 dark:text-[#B8FA2E] font-mono text-sm font-bold min-h-[46px]">
                        {ocrData ? ocrData.total : (ocrImage ? '...' : '285,60 €')}
                      </div>
                    </div>
                  </div>
                  <div className={`h-1 w-full bg-gradient-to-r from-transparent via-[#B8FA2E] to-transparent ${ocrLoading ? 'animate-pulse opacity-100' : 'opacity-50'}`}></div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Metodología */}
      <section id="proceso" className="py-24 bg-gray-50 dark:bg-[#111827] border-t border-gray-200 dark:border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="font-display text-4xl font-bold text-gray-900 dark:text-white mb-4">Nuestra <span className="text-[#B8FA2E]">Metodología</span></h2>
            <p className="text-gray-600 dark:text-gray-400">Un proceso ágil y transparente diseñado para garantizar el éxito de su proyecto.</p>
          </div>
          
          <div className="max-w-4xl mx-auto relative" ref={timelineRef}>
            {/* Vertical Line Background */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-1 bg-gray-200 dark:bg-white/10 md:-translate-x-1/2 rounded-full"></div>
            
            {/* Animated Progress Line */}
            <motion.div 
              className="absolute left-8 md:left-1/2 top-0 w-1 bg-[#B8FA2E] md:-translate-x-1/2 rounded-full shadow-[0_0_15px_#B8FA2E] z-10 origin-top"
              style={{ height: lineHeight }}
            />

            <div className="space-y-12">
              {[
                { step: '1', title: 'Análisis y Estrategia', desc: 'Definimos arquitectura y cronograma.' },
                { step: '2', title: 'Desarrollo e IA', desc: 'Codificamos utilizando las mejores prácticas.' },
                { step: '3', title: 'Lanzamiento', desc: 'Pruebas rigurosas y despliegue a producción.' }
              ].map((item, index) => (
                <div key={index} className={`relative flex flex-col md:flex-row items-start md:items-center justify-between w-full ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                  {/* Empty space for the other side (desktop) */}
                  <div className="hidden md:block w-5/12"></div>
                  
                  {/* Center Dot */}
                  <div className="absolute left-8 md:left-1/2 top-6 md:top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white dark:bg-[#111827] border-2 border-[#B8FA2E] z-20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#B8FA2E]"></div>
                  </div>

                  {/* Content Card */}
                  <div className="w-full md:w-5/12 pl-20 md:pl-0">
                    <div className="bg-white dark:bg-[#0A0A0A] p-6 rounded-2xl border border-gray-100 dark:border-white/5 shadow-lg hover:border-[#B8FA2E]/50 transition-colors">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{item.step}. {item.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Configurador / Precios */}
      <section id="configurador" className="py-24 bg-gray-100 dark:bg-[#111827]">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-4xl font-bold text-gray-900 dark:text-white mb-4">Cotice su Proyecto</h2>
            <p className="text-gray-600 dark:text-gray-400">Seleccione las características que necesita y obtenga un estimado al instante para la compra de su proyecto.</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="lg:col-span-2 space-y-8">
              {/* Tipo de Proyecto */}
              <div className="bg-white dark:bg-[#0A0A0A] p-8 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">1. Tipo de Proyecto</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { id: 'landing', name: 'Landing Page', price: '800 €' },
                    { id: 'ecommerce', name: 'E-Commerce', price: '2.500 €' },
                    { id: 'admin_app', name: 'App Administrativa', price: '4.000 €' },
                    { id: 'ia_integration', name: 'Plataforma con IA', price: '5.500 €' }
                  ].map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => setSelectedProject(proj.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${selectedProject === proj.id ? 'border-[#B8FA2E] bg-[#B8FA2E]/10' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'}`}
                    >
                      <div className="font-bold text-gray-900 dark:text-white">{proj.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Desde {proj.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Características Adicionales */}
              <div className="bg-white dark:bg-[#0A0A0A] p-8 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">2. Características Adicionales</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { id: 'seo', name: 'SEO Avanzado', price: '+450 €' },
                    { id: 'login', name: 'Sistema de Usuarios', price: '+600 €' },
                    { id: 'payments', name: 'Pasarela de Pagos', price: '+800 €' },
                    { id: 'chatbot', name: 'Chatbot IA', price: '+1.200 €' }
                  ].map((feat) => (
                    <button
                      key={feat.id}
                      onClick={() => toggleFeature(feat.id)}
                      className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${features[feat.id] ? 'border-[#B8FA2E] bg-[#B8FA2E]/10' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'}`}
                    >
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{feat.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{feat.price}</div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${features[feat.id] ? 'border-[#B8FA2E] bg-[#B8FA2E] text-[#0A0A0A]' : 'border-gray-300 dark:border-gray-600'}`}>
                        {features[feat.id] && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-white dark:bg-[#0A0A0A] p-8 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm h-fit sticky top-24">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Resumen Estimado</h3>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Proyecto Base</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedProject === 'landing' ? '800' : selectedProject === 'ecommerce' ? '2.500' : selectedProject === 'admin_app' ? '4.000' : '5.500'} €
                  </span>
                </div>
                {Object.entries(features).filter(([_, isSelected]) => isSelected).map(([id]) => (
                  <div key={id} className="flex justify-between text-gray-600 dark:text-gray-400 text-sm">
                    <span>+ {id === 'seo' ? 'SEO' : id === 'login' ? 'Usuarios' : id === 'payments' ? 'Pagos' : 'Chatbot'}</span>
                    <span>{id === 'seo' ? '450' : id === 'login' ? '600' : id === 'payments' ? '800' : '1.200'} €</span>
                  </div>
                ))}
                <div className="pt-4 border-t border-gray-200 dark:border-white/10 flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-white">Total Estimado</span>
                  <span className="text-3xl font-display font-bold text-[#B8FA2E]">{totalPrice.toLocaleString('es-ES')} €</span>
                </div>
              </div>
              <button className="w-full py-4 rounded-xl bg-[#B8FA2E] text-[#0A0A0A] font-bold hover:bg-white transition-colors">
                Solicitar Propuesta Exacta
              </button>
              <p className="text-xs text-center text-gray-500 mt-4">
                * Este es un estimado inicial. El precio final puede variar según los requerimientos específicos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Planes de Suscripción */}
      <section id="suscripciones" className="py-24 bg-gray-50 dark:bg-[#111827] border-t border-gray-200 dark:border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-4xl font-bold text-gray-900 dark:text-white mb-4">Planes de <span className="text-[#B8FA2E]">Suscripción</span></h2>
            <p className="text-gray-600 dark:text-gray-400 mb-10">Pague una mensualidad por el uso y mantenimiento de su aplicación, sin inversión inicial.</p>

            <div className="inline-flex flex-col sm:flex-row items-center p-1.5 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-full shadow-sm gap-1 sm:gap-0 w-full sm:w-auto">
              <button
                onClick={() => setSubscriptionType('web')}
                className={`w-full sm:w-auto px-8 py-3 rounded-xl sm:rounded-full font-bold text-sm transition-all duration-300 ${
                  subscriptionType === 'web' 
                    ? 'bg-[#B8FA2E] text-[#0A0A0A] shadow-[0_0_20px_rgba(184,250,46,0.3)]' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Desarrollo Web
              </button>
              <button
                onClick={() => setSubscriptionType('app')}
                className={`w-full sm:w-auto px-8 py-3 rounded-xl sm:rounded-full font-bold text-sm transition-all duration-300 ${
                  subscriptionType === 'app' 
                    ? 'bg-[#B8FA2E] text-[#0A0A0A] shadow-[0_0_20px_rgba(184,250,46,0.3)]' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Suscripción Apps
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white dark:bg-[#0A0A0A] p-8 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Starter</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">{subscriptionType === 'web' ? '99' : '199'} €</span>
                <span className="text-gray-500 text-sm">/mes</span>
              </div>
              <button className="w-full py-3 rounded-lg border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors mt-auto">
                Empezar
              </button>
            </div>
            <div className="bg-gray-900 dark:bg-[#0A0A0A] p-8 rounded-2xl border-2 border-[#B8FA2E] flex flex-col relative transform md:-translate-y-4 shadow-2xl">
              <h3 className="text-xl font-bold text-[#B8FA2E] mb-4">Business</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold text-white">{subscriptionType === 'web' ? '249' : '499'} €</span>
                <span className="text-gray-400 text-sm">/mes</span>
              </div>
              <button className="w-full py-3 rounded-lg bg-[#B8FA2E] text-[#0A0A0A] font-bold hover:bg-[#a3e622] transition-colors mt-auto">
                Empezar
              </button>
            </div>
            <div className="bg-white dark:bg-[#0A0A0A] p-8 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Enterprise</h3>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-8 mt-2">A Medida</div>
              <button className="w-full py-3 rounded-lg border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors mt-auto">
                Contactar
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="py-24 bg-white dark:bg-[#0A0A0A]">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto bg-white dark:bg-[#111827] rounded-3xl shadow-xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col md:flex-row">
            
            {/* Left Side: Info */}
            <div className="w-full md:w-5/12 bg-gray-50 dark:bg-white/5 p-8 md:p-12 flex flex-col justify-center">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Iniciemos su <span className="text-green-600 dark:text-[#B8FA2E]">proyecto</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8 md:mb-12">
                Cuéntenos qué necesita y prepararemos una propuesta en 24 horas.
              </p>
              
              <div className="flex items-center gap-3 text-gray-900 dark:text-white font-bold">
                <span className="text-xl">✉️</span>
                <a href="mailto:hello@devstudiopro.com" className="hover:text-green-600 dark:hover:text-[#B8FA2E] transition-colors break-all">
                  hello@devstudiopro.com
                </a>
              </div>
            </div>

            {/* Right Side: Form */}
            <div className="w-full md:w-7/12 p-8 md:p-12 bg-white dark:bg-[#0A0A0A]">
              {submitSuccess ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
                  <div className="w-16 h-16 bg-[#B8FA2E]/20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#B8FA2E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">¡Solicitud Enviada!</h3>
                  <p className="text-gray-600 dark:text-gray-400">Nos pondremos en contacto contigo en menos de 24 horas.</p>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleContactSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <input 
                        type="text" 
                        placeholder="Nombre completo" 
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        className={`w-full bg-transparent border ${contactErrors.name ? 'border-red-500' : 'border-gray-300 dark:border-white/20'} rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-green-600 dark:focus:border-[#B8FA2E] transition-colors`}
                      />
                      {contactErrors.name && <p className="text-red-500 text-xs mt-1">{contactErrors.name}</p>}
                    </div>
                    <div>
                      <input 
                        type="email" 
                        placeholder="Email corporativo" 
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className={`w-full bg-transparent border ${contactErrors.email ? 'border-red-500' : 'border-gray-300 dark:border-white/20'} rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-green-600 dark:focus:border-[#B8FA2E] transition-colors`}
                      />
                      {contactErrors.email && <p className="text-red-500 text-xs mt-1">{contactErrors.email}</p>}
                    </div>
                  </div>
                  
                  <div>
                    <textarea 
                      placeholder="Detalles del proyecto..." 
                      rows={4}
                      value={contactForm.details}
                      onChange={(e) => setContactForm({ ...contactForm, details: e.target.value })}
                      className={`w-full bg-transparent border ${contactErrors.details ? 'border-red-500' : 'border-gray-300 dark:border-white/20'} rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-green-600 dark:focus:border-[#B8FA2E] transition-colors resize-none`}
                    ></textarea>
                    {contactErrors.details && <p className="text-red-500 text-xs mt-1">{contactErrors.details}</p>}
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-xl bg-[#B8FA2E] text-[#0A0A0A] font-bold text-lg hover:bg-[#a3e622] transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-[#0A0A0A]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Enviando...
                      </>
                    ) : (
                      'Enviar Solicitud'
                    )}
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-[#0A0A0A] py-12 border-t border-gray-200 dark:border-white/10">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#B8FA2E] rounded-lg flex items-center justify-center font-display font-bold text-[#0A0A0A]">
              D
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-gray-900 dark:text-white">
              DevStudio <span className="text-[#B8FA2E]">Pro</span>
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            © {new Date().getFullYear()} DevStudio Pro. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      <Chatbot />
    </div>
  );
}

