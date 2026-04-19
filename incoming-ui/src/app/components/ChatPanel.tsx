import { Send, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'planning' | 'running' | 'complete';
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
}

export function ChatPanel({ messages, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const suggestionChips = [
    "Build a prospect list",
    "Scout candidates",
    "Monitor companies",
    "Research an account"
  ];

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm text-muted-foreground">Conversation</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-start gap-3 pt-8">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">Try asking...</span>
            </div>
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => onSendMessage(chip)}
                className="px-3 py-2 text-sm bg-secondary hover:bg-accent rounded-lg transition-colors text-left w-full text-secondary-foreground"
              >
                {chip}
              </button>
            ))}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col gap-2 ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
              {message.status && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {message.status === 'planning' && (
                    <>
                      <div className="w-1 h-1 rounded-full bg-chart-2 animate-pulse" />
                      <span>Planning workflow...</span>
                    </>
                  )}
                  {message.status === 'running' && (
                    <>
                      <div className="w-1 h-1 rounded-full bg-chart-4 animate-pulse" />
                      <span>Running...</span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want to build..."
            className="flex-1 px-3 py-2 bg-input-background rounded-lg border border-transparent focus:border-ring focus:outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}