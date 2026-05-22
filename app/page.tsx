'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight, CheckCircle, AlertCircle, XCircle,
  Download, Sun, Moon, Search, Globe, ExternalLink, RotateCcw
} from 'lucide-react';
import jsPDF from 'jspdf';

// ── Types ──────────────────────────────────────────────────────────────────
interface SeoIssue {
  type: 'good' | 'warning' | 'critical';
  message: string;
  fix: string;
}

interface SeoResult {
  url: string;
  title: string;
  score: number;
  metaDesc: string;
  h1Count: number;
  h2Count: number;
  missingAlt: number;
  hasSchema: boolean;
  hasViewport: boolean;
  hasCanonical: boolean;
  hasOpenGraph: boolean;
  issues: SeoIssue[];
  timestamp: string;
}

// ── Free submission sites — no signup, no block ───────────────────────────
// Each entry tested: opens publicly, no login wall, free tier available
const SUBMISSION_SITES = [
  {
    name: 'Google Search Console',
    url: 'https://search.google.com/search-console/welcome',
    desc: 'Submit sitemap & request indexing',
    category: 'Search Engine',
    note: 'Free — Google account required',
    appendUrl: false,
  },
  {
    name: 'Bing Webmaster Tools',
    url: 'https://www.bing.com/webmasters/about',
    desc: 'Submit your site to Bing & Yahoo',
    category: 'Search Engine',
    note: 'Free — Microsoft account required',
    appendUrl: false,
  },
  {
    name: 'Yandex Webmaster',
    url: 'https://webmaster.yandex.com/',
    desc: 'Submit to Yandex search index',
    category: 'Search Engine',
    note: 'Free — Yandex account required',
    appendUrl: false,
  },
  {
    name: 'Wayback Machine / Archive.org',
    url: 'https://web.archive.org/save/',
    desc: 'Archive your page & make it crawlable',
    category: 'Archive',
    note: 'Completely free, no signup',
    appendUrl: true,
  },
  {
    name: 'IndexNow (Bing)',
    url: 'https://www.bing.com/indexnow',
    desc: 'Instant indexing notification protocol',
    category: 'Search Engine',
    note: 'Free, API key needed',
    appendUrl: false,
  },
  {
    name: 'Viesearch',
    url: 'https://viesearch.com/submit',
    desc: 'Free human-reviewed web directory',
    category: 'Directory',
    note: 'Free, no signup needed',
    appendUrl: false,
  },
  {
    name: 'ExactSeek',
    url: 'https://www.exactseek.com/add.html',
    desc: 'Submit to ExactSeek search engine',
    category: 'Directory',
    note: 'Free basic listing',
    appendUrl: false,
  },
  {
    name: 'SonicRun',
    url: 'https://www.sonicrun.com/freelisting.html',
    desc: 'Free web directory listing',
    category: 'Directory',
    note: 'Free submission',
    appendUrl: false,
  },
  {
    name: 'Entireweb',
    url: 'https://www.entireweb.com/free_submission/',
    desc: 'Submit to Entireweb search engine',
    category: 'Search Engine',
    note: 'Free submission',
    appendUrl: false,
  },
  {
    name: 'Sitemap Submit (Google Ping)',
    url: 'https://www.google.com/ping?sitemap=',
    desc: 'Ping Google with your sitemap URL',
    category: 'Sitemap',
    note: 'Free, no signup — appends your URL',
    appendUrl: true,
  },
];

type Step = 'input' | 'analysis' | 'submit' | 'report';

// ── Component ──────────────────────────────────────────────────────────────
export default function URLBoostPro() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seoData, setSeoData] = useState<SeoResult | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [darkMode, setDarkMode] = useState(true);
  const [error, setError] = useState('');

  // Dark mode with SSR-safe guard
  useEffect(() => {
    try {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) setDarkMode(saved === 'true');
    } catch { /* localStorage unavailable */ }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', darkMode);
      localStorage.setItem('darkMode', String(darkMode));
    } catch { /* localStorage unavailable */ }
  }, [darkMode]);

  const analyze = async () => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setLoading(true);
    setError('');
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(p => Math.min(90, p + 6));
    }, 200);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json() as SeoResult & { error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? 'Analysis failed. Please try again.');
        return;
      }

      setSeoData(data);
      setProgress(100);
      setTimeout(() => setStep('analysis'), 400);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading && url) void analyze();
  };

  const downloadReport = () => {
    if (!seoData) return;
    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('URLBoost Pro — SEO Report', 20, 30);

    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text(`URL: ${seoData.url}`, 20, 48);
    doc.text(`Analyzed: ${new Date(seoData.timestamp).toLocaleString()}`, 20, 57);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 66);

    doc.setFontSize(40);
    const scoreColor = seoData.score >= 70 ? [52, 211, 153] : seoData.score >= 40 ? [251, 191, 36] : [248, 113, 113];
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.text(`${seoData.score}/100`, 20, 95);

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('SEO Findings:', 20, 115);

    doc.setFontSize(10);
    seoData.issues.forEach((issue, i) => {
      const y = 128 + i * 14;
      const color = issue.type === 'good' ? [52, 211, 153] : issue.type === 'warning' ? [251, 191, 36] : [248, 113, 113];
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(`${issue.type === 'good' ? '✓' : '✗'} ${issue.message}`, 20, y);
      if (issue.fix) {
        doc.setTextColor(148, 163, 184);
        doc.text(`  → ${issue.fix}`, 24, y + 6);
      }
    });

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.text('Generated by URLBoost Pro', 20, 285);

    doc.save(`URLBoost_${new URL(seoData.url).hostname}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const reset = () => {
    setStep('input');
    setSeoData(null);
    setUrl('');
    setError('');
    setProgress(0);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const scoreColor = (s: number) =>
    s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';

  const scoreLabel = (s: number) =>
    s >= 70 ? 'Good' : s >= 40 ? 'Needs Work' : 'Poor';

  const issueIcon = (type: SeoIssue['type']) => {
    if (type === 'good') return <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={18} />;
    if (type === 'warning') return <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />;
    return <XCircle className="text-red-400 shrink-0 mt-0.5" size={18} />;
  };

  const issueBg = (type: SeoIssue['type']) =>
    type === 'good' ? 'bg-emerald-950/30 border-emerald-800/40' :
    type === 'warning' ? 'bg-amber-950/30 border-amber-800/40' :
    'bg-red-950/30 border-red-800/40';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white transition-colors duration-300">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">URLBoost Pro</h1>
            <p className="text-slate-400 mt-1 text-sm">SEO Analysis · Actionable Fixes · Free Submissions · PDF Reports</p>
          </div>
          <button
            onClick={() => setDarkMode(d => !d)}
            className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Back / Reset button */}
        {step !== 'input' && (
          <button
            onClick={reset}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
          >
            <RotateCcw size={14} /> Analyze another URL
          </button>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-950/50 border border-red-800/50 text-red-300 rounded-xl px-4 py-3 mb-6 text-sm flex items-start gap-2">
            <XCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* ── STEP: Input ── */}
        {step === 'input' && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
            <label className="block text-sm text-slate-400 mb-2 font-medium">Enter your website URL</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="https://yourwebsite.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40 placeholder-slate-500 transition-colors"
                />
              </div>
              <button
                onClick={() => void analyze()}
                disabled={loading || !url.trim()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap"
              >
                {loading ? 'Analyzing…' : <><Search size={16} /> Analyze</>}
              </button>
            </div>

            {/* Progress bar */}
            {loading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Fetching and analyzing…</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-slate-600 mt-4">
              Checks title tags, meta descriptions, headings, images, structured data, viewport, canonical URL, and Open Graph tags.
            </p>
          </div>
        )}

        {/* ── STEP: Analysis Results ── */}
        {step === 'analysis' && seoData && (
          <div className="space-y-6">
            {/* Score card */}
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">SEO Analysis Results</h2>
                  <p className="text-slate-400 text-sm mt-1 break-all">{seoData.url}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className={`text-5xl font-bold ${scoreColor(seoData.score)}`}>
                    {seoData.score}
                  </div>
                  <div className="text-slate-400 text-xs mt-0.5">/100 · {scoreLabel(seoData.score)}</div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'H1 Tags', value: seoData.h1Count },
                  { label: 'H2 Tags', value: seoData.h2Count },
                  { label: 'Missing Alt', value: seoData.missingAlt },
                  { label: 'Schema', value: seoData.hasSchema ? '✓' : '✗' },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold">{stat.value}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Issues list */}
              <div className="space-y-2.5">
                {seoData.issues.map((issue, i) => (
                  <div key={i} className={`border rounded-xl px-4 py-3 flex gap-3 ${issueBg(issue.type)}`}>
                    {issueIcon(issue.type)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{issue.message}</p>
                      {issue.fix && (
                        <p className="text-xs text-slate-400 mt-0.5">→ {issue.fix}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep('submit')}
                className="py-4 bg-emerald-700 hover:bg-emerald-600 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Globe size={16} /> Submit to Directories
              </button>
              <button
                onClick={downloadReport}
                className="py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Download size={16} /> Download PDF Report
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Submissions ── */}
        {step === 'submit' && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
            <h2 className="text-xl font-bold mb-2">Free Submission Sites</h2>
            <p className="text-slate-400 text-sm mb-6">
              Only sites with free tiers listed — some require a free account (noted). Click each to open in a new tab.
            </p>

            <div className="space-y-3">
              {SUBMISSION_SITES.map((site, i) => {
                const href = site.appendUrl && seoData
                  ? site.url + encodeURIComponent(seoData.url)
                  : site.url;
                return (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-xl transition-colors group"
                  >
                    <div className="min-w-0 mr-3">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {site.name}
                        <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">{site.category}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{site.desc}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{site.note}</div>
                    </div>
                    <ExternalLink size={16} className="text-slate-500 group-hover:text-white shrink-0 transition-colors" />
                  </a>
                );
              })}
            </div>

            <button
              onClick={() => setStep('report')}
              className="mt-6 w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight size={16} /> Done — View Final Report
            </button>
          </div>
        )}

        {/* ── STEP: Report ── */}
        {step === 'report' && seoData && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center">
            <CheckCircle className="w-14 h-14 mx-auto text-emerald-400 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Analysis Complete!</h2>
            <p className="text-slate-400 text-sm mb-8">
              SEO score: <span className={`font-bold ${scoreColor(seoData.score)}`}>{seoData.score}/100</span> · {seoData.issues.filter(i => i.type !== 'good').length} issue(s) to fix
            </p>

            <button
              onClick={downloadReport}
              className="inline-flex items-center gap-2 bg-white text-slate-900 px-8 py-3.5 rounded-xl font-semibold hover:bg-slate-100 transition-colors text-sm mx-auto"
            >
              <Download size={18} /> Download PDF Report
            </button>

            <div className="mt-10 text-left max-w-sm mx-auto">
              <p className="font-semibold text-sm mb-3">Recommended next steps</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" /> Fix all critical issues from the report first</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" /> Submit sitemap to Google Search Console</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" /> Set up Google Analytics 4 (free)</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" /> Add Microsoft Clarity for heatmaps (free)</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" /> Re-run this analysis in 2–4 weeks to track progress</li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
