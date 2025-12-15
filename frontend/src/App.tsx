import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8100';

type Message = {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  conversation_id?: number;
};

type Conversation = {
  id: number;
  title: string | null;
  created_at: string;
  messages: Message[];
};

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false); 

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const loadConversation = async (conversationId: number) => {
    try {
      // Optimistic selection update
      setSelectedConversationId(conversationId);
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`);
      const data: Conversation = await response.json();
      setMessages(data.messages);
    } catch (error) {
      console.error("Error loading chat:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const content = input;
    setInput('');
    setIsLoading(true);

    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);

    try {
      if (selectedConversationId === null) {
        const convResponse = await fetch(`${API_BASE_URL}/conversations/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' }) 
        });
        const newConv: Conversation = await convResponse.json();
        
        setSelectedConversationId(newConv.id);
        setConversations((prev) => [newConv, ...prev]); 

        const msgResponse = await fetch(`${API_BASE_URL}/conversations/${newConv.id}/messages/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, role: 'user' })
        });
        const response = await msgResponse.json();
        setMessages((prev) => [...prev, response.assistant_message]);
        
      } else {
        const msgResponse = await fetch(`${API_BASE_URL}/conversations/${selectedConversationId}/messages/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, role: 'user' })
        });
        const response = await msgResponse.json();
        setMessages((prev) => [...prev, response.assistant_message]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, {role: 'assistant', content: "unble to find the server "}]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSelectedConversationId(null);
    setInput('');
  };

  return (
    <div className='flex h-screen bg-gray-100'>
      {/* Sidebar */}
      <div className='w-64 bg-gray-900 text-white p-4 flex flex-col'>
        <div className='mb-4'>
          <h1 className='text-xl font-bold'>DSTL Chat App</h1>
        </div>
        <button
          className='w-full py-2 px-4 border border-gray-600 rounded hover:bg-gray-800 text-left mb-4 transition-colors'
          onClick={handleNewChat}
        >
          + New Chat
        </button>
        <div className='flex-1 overflow-y-auto'>
          {conversations.length === 0 ? (
            <div className='text-sm text-gray-400'>No conversations yet</div>
          ) : (
            <div className='space-y-2'>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full text-left p-3 rounded transition-colors ${selectedConversationId === conv.id ? 'bg-gray-700' : 'hover:bg-gray-800'}`}
                >
                  <div className='text-sm font-medium truncate'>
                    {conv.title || `Conversation ${conv.id}`}
                  </div>
                  <div className='text-xs text-gray-400 mt-1'>
                    {new Date(conv.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>


      <div className='flex-1 flex flex-col'>
        
        <div className='flex-1 overflow-y-auto p-4 space-y-4'>
          {messages.length === 0 ? (
            <div className='text-center text-gray-500 mt-20'>
              <h2 className='text-2xl font-semibold'>
                Welcome to the DSTL Chat App
              </h2>
              <p>Start a conversation!</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                   <div className="bg-gray-200 text-gray-500 rounded-lg p-3 text-sm animate-pulse">
                      AI is thinking...
                   </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input Area */}
        <div className='p-4 border-t border-gray-200 bg-white'>
          <div className='flex gap-4 max-w-4xl mx-auto'>
            <textarea
              className='flex-1 border border-gray-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500'
              rows={1}
              placeholder='Type a message...'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              className='bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50'
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              Send
            </button>
          </div>
          <div className='text-center text-xs text-gray-400 mt-2'>
            Press Enter to send
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;