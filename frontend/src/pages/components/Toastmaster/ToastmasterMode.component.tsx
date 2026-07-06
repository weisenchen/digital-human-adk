"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Mic, Square, Trophy, RotateCcw, Clock, AlertTriangle,
  CheckCircle2, ChevronRight, Volume2, FileText, Send,
  Sparkles, Star,
} from 'lucide-react';
import { getToastmasterTopic, evaluateToastmasterSpeech } from '@/services/adk-assistant.service';
import type { ToastmasterConfig } from './ToastmasterSetup.component';

interface ToastmasterModeProps {
  config: ToastmasterConfig;
  onEnd: () => void;
}

/** Traffic light status */
type LightStatus = 'green' | 'yellow' | 'red' | 'off';

export default function ToastmasterMode({ config, onEnd }: ToastmasterModeProps) {
  const [step, setStep] = useState<'topic' | 'speaking' | 'evaluating' | 'result'>('topic');
  const [topic, setTopic] = useState('');
  const [topicId, setTopicId] = useState(0);
  const [usedTopics, setUsedTopics] = useState<number[]>([]);
  const [speechText, setSpeechText] = useState('');
  const [preparedSpeechText, setPreparedSpeechText] = useState('');
  const [currentRound, setCurrentRound] = useState(1);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lightStatus, setLightStatus] = useState<LightStatus>('off');

  // Evaluation results
  const [result, setResult] = useState<{
    scores: {content: number; organization: number; delivery: number; language: number; overall_impact: number};
    total_score: number;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    general_comment: string;
  } | null>(null);

  // History of all rounds
  const [roundHistory, setRoundHistory] = useState<Array<{
    round: number;
    topic: string;
    speechText: string;
    result: typeof result;
  }>>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load initial topic
  useEffect(() => {
    if (config.mode === 'table_topics') {
      loadNewTopic();
    }
  }, []);

  const loadNewTopic = async () => {
    setLoading(true);
    try {
      const data = await getToastmasterTopic({
        language: config.language,
        usedTopics: usedTopics.map(id => String(id)),
      });
      setTopic(data.topic);
      setTopicId(data.topic_id);
      setUsedTopics(prev => [...prev, data.topic_id]);
      setSpeechText('');
      setElapsed(0);
      setLightStatus('off');
      setStep('topic');
    } catch (err) {
      console.error('Failed to load topic:', err);
    }
    setLoading(false);
  };

  // Timer logic
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setLightStatus('green');
    setElapsed(0);

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const diff = Math.floor((now - startTimeRef.current) / 1000);
      setElapsed(diff);

      // Traffic light logic
      const total = config.timeSeconds;
      const yellowAt = total - 30; // Last 30 seconds = yellow
      const redAt = total; // Time's up = red

      if (diff >= redAt) {
        setLightStatus('red');
      } else if (diff >= yellowAt) {
        setLightStatus('yellow');
      }
    }, 200);
  }, [config.timeSeconds]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTimer();
  }, []);

  // Start speaking
  const handleStartSpeaking = () => {
    setStep('speaking');
    startTimer();
  };

  // Stop speaking and evaluate
  const handleStopSpeaking = async () => {
    stopTimer();
    setStep('evaluating');
    setLoading(true);

    try {
      const data = await evaluateToastmasterSpeech({
        mode: 'table_topics',
        topic,
        speechText,
        durationSeconds: elapsed,
        language: config.language,
        roundNumber: currentRound,
      });
      setResult(data);
      setRoundHistory(prev => [...prev, { round: currentRound, topic, speechText, result: data }]);
      setStep('result');
    } catch (err) {
      console.error('Evaluation failed:', err);
    }
    setLoading(false);
  };

  // Evaluate prepared speech
  const handleEvaluatePrepared = async () => {
    if (!preparedSpeechText.trim()) return;
    setStep('evaluating');
    setLoading(true);

    try {
      const data = await evaluateToastmasterSpeech({
        mode: 'prepared_speech',
        topic: 'Prepared Speech',
        speechText: preparedSpeechText,
        durationSeconds: 0,
        language: config.language,
        roundNumber: 1,
      });
      setResult(data);
      setRoundHistory(prev => [...prev, { round: 1, topic: 'Prepared Speech', speechText: preparedSpeechText, result: data }]);
      setStep('result');
    } catch (err) {
      console.error('Evaluation failed:', err);
    }
    setLoading(false);
  };

  // Next round (Table Topics)
  const handleNextRound = () => {
    if (currentRound >= config.rounds) {
      onEnd();
      return;
    }
    setCurrentRound(prev => prev + 1);
    loadNewTopic();
  };

  // Traffic light color
  const getLightColor = () => {
    switch (lightStatus) {
      case 'green': return 'bg-green-500 shadow-lg shadow-green-500/50';
      case 'yellow': return 'bg-yellow-500 shadow-lg shadow-yellow-500/50 animate-pulse';
      case 'red': return 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse';
      default: return 'bg-gray-300';
    }
  };

  // Score bar component
  const ScoreBar = ({ label, score, maxScore = 10, color = 'amber' }: { label: string; score: number; maxScore?: number; color?: string }) => {
    const pct = (score / maxScore) * 100;
    const barColor = color === 'amber' ? 'bg-amber-500' : color === 'green' ? 'bg-green-500' : color === 'blue' ? 'bg-blue-500' : 'bg-amber-500';
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-bold text-gray-900">{score}/{maxScore}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Render star rating
  const renderStars = (score: number) => {
    const stars = Math.round(score / 2); // 10 → 5 stars
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={`w-4 h-4 ${i <= stars ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-semibold text-gray-900">Toastmaster</h2>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500">
            {config.mode === 'table_topics' ? 'Table Topics' : 'Speech Evaluation'}
          </span>
          {config.mode === 'table_topics' && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Round {currentRound}/{config.rounds}
            </span>
          )}
        </div>
        <button
          onClick={onEnd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          End
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500 border-t-transparent mb-4" />
            <p className="text-sm font-medium text-gray-700">
              {step === 'evaluating' ? 'Evaluating your speech...' : 'Loading...'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {step === 'evaluating' ? 'AI is analyzing your performance' : 'Preparing your session'}
            </p>
          </div>
        )}

        {/* Table Topics: Topic Display */}
        {!loading && config.mode === 'table_topics' && step === 'topic' && (
          <div className="max-w-2xl mx-auto w-full">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mic className="w-7 h-7 text-amber-500" />
              </div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Round {currentRound}</p>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Your Topic</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <p className="text-base font-medium text-amber-900 leading-relaxed">{topic}</p>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                You have <strong className="text-gray-700">{config.timeSeconds / 60}:00</strong> minutes to speak.
                When ready, click Start to begin the timer.
              </p>
              <button
                onClick={handleStartSpeaking}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-all mx-auto"
              >
                <Mic className="w-4 h-4" />
                Start Speaking
              </button>
            </div>
          </div>
        )}

        {/* Table Topics: Speaking Phase */}
        {!loading && config.mode === 'table_topics' && step === 'speaking' && (
          <div className="max-w-2xl mx-auto w-full">
            {/* Traffic Light */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-4 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className={`w-5 h-5 rounded-full transition-all duration-300 ${getLightColor()}`} />
                <span className="text-3xl font-bold tabular-nums text-gray-900">{formatTime(elapsed)}</span>
                <span className="text-sm text-gray-400">/ {formatTime(config.timeSeconds)}</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Topic:</p>
                <p className="text-sm text-gray-600 italic">{topic}</p>
              </div>

              {/* Speech input */}
              <textarea
                ref={textareaRef}
                value={speechText}
                onChange={(e) => setSpeechText(e.target.value)}
                placeholder="Type what you said during your speech, or use the mic to record..."
                className="w-full h-32 p-3 rounded-xl border border-gray-200 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleStopSpeaking}
                  disabled={!speechText.trim()}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    speechText.trim()
                      ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Square className="w-4 h-4" />
                  Stop & Evaluate
                </button>
                {lightStatus === 'red' && (
                  <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Time's up!
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Prepared Speech: Input */}
        {!loading && config.mode === 'prepared_speech' && step === 'topic' && (
          <div className="max-w-2xl mx-auto w-full">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-4">Submit Your Speech</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Paste your prepared speech text below for AI evaluation and scoring.
              </p>
              <textarea
                value={preparedSpeechText}
                onChange={(e) => setPreparedSpeechText(e.target.value)}
                placeholder="Paste your speech here...&#10;&#10;Good morning everyone. Today I want to talk about..."
                className="w-full h-48 p-4 rounded-xl border border-gray-200 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleEvaluatePrepared}
                  disabled={!preparedSpeechText.trim()}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    preparedSpeechText.trim().length > 20
                      ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Evaluate Speech
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && step === 'result' && result && (
          <div className="max-w-2xl mx-auto w-full space-y-4">
            {/* Total Score Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-8 h-8 text-amber-500" />
              </div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
                {config.mode === 'table_topics' ? `Round ${currentRound}` : 'Evaluation'} Score
              </p>
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-5xl font-bold text-gray-900">{result.total_score}</span>
                <span className="text-lg text-gray-400">/ 50</span>
              </div>
              {renderStars(Math.round(result.total_score / 10) * 2)}
              <p className="text-sm text-gray-500 mt-2">{result.general_comment}</p>
            </div>

            {/* Detailed Scores */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">Detailed Scores</h4>
              <ScoreBar label="Content (内容)" score={result.scores.content} />
              <ScoreBar label="Organization (结构)" score={result.scores.organization} color="blue" />
              <ScoreBar label="Delivery (表达)" score={result.scores.delivery} color="green" />
              <ScoreBar label="Language (语言)" score={result.scores.language} />
              <ScoreBar label="Overall Impact (整体效果)" score={result.scores.overall_impact} color="green" />
            </div>

            {/* Strengths */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Strengths (亮点)
              </h4>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Areas for Improvement */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Areas for Improvement (待改进)
              </h4>
              <ul className="space-y-2">
                {result.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Recommendations (具体建议)
              </h4>
              <ul className="space-y-2">
                {result.recommendations.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Round History */}
            {roundHistory.length > 1 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Progress (历次成绩)</h4>
                <div className="space-y-2">
                  {roundHistory.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400">R{i + 1}</span>
                        <span className="text-sm text-gray-600 truncate max-w-[200px]">
                          {h.topic.slice(0, 40)}{h.topic.length > 40 ? '...' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderStars(Math.round((h.result?.total_score || 0) / 10) * 2)}
                        <span className="text-sm font-bold text-gray-900">{h.result?.total_score || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next / End buttons */}
            <div className="flex justify-center gap-3 pb-4">
              {config.mode === 'table_topics' && currentRound < config.rounds ? (
                <button
                  onClick={handleNextRound}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Next Round ({currentRound + 1}/{config.rounds})
                </button>
              ) : (
                <button
                  onClick={onEnd}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 shadow-sm transition-all"
                >
                  <X className="w-4 h-4" />
                  End Session
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
