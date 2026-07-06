"use client";

import { useState, useEffect, useRef } from 'react';
import {
  X, Eye, ThumbsUp, Sparkles, Download, ChevronDown, Search,
  Filter, Plus, Send, MessageSquare, Lightbulb, Bug, Star, Layout,
  Loader2, FileText,
} from 'lucide-react';
import {
  setupTeamRetro, submitRetroCard, voteRetroCard,
  updateRetroCardStatus, getRetroData, summarizeRetro,
  type RetroCard, type RetroSessionData,
} from '@/services/adk-assistant.service';
import type { TeamRetroConfig } from './TeamRetroSetup.component';

interface TeamRetroModeProps {
  config: TeamRetroConfig;
  onEnd: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Layout, color: '' },
  { id: 'improvement', label: 'Improvement', icon: Lightbulb, color: 'text-green-500 bg-green-50' },
  { id: 'bug', label: 'Bug', icon: Bug, color: 'text-red-500 bg-red-50' },
  { id: 'feature', label: 'Feature', icon: Star, color: 'text-amber-500 bg-amber-50' },
  { id: 'process', label: 'Process', icon: Layout, color: 'text-blue-500 bg-blue-50' },
  { id: 'other', label: 'Other', icon: MessageSquare, color: 'text-gray-500 bg-gray-50' },
] as const;

const STATUS_OPTIONS = [
  { id: 'new', label: '🆕 New' },
  { id: 'under-review', label: '🔍 Review' },
  { id: 'approved', label: '✅ Approved' },
  { id: 'in-progress', label: '🚧 In Progress' },
  { id: 'done', label: '✅ Done' },
  { id: 'declined', label: '❌ Declined' },
] as const;

export default function TeamRetroMode({ config, onEnd }: TeamRetroModeProps) {
  const [cards, setCards] = useState<RetroCard[]>([]);
  const [filterCat, setFilterCat] = useState('all');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');

  // Submit form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('improvement');
  const [author, setAuthor] = useState(config.participants[0] || 'Anonymous');

  // Summary
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<{markdown: string} | null>(null);

  // Current user for voting
  const [currentUser, setCurrentUser] = useState(config.participants[0] || 'Anonymous');

  // Initialize session
  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    setInitializing(true);
    try {
      await setupTeamRetro({
        sessionId: config.sessionId,
        name: config.name,
        participants: config.participants,
        votesPerPerson: config.votesPerPerson,
      });
      await refreshData();
    } catch (err) {
      console.error('Retro init failed:', err);
      setError('Failed to initialize retro session');
    }
    setInitializing(false);
  };

  const refreshData = async () => {
    try {
      const data = await getRetroData(config.sessionId);
      setCards(data.cards);
    } catch (err) {
      console.error('Failed to load retro data:', err);
    }
  };

  // Submit a card
  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const result = await submitRetroCard({
        sessionId: config.sessionId,
        title: title.trim(),
        description: description.trim(),
        category,
        author: currentUser,
      });
      if (result.status === 'ok') {
        setCards(prev => [result.card, ...prev]);
        setTitle('');
        setDescription('');
        setShowForm(false);
      }
    } catch (err) {
      console.error('Submit failed:', err);
    }
    setLoading(false);
  };

  // Toggle vote
  const handleVote = async (cardId: number) => {
    try {
      const result = await voteRetroCard({
        sessionId: config.sessionId,
        cardId,
        voter: currentUser,
      });
      if (result.status === 'ok' && result.cards) {
        setCards(result.cards);
      } else if (result.error) {
        setError(result.error);
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  // Update status
  const handleStatusChange = async (cardId: number, status: string) => {
    try {
      await updateRetroCardStatus({ sessionId: config.sessionId, cardId, status });
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, status } : c));
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  // Generate summary
  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      const result = await summarizeRetro({ sessionId: config.sessionId, language: config.language });
      setSummary(result);
    } catch (err) {
      console.error('Summarize failed:', err);
    }
    setSummarizing(false);
  };

  // Download summary
  const handleDownload = () => {
    if (!summary) return;
    const blob = new Blob([summary.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retro-${config.name.replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // User's remaining votes
  const myVotes = cards.filter(c => c.voters.includes(currentUser)).length;
  const votesRemaining = config.votesPerPerson - myVotes;

  // Filter cards
  const filteredCards = cards.filter(c => filterCat === 'all' || c.category === filterCat);

  // Status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const s = STATUS_OPTIONS.find(o => o.id === status);
    return (
      <span className="text-xs font-medium text-gray-500">{s?.label || status}</span>
    );
  };

  // Category icon/color
  const getCatInfo = (catId: string) => {
    return CATEGORIES.find(c => c.id === catId) || CATEGORIES[5];
  };

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <Eye className="w-5 h-5 text-violet-500" />
          <h2 className="text-base font-semibold text-gray-900">{config.name}</h2>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500">{cards.length} items</span>
          <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium">
            👍 {votesRemaining}/{config.votesPerPerson} votes left
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentUser(
              config.participants[(config.participants.indexOf(currentUser) + 1) % config.participants.length] || currentUser
            )}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
          >
            {currentUser}
          </button>
          <button
            onClick={onEnd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            End
          </button>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Category filter tabs */}
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-2">
            {CATEGORIES.map(cat => {
              const isActive = filterCat === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setFilterCat(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-violet-500 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Summary section */}
          {summary && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  AI Summary
                </h3>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .md
                </button>
              </div>
              <div className="prose prose-sm max-w-none text-gray-700">
                {summary.markdown.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h3 key={i} className="text-base font-semibold text-gray-800 mt-3 mb-1">{line.slice(3)}</h3>;
                  if (line.startsWith('# ')) return <h2 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2">{line.slice(2)}</h2>;
                  if (line.startsWith('- ')) return <li key={i} className="text-sm ml-4 text-gray-600">{line.slice(2)}</li>;
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i} className="text-sm text-gray-600 mb-1">{line}</p>;
                })}
              </div>
            </div>
          )}

          {/* New card form (collapsible) */}
          {showForm ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">New Item</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 mb-3">
                <div className="flex gap-2">
                  {['improvement', 'bug', 'feature', 'process', 'other'].map(c => {
                    const ci = getCatInfo(c);
                    const isSelected = category === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? `${ci.color} border border-current`
                            : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {ci.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional details..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!title.trim() || loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:bg-gray-100 disabled:text-gray-400 transition-all"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Submit
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all mb-4 w-full"
            >
              <Plus className="w-4 h-4" />
              Add your retro item
            </button>
          )}

          {/* Card list */}
          {filteredCards.length === 0 ? (
            <div className="text-center py-16">
              <Eye className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No items yet</p>
              <p className="text-xs text-gray-400 mt-1">Click above to add the first retro item</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCards.map(card => {
                const ci = getCatInfo(card.category);
                const voted = card.voters.includes(currentUser);
                return (
                  <div
                    key={card.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      {/* Vote button */}
                      <button
                        onClick={() => handleVote(card.id)}
                        className={`flex flex-col items-center gap-0.5 w-10 py-1.5 rounded-lg transition-all ${
                          voted
                            ? 'bg-violet-100 text-violet-600'
                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        <ThumbsUp className={`w-4 h-4 ${voted ? 'fill-violet-500' : ''}`} />
                        <span className="text-xs font-bold">{card.votes}</span>
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-900">{card.title}</h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${ci.color}`}>
                              {ci.label}
                            </span>
                          </div>
                        </div>

                        {card.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.description}</p>
                        )}

                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-400">{card.author}</span>
                          {/* Status dropdown */}
                          <select
                            value={card.status}
                            onChange={e => handleStatusChange(card.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-0.5 text-gray-500 bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar — actions */}
        <div className="w-48 border-l border-gray-200 bg-white p-4 hidden sm:flex flex-col gap-2">
          <button
            onClick={handleSummarize}
            disabled={summarizing || cards.length === 0}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:bg-gray-100 disabled:text-gray-400 transition-all"
          >
            {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Summarize
          </button>
          {summary && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
            >
              <Download className="w-4 h-4" />
              Download .md
            </button>
          )}
          <div className="mt-auto pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Votes remaining</p>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-violet-600">{votesRemaining}</span>
              <span className="text-xs text-gray-400">/ {config.votesPerPerson}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
              <div
                className="bg-violet-500 h-full rounded-full transition-all"
                style={{ width: `${((config.votesPerPerson - votesRemaining) / config.votesPerPerson) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
