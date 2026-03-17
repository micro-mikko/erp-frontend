import { useState, useRef, useEffect, FormEvent } from 'react';
import { Bot, Send, User, Sparkles, Trash2, FileText, Users, Receipt, BookMarked, BarChart3, Package } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api/client';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  { icon: FileText,    text: 'Visa mina senaste fakturor' },
  { icon: Users,       text: 'Visa alla kunder' },
  { icon: Receipt,     text: 'Hur ser det ut ekonomiskt?' },
  { icon: BookMarked,  text: 'Bokför tillskott till eget kapital 1 000 €' },
  { icon: BarChart3,   text: 'Visa senaste verifikat' },
  { icon: Sparkles,    text: 'Skapa en faktura för Acme Oy' },
  { icon: Package,     text: 'Visa alla anläggningstillgångar' },
  { icon: Package,     text: 'Bör jag aktivera en utgift på 2000 € som tillgång?' },
];

function formatTime(d: Date) {
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
        isUser ? 'bg-brand-600' : 'bg-surface-300 border border-white/10'
      }`}>
        {isUser ? <User size={14} className="text-white" /> : <Bot size={14} className="text-brand-300" />}
      </div>

      <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'} max-w-[78%]`}>
        <div className={isUser ? 'chat-user' : 'chat-ai'}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer" className="underline text-brand-400 hover:text-brand-300" />
              ),
            }}
          >
            {msg.text}
          </ReactMarkdown>
        </div>
        <span className="text-[11px] text-white/25">{formatTime(msg.timestamp)}</span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-surface-300 border border-white/10">
        <Bot size={14} className="text-brand-300" />
      </div>
      <div className="chat-ai flex items-center gap-1.5 py-3.5">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      text: 'Hej! Jag är din AI-assistent för ERP-systemet. Jag kan hjälpa dig med fakturor, kunder, ekonomisk översikt och mycket mer. Vad kan jag hjälpa dig med idag?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: nextId.current++,
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      // Bygg historik från nuvarande meddelandelista (exkl. välkomstmeddelandet id=0)
      const history = messages
        .filter(m => m.id !== 0)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.text }));

      const data = await api.post<{ response: string }>('/ai/query', {
        message: text.trim(),
        history,
      });
      setMessages(prev => [
        ...prev,
        { id: nextId.current++, role: 'assistant', text: data.response, timestamp: new Date() },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Något gick fel';
      setError(msg);
      setMessages(prev => [
        ...prev,
        {
          id: nextId.current++,
          role: 'assistant',
          text: `Ursäkta, ett fel uppstod: ${msg}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: nextId.current++,
      role: 'assistant',
      text: 'Chatten är rensad. Hur kan jag hjälpa dig?',
      timestamp: new Date(),
    }]);
  };

  const hasSuggestions = messages.length <= 1;

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-surface-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/20 flex items-center justify-center">
            <Bot size={20} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">AI Assistent</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
              <span className="text-xs text-white/40">claude-sonnet-4-5 · Aktiv</span>
            </div>
          </div>
        </div>
        <button onClick={clearChat} className="btn-ghost text-xs gap-1.5" title="Rensa chat">
          <Trash2 size={13} />
          Rensa
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {hasSuggestions && !loading && (
        <div className="px-6 pb-4">
          <p className="text-xs text-white/30 mb-3 text-center">Förslag att börja med</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SUGGESTIONS.map(({ icon: Icon, text }) => (
              <button
                key={text}
                onClick={() => sendMessage(text)}
                className="flex items-center gap-2.5 p-3 bg-surface-100 hover:bg-surface-200 border border-white/5 hover:border-brand-500/20 rounded-xl text-sm text-white/60 hover:text-white transition-all text-left"
              >
                <Icon size={15} className="text-brand-400 flex-shrink-0" />
                <span className="text-xs">{text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-6 mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          ⚠ {error}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-6 pb-6 pt-2">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end bg-surface-100 border border-white/10 rounded-2xl p-3 focus-within:border-brand-500/40 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Skriv ett meddelande... (Enter för att skicka, Shift+Enter för ny rad)"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 resize-none focus:outline-none max-h-32 overflow-y-auto leading-relaxed"
            style={{ height: 'auto' }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-9 h-9 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all active:scale-90"
          >
            <Send size={15} className="text-white" />
          </button>
        </form>
        <p className="text-center text-[11px] text-white/20 mt-2">
          AI kan göra misstag. Verifiera viktig information.
        </p>
      </div>
    </div>
  );
}
