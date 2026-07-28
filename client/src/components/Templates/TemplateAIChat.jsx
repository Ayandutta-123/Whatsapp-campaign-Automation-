import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ai } from '../../lib/api';

const SUGGESTIONS = [
  'Draft a marketing offer template with {{1}} name and a Shop Now URL button',
  'Write a utility order-shipped template in English',
  'Create a Hindi greeting template for new customers',
];

export default function TemplateAIChat({ onUseTemplate }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hi — I can help you draft WhatsApp templates with Claude. Describe your campaign and I’ll propose Meta-ready copy.',
    },
  ]);
  const [lastTemplate, setLastTemplate] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, loading]);

  const send = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setLastTemplate(null);

    try {
      const history = nextMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map(({ role, content: c }) => ({ role, content: c }));

      const res = await ai.chat(history);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
      if (res.data.template) setLastTemplate(res.data.template);
    } catch (err) {
      const msg = err.response?.data?.error || 'Claude request failed';
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I couldn’t complete that request: ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ht-btn ht-btn-primary fixed bottom-5 right-5 z-40 rounded-full px-4 py-3 shadow-glow flex items-center gap-2"
        aria-label="Open AI template assistant"
      >
        <Sparkles size={18} />
        <span className="hidden sm:inline font-semibold">AI Templates</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:w-[420px] h-[85vh] sm:h-[640px] max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-4 py-3 bg-sidebar text-white">
              <div className="flex items-center gap-2 min-w-0">
                <Bot size={18} className="text-accent shrink-0" />
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm truncate">Claude Template Assistant</p>
                  <p className="text-[11px] text-white/60 truncate">Powered by Anthropic</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'ml-auto bg-accent text-white rounded-br-md'
                      : 'mr-auto bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {loading && (
                <div className="mr-auto flex items-center gap-2 text-sm text-slate-500 bg-white border rounded-2xl px-3 py-2">
                  <Loader2 size={14} className="animate-spin" /> Claude is drafting…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {lastTemplate && (
              <div className="px-4 py-2 border-t bg-orange-50 flex items-center justify-between gap-2">
                <p className="text-xs text-orange-900 truncate">
                  Ready: <strong>{lastTemplate.name}</strong>
                </p>
                <button
                  type="button"
                  className="ht-btn ht-btn-primary text-xs px-3 py-1.5 rounded-lg shrink-0"
                  onClick={() => {
                    onUseTemplate?.(lastTemplate);
                    setOpen(false);
                    toast.success('Template loaded into the editor');
                  }}
                >
                  Use template
                </button>
              </div>
            )}

            {messages.length <= 2 && (
              <div className="px-3 pt-2 flex flex-wrap gap-2 border-t bg-white">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="text-[11px] px-2.5 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-accent hover:text-accent transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              className="p-3 border-t bg-white flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe the template you need…"
                className="ht-input flex-1 px-3 py-2.5 border rounded-xl text-sm outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="ht-btn ht-btn-primary rounded-xl px-3 disabled:opacity-50"
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
