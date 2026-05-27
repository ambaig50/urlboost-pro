'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight, CheckCircle, AlertCircle, XCircle,
  Download, Sun, Moon, Search, Globe, ExternalLink,
  RotateCcw, Plus, Trash2, Clock, Shield, AlertTriangle
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

interface SubmissionSite {
  id: string;
  name: string;
  url: string;
  desc: string;
  category: string;
  appendUrl: boolean;
  custom?: boolean;
}

interface SubmissionRecord {
  siteId: string;
  siteName: string;
  submittedUrl: string;
  submittedTo: string;
  date: string;
  status: 'posted';
}

// ── Verified free, no-signup submission sites ──────────────────────────────
// Each verified: publicly accessible form, no account wall, no paid gate
const DEFAULT_SITES: SubmissionSite[] = [
  {
    id: 'archive',
    name: 'Wayback Machine (Archive.org)',
    url: 'https://web.archive.org/save/',
    desc: 'Instantly archives your page — crawlable by all engines. Paste your URL after the slash.',
    category: 'Archive',
    appendUrl: true,
  },
  {
    id: 'google-ping',
    name: 'Google Sitemap Ping',
    url: 'https://www.google.com/ping?sitemap=',
    desc: 'Pings Google with your sitemap URL to trigger re-crawl. Append your sitemap URL.',
    category: 'Search Engine',
    appendUrl: true,
  },
  {
    id: 'bing-ping',
    name: 'Bing Sitemap Ping',
    url: 'https://www.bing.com/ping?sitemap=',
    desc: 'Pings Bing & Yahoo indexing with your sitemap. Append your sitemap URL.',
    category: 'Search Engine',
    appendUrl: true,
  },
  {
    id: 'exactseek',
    name: 'ExactSeek',
    url: 'https://www.exactseek.com/add.html',
    desc: 'Free URL submission form — no account needed. Fill title, URL, description.',
    category: 'Directory',
    appendUrl: false,
  },
  {
    id: 'entireweb',
    name: 'Entireweb Free Submit',
    url: 'https://www.entireweb.com/free_submission/',
    desc: 'Submit URL directly — no registration required for the basic free listing.',
    category: 'Search Engine',
    appendUrl: false,
  },
  {
    id: 'sonicrun',
    name: 'SonicRun',
    url: 'https://www.sonicrun.com/freelisting.html',
    desc: 'Free web directory — submit title, URL, description with no account.',
    category: 'Directory',
    appendUrl: false,
  },
  {
    id: 'viesearch',
    name: 'Viesearch',
    url: 'https://viesearch.com/submit',
    desc: 'Human-reviewed web directory — free submission form, no login required.',
    category: 'Directory',
    appendUrl: false,
  },
  {
    id: 'prolinkdir',
    name: 'ProLinkDirectory',
    url: 'https://www.prolinkdirectory.com/submit-url.php',
    desc: 'Submit URL, title, description — free tier, no signup wall.',
    category: 'Directory',
    appendUrl: false,
  },
  {
    id: 'somuch',
    name: 'SoMuch.com',
    url: 'https://www.somuch.com/submit-links/',
    desc: 'High DA general directory, free submission. No account needed.',
    category: 'Directory',
    appendUrl: false,
  },
  {
    id: 'siteadvisor',
    name: 'Jayde.com',
    url: 'https://www.jayde.com/addurl.html',
    desc: 'Business web directory — free URL submission form, no registration.',
    category: 'Directory',
    appendUrl: false,
  },
  {
    id: 'elecdir',
    name: 'Elecdir',
    url: 'https://www.elecdir.com/',
    desc: 'Electronics & general free directory — submit URL without signing up.',
    category: 'Directory',
    appendUrl: false,
  },
  {
    id: 'gnwd',
    name: 'GNWD',
    url: 'https://www.gnwd.com/add-url/',
    desc: 'General free web directory, no account required for basic submission.',
    category: 'Directory',
    appendUrl: false,
  },
];

type Step = 'input' | 'analysis' | 'submit' | 'report';
const STORAGE_KEY = 'urlboost_submissions';

// ── Helpers ─────────────────────────────────────────────────────────────────
function loadSubmissions(): SubmissionRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SubmissionRecord[]; }
  catch { return []; }
}

function saveSubmissions(records: SubmissionRecord[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch { /* ignore */ }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function URLBoostPro() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seoData, setSeoData] = useState<SeoResult | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [darkMode, setDarkMode] = useState(true);
  const [error, setError] = useState('');

  // Submission state
  const [sites, setSites] = useState<SubmissionSite[]>(DEFAULT_SITES);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [warnSite, setWarnSite] = useState<SubmissionSite | null>(null);

  // Add custom site form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', url: '', desc: '', category: 'Directory' });
  const [addError, setAddError] = useState('');

  // SSR-safe init
  useEffect(() => {
    try {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) setDarkMode(saved === 'true');
      setSubmissions(loadSubmissions());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', darkMode);
      localStorage.setItem('darkMode', String(darkMode));
    } catch { /* ignore */ }
  }, [darkMode]);

  // ── Analysis ──────────────────────────────────────────────────────────────
  const analyze = async () => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }
    setLoading(true); setError(''); setProgress(0);
    const iv = setInterval(() => setProgress(p => Math.min(90, p + 6)), 200);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json() as SeoResult & { error?: string };
      if (!res.ok || data.error) { setError(data.error ?? 'Analysis failed.'); return; }
      setSeoData(data);
      setProgress(100);
      setTimeout(() => setStep('analysis'), 400);
    } catch { setError('Network error. Please check your connection.'); }
    finally { clearInterval(iv); setLoading(false); }
  };

  // ── Submission tracking ────────────────────────────────────────────────────
  const getRecord = (site: SubmissionSite) =>
    submissions.find(r => r.siteId === site.id && r.submittedUrl === (seoData?.url ?? ''));

  const handleSiteClick = (site: SubmissionSite, e: React.MouseEvent) => {
    const existing = getRecord(site);
    if (existing) { e.preventDefault(); setWarnSite(site); return; }
    markPosted(site);
  };

  const markPosted = (site: SubmissionSite) => {
    if (!seoData) return;
    const record: SubmissionRecord = {
      siteId: site.id,
      siteName: site.name,
      submittedUrl: seoData.url,
      submittedTo: site.url,
      date: new Date().toISOString(),
      status: 'posted',
    };
    const updated = [...submissions.filter(r => !(r.siteId === site.id && r.submittedUrl === seoData.url)), record];
    setSubmissions(updated);
    saveSubmissions(updated);
    setWarnSite(null);
  };

  const proceedAnyway = (site: SubmissionSite) => {
    const href = site.appendUrl && seoData
      ? site.url + encodeURIComponent(seoData.url)
      : site.url;
    window.open(href, '_blank', 'noopener,noreferrer');
    markPosted(site);
  };

  // ── Custom site ────────────────────────────────────────────────────────────
  const addCustomSite = () => {
    setAddError('');
    if (!newSite.name.trim()) { setAddError('Name is required.'); return; }
    if (!newSite.url.trim() || (!newSite.url.startsWith('http://') && !newSite.url.startsWith('https://'))) {
      setAddError('Valid URL starting with http:// or https:// is required.'); return;
    }
    const id = `custom_${Date.now()}`;
    setSites(s => [...s, { ...newSite, id, appendUrl: false, custom: true, url: newSite.url.trim() }]);
    setNewSite({ name: '', url: '', desc: '', category: 'Directory' });
    setShowAddForm(false);
  };

  const removeSite = (id: string) => setSites(s => s.filter(x => x.id !== id));

  // ── Report PDF ─────────────────────────────────────────────────────────────
  const downloadReport = () => {
    if (!seoData) return;
    const doc = new jsPDF();
    const pageW = 210;

    // Background
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 297, 'F');

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('URLBoost Pro — SEO & Submission Report', 15, 16);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Report Name: ${new URL(seoData.url).hostname} — ${new Date(seoData.timestamp).toLocaleDateString()}`, 15, 26);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 33);

    // Score
    const sc = seoData.score;
    const scoreRgb: [number, number, number] = sc >= 70 ? [52, 211, 153] : sc >= 40 ? [251, 191, 36] : [248, 113, 113];
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('Submitted URL:', 15, 52);
    doc.setTextColor(96, 165, 250);
    doc.text(seoData.url, 15, 59);
    doc.setTextColor(255, 255, 255);
    doc.text('Page Title:', 15, 68);
    doc.setTextColor(148, 163, 184);
    doc.text(seoData.title.slice(0, 80), 15, 75);

    // Score box
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(140, 48, 55, 30, 4, 4, 'F');
    doc.setFontSize(28);
    doc.setTextColor(...scoreRgb);
    doc.text(`${seoData.score}`, 155, 69);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('/100 SEO Score', 146, 75);

    // Divider
    doc.setDrawColor(51, 65, 85);
    doc.line(15, 85, 195, 85);

    // SEO Issues
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('SEO Analysis', 15, 95);
    doc.setFontSize(9);
    let y = 104;
    seoData.issues.forEach(issue => {
      const color: [number, number, number] = issue.type === 'good' ? [52, 211, 153] : issue.type === 'warning' ? [251, 191, 36] : [248, 113, 113];
      doc.setTextColor(...color);
      doc.text(`${issue.type === 'good' ? '✓' : '✗'} ${issue.message}`, 18, y);
      y += 6;
      if (issue.fix) {
        doc.setTextColor(100, 116, 139);
        doc.text(`   → ${issue.fix}`, 18, y);
        y += 6;
      }
      y += 1;
    });

    // Submissions table
    const subs = submissions.filter(r => r.submittedUrl === seoData.url);
    if (subs.length > 0) {
      y += 6;
      doc.setDrawColor(51, 65, 85);
      doc.line(15, y, 195, y);
      y += 8;

      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(`Directory Submissions (${subs.length} submitted)`, 15, y);
      y += 8;

      // Table header
      doc.setFillColor(30, 41, 59);
      doc.rect(15, y - 4, 180, 8, 'F');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Report Name', 17, y + 1);
      doc.text('Submitted URL', 70, y + 1);
      doc.text('Date', 140, y + 1);
      doc.text('Status', 175, y + 1);
      y += 9;

      subs.forEach((sub, i) => {
        if (i % 2 === 0) { doc.setFillColor(20, 30, 48); doc.rect(15, y - 4, 180, 7, 'F'); }
        doc.setTextColor(255, 255, 255);
        doc.text(sub.siteName.slice(0, 28), 17, y);
        doc.setTextColor(96, 165, 250);
        doc.text(sub.submittedTo.replace('https://', '').slice(0, 35), 70, y);
        doc.setTextColor(148, 163, 184);
        doc.text(new Date(sub.date).toLocaleDateString(), 140, y);
        doc.setTextColor(52, 211, 153);
        doc.text('✓ Posted', 175, y);
        y += 8;
        if (y > 270) { doc.addPage(); doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 297, 'F'); y = 20; }
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text('Generated by URLBoost Pro — urlboost-pro.vercel.app', 15, 290);

    doc.save(`URLBoost_${new URL(seoData.url).hostname}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const reset = () => { setStep('input'); setSeoData(null); setUrl(''); setError(''); setProgress(0); };

  // ── Style helpers ──────────────────────────────────────────────────────────
  const scoreColor = (s: number) => s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';
  const scoreLabel = (s: number) => s >= 70 ? 'Good' : s >= 40 ? 'Needs Work' : 'Poor';
  const issueIcon = (type: SeoIssue['type']) =>
    type === 'good' ? <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={16} /> :
    type === 'warning' ? <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={16} /> :
    <XCircle className="text-red-400 shrink-0 mt-0.5" size={16} />;
  const issueBg = (type: SeoIssue['type']) =>
    type === 'good' ? 'bg-emerald-950/30 border-emerald-800/40' :
    type === 'warning' ? 'bg-amber-950/30 border-amber-800/40' :
    'bg-red-950/30 border-red-800/40';

  const postedCount = seoData ? submissions.filter(r => r.submittedUrl === seoData.url).length : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">URLBoost Pro</h1>
            <p className="text-slate-400 mt-1 text-sm">SEO Analysis · Free Submissions · Submission Tracker · PDF Reports</p>
          </div>
          <button onClick={() => setDarkMode(d => !d)} className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors" aria-label="Toggle dark mode">
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {step !== 'input' && (
          <button onClick={reset} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
            <RotateCcw size={14} /> Analyze another URL
          </button>
        )}

        {error && (
          <div className="bg-red-950/50 border border-red-800/50 text-red-300 rounded-xl px-4 py-3 mb-6 text-sm flex items-start gap-2">
            <XCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* ── Duplicate submission warning modal ── */}
        {warnSite && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="bg-slate-900 border border-amber-700/60 rounded-2xl p-7 max-w-sm w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-amber-400 shrink-0" size={24} />
                <h3 className="font-bold text-lg">Already Submitted!</h3>
              </div>
              <p className="text-slate-300 text-sm mb-2">
                You already submitted <span className="text-white font-medium break-all">{seoData?.url}</span> to <span className="text-amber-400 font-medium">{warnSite.name}</span>.
              </p>
              {(() => {
                const rec = getRecord(warnSite);
                return rec ? (
                  <p className="text-slate-500 text-xs mb-5">
                    Originally submitted on {new Date(rec.date).toLocaleString()}
                  </p>
                ) : null;
              })()}
              <div className="flex gap-3">
                <button onClick={() => setWarnSite(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button onClick={() => proceedAnyway(warnSite)} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl text-sm font-medium transition-colors">
                  Submit Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Input ── */}
        {step === 'input' && (
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
            <label className="block text-sm text-slate-400 mb-2 font-medium">Enter your website URL</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !loading && url) void analyze(); }}
                  placeholder="https://yourwebsite.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40 placeholder-slate-500 transition-colors" />
              </div>
              <button onClick={() => void analyze()} disabled={loading || !url.trim()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap">
                {loading ? 'Analyzing…' : <><Search size={16} /> Analyze</>}
              </button>
            </div>
            {loading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Fetching and analyzing…</span><span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <p className="text-xs text-slate-600 mt-4">Checks 8 SEO factors: title, meta description, H1, alt text, viewport, schema.org, canonical URL, Open Graph.</p>
          </div>
        )}

        {/* ── STEP: Analysis ── */}
        {step === 'analysis' && seoData && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
              <div className="flex items-start justify-between mb-6">
                <div className="min-w-0 mr-4">
                  <h2 className="text-xl font-bold">SEO Analysis Results</h2>
                  <p className="text-slate-400 text-sm mt-1 break-all">{seoData.url}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-5xl font-bold ${scoreColor(seoData.score)}`}>{seoData.score}</div>
                  <div className="text-slate-400 text-xs mt-0.5">/100 · {scoreLabel(seoData.score)}</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'H1 Tags', value: seoData.h1Count },
                  { label: 'H2 Tags', value: seoData.h2Count },
                  { label: 'Missing Alt', value: seoData.missingAlt },
                  { label: 'Schema', value: seoData.hasSchema ? '✓' : '✗' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold">{s.value}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {seoData.issues.map((issue, i) => (
                  <div key={i} className={`border rounded-xl px-4 py-3 flex gap-3 ${issueBg(issue.type)}`}>
                    {issueIcon(issue.type)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{issue.message}</p>
                      {issue.fix && <p className="text-xs text-slate-400 mt-0.5">→ {issue.fix}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setStep('submit')} className="py-4 bg-emerald-700 hover:bg-emerald-600 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Globe size={16} /> Submit to Directories
              </button>
              <button onClick={downloadReport} className="py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Download size={16} /> Download PDF Report
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Submissions ── */}
        {step === 'submit' && seoData && (
          <div className="space-y-5">
            {/* Stats bar */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-5 py-3">
              <div className="text-sm text-slate-300">
                <span className="font-bold text-white">{postedCount}</span> of <span className="font-bold text-white">{sites.length}</span> submitted for <span className="text-blue-400 break-all">{new URL(seoData.url).hostname}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Shield size={13} className="text-emerald-500" /> Free · No signup
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Submission Sites</h2>
                  <p className="text-slate-400 text-xs mt-0.5">All sites below are free with no account or payment required</p>
                </div>
                <button onClick={() => { setShowAddForm(v => !v); setAddError(''); }}
                  className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg transition-colors font-medium">
                  <Plus size={14} /> Add Site
                </button>
              </div>

              {/* Add custom site form */}
              {showAddForm && (
                <div className="px-6 py-5 bg-slate-800/40 border-b border-slate-700">
                  <p className="text-sm font-medium mb-3">Add a custom submission site</p>
                  {addError && <p className="text-red-400 text-xs mb-3">{addError}</p>}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input value={newSite.name} onChange={e => setNewSite(s => ({ ...s, name: e.target.value }))}
                      placeholder="Site name *" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none placeholder-slate-500" />
                    <select value={newSite.category} onChange={e => setNewSite(s => ({ ...s, category: e.target.value }))}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                      {['Directory', 'Search Engine', 'Archive', 'Social', 'Other'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <input value={newSite.url} onChange={e => setNewSite(s => ({ ...s, url: e.target.value }))}
                    placeholder="Submission URL (https://...) *" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm mb-3 focus:border-blue-500 focus:outline-none placeholder-slate-500" />
                  <input value={newSite.desc} onChange={e => setNewSite(s => ({ ...s, desc: e.target.value }))}
                    placeholder="Short description (optional)" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm mb-4 focus:border-blue-500 focus:outline-none placeholder-slate-500" />
                  <div className="flex gap-2">
                    <button onClick={addCustomSite} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">Add Site</button>
                    <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {/* Sites list */}
              <div className="divide-y divide-slate-800/60">
                {sites.map(site => {
                  const record = getRecord(site);
                  const href = site.appendUrl ? site.url + encodeURIComponent(seoData.url) : site.url;
                  return (
                    <a key={site.id} href={href} target="_blank" rel="noopener noreferrer"
                      onClick={e => handleSiteClick(site, e)}
                      className={`flex items-center justify-between px-6 py-4 transition-colors group
                        ${record ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-slate-800/60'}`}>
                      <div className="flex items-center gap-3 min-w-0 mr-3">
                        {record
                          ? <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                          : <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-600 shrink-0" />
                        }
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${record ? 'text-emerald-300' : ''}`}>{site.name}</span>
                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{site.category}</span>
                            {site.custom && <span className="text-xs text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded-full">Custom</span>}
                            {record && (
                              <span className="flex items-center gap-1 text-xs text-emerald-500">
                                <Clock size={10} /> {new Date(record.date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{site.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {record
                          ? <span className="text-xs text-emerald-500 font-medium bg-emerald-950/50 px-2.5 py-1 rounded-full">Posted ✓</span>
                          : <ExternalLink size={15} className="text-slate-500 group-hover:text-white transition-colors" />
                        }
                        {site.custom && (
                          <button onClick={e => { e.preventDefault(); e.stopPropagation(); removeSite(site.id); }}
                            className="p-1 rounded hover:bg-red-950/50 text-slate-600 hover:text-red-400 transition-colors ml-1">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setStep('report')}
                className="py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <ArrowRight size={16} /> View Final Report
              </button>
              <button onClick={downloadReport}
                className="py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Download size={16} /> Download PDF
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Final Report ── */}
        {step === 'report' && seoData && (
          <div className="space-y-5">
            <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center">
              <CheckCircle className="w-14 h-14 mx-auto text-emerald-400 mb-4" />
              <h2 className="text-2xl font-bold mb-1">All Done!</h2>
              <p className="text-slate-400 text-sm mb-2">
                SEO score: <span className={`font-bold ${scoreColor(seoData.score)}`}>{seoData.score}/100</span>
              </p>
              <p className="text-slate-400 text-sm mb-7">
                <span className="text-emerald-400 font-semibold">{postedCount}</span> submission{postedCount !== 1 ? 's' : ''} recorded for <span className="text-blue-400">{new URL(seoData.url).hostname}</span>
              </p>
              <button onClick={downloadReport}
                className="inline-flex items-center gap-2 bg-white text-slate-900 px-8 py-3.5 rounded-xl font-semibold hover:bg-slate-100 transition-colors text-sm">
                <Download size={18} /> Download Full Report (PDF)
              </button>
            </div>

            {/* Submission log table */}
            {postedCount > 0 && (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800">
                  <h3 className="font-bold text-base">Submission Log</h3>
                  <p className="text-slate-400 text-xs mt-0.5">All recorded submissions for {seoData.url}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800/50 text-slate-400 text-xs">
                        <th className="text-left px-6 py-3 font-medium">Report Name</th>
                        <th className="text-left px-4 py-3 font-medium">Submitted URL</th>
                        <th className="text-left px-4 py-3 font-medium">Date</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {submissions.filter(r => r.submittedUrl === seoData.url).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-3 font-medium">{r.siteName}</td>
                          <td className="px-4 py-3 text-blue-400 text-xs break-all max-w-[180px]">{r.submittedTo}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(r.date).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs bg-emerald-950/50 px-2 py-0.5 rounded-full font-medium">
                              <CheckCircle size={10} /> Posted
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
