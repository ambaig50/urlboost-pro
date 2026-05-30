'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight, CheckCircle, AlertCircle, XCircle,
  Download, Sun, Moon, Search, Globe, ExternalLink,
  RotateCcw, Plus, Trash2, Clock, Shield, AlertTriangle
} from 'lucide-react';
import jsPDF from 'jspdf';

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

const DEFAULT_SITES: SubmissionSite[] = [
  { id: 'archive', name: 'Wayback Machine (Archive.org)', url: 'https://web.archive.org/save/', desc: 'Instantly archives your page — crawlable by all engines.', category: 'Archive', appendUrl: true },
  { id: 'google-ping', name: 'Google Sitemap Ping', url: 'https://www.google.com/ping?sitemap=', desc: 'Pings Google to trigger re-crawl of your sitemap.', category: 'Search Engine', appendUrl: true },
  { id: 'bing-ping', name: 'Bing Sitemap Ping', url: 'https://www.bing.com/ping?sitemap=', desc: 'Pings Bing & Yahoo indexing with your sitemap.', category: 'Search Engine', appendUrl: true },
  { id: 'exactseek', name: 'ExactSeek', url: 'https://www.exactseek.com/add.html', desc: 'Free URL submission form — no account needed.', category: 'Directory', appendUrl: false },
  { id: 'entireweb', name: 'Entireweb Free Submit', url: 'https://www.entireweb.com/free_submission/', desc: 'Submit URL directly — no registration required.', category: 'Search Engine', appendUrl: false },
  { id: 'sonicrun', name: 'SonicRun', url: 'https://www.sonicrun.com/freelisting.html', desc: 'Free web directory — no account needed.', category: 'Directory', appendUrl: false },
  { id: 'viesearch', name: 'Viesearch', url: 'https://viesearch.com/submit', desc: 'Human-reviewed web directory — no login required.', category: 'Directory', appendUrl: false },
  { id: 'prolinkdir', name: 'ProLinkDirectory', url: 'https://www.prolinkdirectory.com/submit-url.php', desc: 'Submit URL, title, description — free, no signup.', category: 'Directory', appendUrl: false },
  { id: 'somuch', name: 'SoMuch.com', url: 'https://www.somuch.com/submit-links/', desc: 'High DA general directory, free submission.', category: 'Directory', appendUrl: false },
  { id: 'jayde', name: 'Jayde.com', url: 'https://www.jayde.com/addurl.html', desc: 'Business web directory — free, no registration.', category: 'Directory', appendUrl: false },
  { id: 'gnwd', name: 'GNWD', url: 'https://www.gnwd.com/add-url/', desc: 'General free web directory, no account required.', category: 'Directory', appendUrl: false },
  { id: 'elecdir', name: 'Elecdir', url: 'https://www.elecdir.com/', desc: 'General free directory — submit without signing up.', category: 'Directory', appendUrl: false },
];

type Step = 'input' | 'analysis' | 'submit' | 'report';
const STORAGE_KEY = 'urlboost_submissions';

function loadSubmissions(): SubmissionRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SubmissionRecord[]; }
  catch { return []; }
}
function saveSubmissions(r: SubmissionRecord[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch { /* ignore */ }
}

export default function URLBoostPro() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seoData, setSeoData] = useState<SeoResult | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [dark, setDark] = useState(true);
  const [error, setError] = useState('');
  const [sites, setSites] = useState<SubmissionSite[]>(DEFAULT_SITES);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [warnSite, setWarnSite] = useState<SubmissionSite | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', url: '', desc: '', category: 'Directory' });
  const [addError, setAddError] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('darkMode');
      const isDark = saved !== null ? saved === 'true' : true;
      setDark(isDark);
      setSubmissions(loadSubmissions());
    } catch { /* ignore */ }
  }, []);

  // Apply dark class to <html> whenever dark changes
  useEffect(() => {
    try {
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('darkMode', String(dark));
    } catch { /* ignore */ }
  }, [dark]);

  const analyze = async () => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('Please enter a valid URL starting with http:// or https://'); return;
    }
    setLoading(true); setError(''); setProgress(0);
    const iv = setInterval(() => setProgress(p => Math.min(90, p + 6)), 200);
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: trimmed }) });
      const data = await res.json() as SeoResult & { error?: string };
      if (!res.ok || data.error) { setError(data.error ?? 'Analysis failed.'); return; }
      setSeoData(data); setProgress(100);
      setTimeout(() => setStep('analysis'), 400);
    } catch { setError('Network error. Please check your connection.'); }
    finally { clearInterval(iv); setLoading(false); }
  };

  const getRecord = (site: SubmissionSite) =>
    submissions.find(r => r.siteId === site.id && r.submittedUrl === (seoData?.url ?? ''));

  const handleSiteClick = (site: SubmissionSite, e: React.MouseEvent) => {
    if (getRecord(site)) { e.preventDefault(); setWarnSite(site); return; }
    markPosted(site);
  };

  const markPosted = (site: SubmissionSite) => {
    if (!seoData) return;
    const record: SubmissionRecord = { siteId: site.id, siteName: site.name, submittedUrl: seoData.url, submittedTo: site.url, date: new Date().toISOString(), status: 'posted' };
    const updated = [...submissions.filter(r => !(r.siteId === site.id && r.submittedUrl === seoData.url)), record];
    setSubmissions(updated); saveSubmissions(updated); setWarnSite(null);
  };

  const proceedAnyway = (site: SubmissionSite) => {
    const href = site.appendUrl && seoData ? site.url + encodeURIComponent(seoData.url) : site.url;
    window.open(href, '_blank', 'noopener,noreferrer');
    markPosted(site);
  };

  const addCustomSite = () => {
    setAddError('');
    if (!newSite.name.trim()) { setAddError('Name is required.'); return; }
    if (!newSite.url.trim() || (!newSite.url.startsWith('http://') && !newSite.url.startsWith('https://'))) { setAddError('Valid URL (https://...) required.'); return; }
    setSites(s => [...s, { ...newSite, id: `custom_${Date.now()}`, appendUrl: false, custom: true, url: newSite.url.trim() }]);
    setNewSite({ name: '', url: '', desc: '', category: 'Directory' }); setShowAddForm(false);
  };

  const downloadReport = () => {
    if (!seoData) return;
    const doc = new jsPDF();
    const W = 210;

    // ─── Helper: draw dark background on current page ───────────────────────
    const darkBg = () => { doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 297, 'F'); };
    // Helper: wrap long text into lines
    const wrap = (text: string, maxWidth: number, fontSize: number): string[] => {
      doc.setFontSize(fontSize);
      return doc.splitTextToSize(text, maxWidth) as string[];
    };

    const sc = seoData.score;
    const scoreRgb: [number,number,number] = sc >= 70 ? [52,211,153] : sc >= 40 ? [251,191,36] : [248,113,113];
    const hostname = new URL(seoData.url).hostname;
    const dateStr = new Date(seoData.timestamp).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

    // ════════════════════════════════════════════════════════════════════════
    //  PAGE 1 — Summary / Score Card
    // ════════════════════════════════════════════════════════════════════════
    darkBg();

    // Top header bar
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, W, 44, 'F');
    doc.setFillColor(...scoreRgb); doc.rect(0, 0, 4, 44, 'F'); // accent stripe

    doc.setTextColor(255, 255, 255); doc.setFontSize(18);
    doc.text('URLBoost Pro', 14, 15);
    doc.setFontSize(9); doc.setTextColor(148, 163, 184);
    doc.text('SEO Analysis & Submission Report', 14, 23);
    doc.text(`Website: ${hostname}`, 14, 31);
    doc.text(`Prepared: ${dateStr}`, 14, 38);

    // Score circle area (right side)
    doc.setFillColor(15, 23, 42); doc.roundedRect(148, 6, 52, 32, 5, 5, 'F');
    doc.setFontSize(26); doc.setTextColor(...scoreRgb);
    doc.text(`${sc}`, sc >= 100 ? 155 : sc >= 10 ? 158 : 162, 27);
    doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text('/ 100  SEO Score', 149, 34);

    // URL + title row
    doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text('ANALYZED URL', 14, 54);
    doc.setFontSize(10); doc.setTextColor(96, 165, 250);
    doc.text(seoData.url.slice(0, 90), 14, 61);

    doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text('PAGE TITLE', 14, 70);
    doc.setFontSize(10); doc.setTextColor(220, 230, 245);
    doc.text((seoData.title || 'No title found').slice(0, 85), 14, 77);

    // Divider
    doc.setDrawColor(40, 55, 75); doc.setLineWidth(0.4); doc.line(14, 83, 196, 83);

    // 4 stat boxes
    const stats = [
      { label: 'H1 Tags', value: String(seoData.h1Count), good: seoData.h1Count === 1 },
      { label: 'H2 Tags', value: String(seoData.h2Count), good: seoData.h2Count > 0 },
      { label: 'Missing Alt', value: String(seoData.missingAlt), good: seoData.missingAlt === 0 },
      { label: 'Schema.org', value: seoData.hasSchema ? 'Yes' : 'No', good: seoData.hasSchema },
    ];
    stats.forEach((s, i) => {
      const x = 14 + i * 46;
      doc.setFillColor(22, 33, 52); doc.roundedRect(x, 88, 42, 22, 3, 3, 'F');
      const col: [number,number,number] = s.good ? [52,211,153] : [248,113,113];
      doc.setFontSize(13); doc.setTextColor(...col);
      doc.text(s.value, x + 21, 99, { align: 'center' });
      doc.setFontSize(7); doc.setTextColor(100, 116, 139);
      doc.text(s.label, x + 21, 106, { align: 'center' });
    });

    // SEO Findings section
    doc.setFontSize(11); doc.setTextColor(255, 255, 255);
    doc.text('SEO Findings', 14, 122);
    doc.setDrawColor(40, 55, 75); doc.line(14, 125, 196, 125);

    let y = 133;
    seoData.issues.forEach(issue => {
      const col: [number,number,number] = issue.type==='good' ? [52,211,153] : issue.type==='warning' ? [251,191,36] : [248,113,113];
      const bgCol: [number,number,number] = issue.type==='good' ? [12,40,28] : issue.type==='warning' ? [40,30,10] : [40,12,12];
      const symbol = issue.type === 'good' ? '✓' : issue.type === 'warning' ? '!' : '✗';

      // Row background
      doc.setFillColor(...bgCol); doc.roundedRect(14, y - 5, 182, 14, 2, 2, 'F');

      // Badge
      doc.setFillColor(...col); doc.roundedRect(16, y - 3.5, 7, 7, 1, 1, 'F');
      doc.setTextColor(15, 23, 42); doc.setFontSize(7); doc.text(symbol, 19.5, y + 1, { align: 'center' });

      // Message
      doc.setTextColor(220, 230, 245); doc.setFontSize(8.5);
      doc.text(issue.message.slice(0, 90), 26, y + 1);
      y += 10;

      if (issue.fix) {
        doc.setTextColor(100, 116, 139); doc.setFontSize(7.5);
        doc.text(`→ ${issue.fix.slice(0, 105)}`, 26, y);
        y += 8;
      }
      y += 2;
    });

    // Submission summary on page 1 (compact)
    const subs = submissions.filter(r => r.submittedUrl === seoData.url);
    if (subs.length > 0 && y < 260) {
      y += 4;
      doc.setDrawColor(40, 55, 75); doc.line(14, y, 196, y); y += 8;
      doc.setFontSize(11); doc.setTextColor(255, 255, 255);
      doc.text(`Directory Submissions  (${subs.length} submitted)`, 14, y); y += 9;

      doc.setFillColor(22, 33, 52); doc.rect(14, y-4, 182, 7, 'F');
      doc.setFontSize(7); doc.setTextColor(100, 116, 139);
      doc.text('Site', 17, y); doc.text('URL', 72, y); doc.text('Date', 145, y); doc.text('Status', 177, y);
      y += 8;

      subs.forEach((sub, i) => {
        if (i % 2 === 0) { doc.setFillColor(18, 27, 42); doc.rect(14, y-4, 182, 7, 'F'); }
        doc.setTextColor(220, 230, 245); doc.setFontSize(7.5);
        doc.text(sub.siteName.slice(0, 28), 17, y);
        doc.setTextColor(96, 165, 250);
        doc.text(sub.submittedTo.replace('https://','').slice(0, 38), 72, y);
        doc.setTextColor(148, 163, 184);
        doc.text(new Date(sub.date).toLocaleDateString(), 145, y);
        doc.setTextColor(52, 211, 153);
        doc.text('✓ Posted', 177, y);
        y += 8;
      });
    }

    // Page 1 footer
    doc.setFontSize(7); doc.setTextColor(40, 55, 75);
    doc.text('Page 1 of 2  •  URLBoost Pro  •  urlboost-pro.vercel.app', W / 2, 291, { align: 'center' });

    // ════════════════════════════════════════════════════════════════════════
    //  PAGE 2 — Detailed Client Explanation
    // ════════════════════════════════════════════════════════════════════════
    doc.addPage();
    darkBg();

    // Header bar
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, W, 38, 'F');
    doc.setFillColor(...scoreRgb); doc.rect(0, 0, 4, 38, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(16);
    doc.text('Detailed SEO Explanation & Recommendations', 14, 14);
    doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`Prepared for: ${hostname}  •  ${dateStr}`, 14, 22);
    doc.text('This page explains each finding in plain English and tells you exactly what to do next.', 14, 30);

    // Score interpretation block
    let p2y = 48;
    const scoreInterpTitle = sc >= 70
      ? `Your site is performing well (${sc}/100) — keep it up!`
      : sc >= 40
      ? `Your site needs some attention (${sc}/100) — fixable issues found`
      : `Your site has critical SEO problems (${sc}/100) — action required`;
    const scoreInterpBody = sc >= 70
      ? `An SEO score of ${sc}/100 means your page has most of the fundamental SEO elements in place. Search engines like Google can read and understand your page well. To continue improving, focus on the warnings flagged below and consider building quality backlinks from other websites.`
      : sc >= 40
      ? `An SEO score of ${sc}/100 means your page has some SEO basics covered, but there are gaps that are likely hurting your visibility in search results. The issues flagged below are straightforward to fix — addressing them could meaningfully improve how often your page appears when people search for your services.`
      : `An SEO score of ${sc}/100 means search engines are having trouble understanding and indexing your page properly. This directly impacts how often — and whether at all — your page shows up in search results. The critical issues listed below should be treated as urgent priorities.`;

    doc.setFillColor(22, 33, 52); doc.roundedRect(14, p2y - 5, 182, 32, 3, 3, 'F');
    doc.setFillColor(...scoreRgb); doc.rect(14, p2y - 5, 3, 32, 'F');
    doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
    doc.text(scoreInterpTitle, 20, p2y + 2);
    doc.setFontSize(8); doc.setTextColor(180, 195, 215);
    const interpLines = wrap(scoreInterpBody, 168, 8);
    interpLines.forEach((line, i) => { doc.text(line, 20, p2y + 11 + i * 6); });
    p2y += 38;

    // Per-issue detailed explanations
    doc.setFontSize(11); doc.setTextColor(255, 255, 255);
    doc.text('What Each Finding Means For You', 14, p2y + 4);
    doc.setDrawColor(40, 55, 75); doc.line(14, p2y + 7, 196, p2y + 7);
    p2y += 14;

    // Full explanations keyed to issue message patterns
    const explanations: Record<string, { why: string; how: string; impact: string }> = {
      'Title tag': {
        why: 'The title tag is the blue clickable headline shown in Google search results. It is the single most important on-page SEO element. Google reads it to understand what your page is about and displays it to users deciding whether to click.',
        how: 'Write a unique title for every page. Keep it between 50–60 characters. Include your primary keyword near the front. Example: "Affordable Web Design Services — YourBrand" instead of just "Home".',
        impact: 'A missing or poorly written title can reduce your click-through rate from search results by 30–50%. It also weakens your ranking for relevant keywords.',
      },
      'Meta description': {
        why: 'The meta description is the short paragraph shown below the title in search results. While Google does not use it directly for ranking, it heavily influences whether users click on your result — making it a critical conversion tool.',
        how: 'Write a compelling 150–160 character summary of the page. Include your main keyword and a clear reason why someone should click. Think of it as a 2-sentence advertisement for your page.',
        impact: 'A well-written meta description can increase click-through rates by 5–15%. This means more visitors without any additional advertising spend.',
      },
      'H1 tag': {
        why: 'The H1 is your page\'s main headline — the first large heading a visitor sees. Search engines treat it as a strong signal of what the page is about. Having exactly one H1 per page is best practice.',
        how: 'Every page should have exactly one H1 that clearly describes the page topic. Include your primary keyword in it. Additional headings should use H2 and H3 tags to create a logical hierarchy.',
        impact: 'Missing or multiple H1 tags confuse search engines about your page\'s primary topic, which can lower your ranking for target keywords.',
      },
      'Images': {
        why: 'The "alt" attribute on images is a text description that search engines read since they cannot see images. It also helps visually impaired users who use screen readers to understand your content.',
        how: 'Add a short, descriptive alt attribute to every image. Describe what is in the image using natural language. Include a keyword where it fits naturally — but do not stuff keywords artificially.',
        impact: 'Images without alt text are invisible to search engines, meaning you miss ranking opportunities in Google Image Search and lose accessibility compliance points.',
      },
      'Viewport': {
        why: 'The viewport meta tag tells mobile browsers how to scale and display your page. Without it, your site may appear zoomed out or broken on phones and tablets.',
        how: 'Add this line inside your <head> tag: <meta name="viewport" content="width=device-width, initial-scale=1">. This is standard in every modern website.',
        impact: 'Google uses mobile-first indexing — it ranks the mobile version of your site. A missing viewport tag signals a poor mobile experience and will hurt your rankings.',
      },
      'Structured data': {
        why: 'Structured data (Schema.org) is code you add to your page that tells search engines exactly what type of content it contains — a business, a product, a recipe, an event, etc. This enables "rich results" in Google with star ratings, prices, and more.',
        how: 'Add a JSON-LD script block in your page\'s <head> that describes your content type. For a business, include name, address, phone, and opening hours. Use Google\'s Structured Data Markup Helper as a starting point.',
        impact: 'Rich results (star ratings, FAQ dropdowns, etc.) dramatically increase visibility and click-through rates — often doubling the real estate your result takes up on the search page.',
      },
      'Canonical': {
        why: 'A canonical URL tag tells search engines which version of a page is the "official" one when similar or duplicate content exists at multiple URLs. Without it, search engines may split your ranking power across multiple URL variants.',
        how: 'Add <link rel="canonical" href="https://yoursite.com/this-page/"> to your page\'s <head>. It should point to the preferred, permanent URL of the page — including the correct protocol (https) and trailing slash if used.',
        impact: 'Duplicate content caused by missing canonical tags can dilute your page authority and confuse search engines, leading to lower rankings across all URL variants.',
      },
      'Open Graph': {
        why: 'Open Graph tags control how your page appears when shared on social media platforms like Facebook, LinkedIn, Twitter, and WhatsApp — including the preview image, title, and description that appears in posts.',
        how: 'Add og:title, og:description, og:image, and og:url tags to your page <head>. Use a high-quality image sized 1200×630px for best results. Many CMS platforms (WordPress, Webflow) have plugins that add these automatically.',
        impact: 'Without Open Graph tags, social shares of your page will show a generic or broken preview, reducing engagement and trust. Pages with attractive social previews get significantly more clicks from shares.',
      },
    };

    seoData.issues.forEach(issue => {
      // Find matching explanation
      const key = Object.keys(explanations).find(k => issue.message.toLowerCase().includes(k.toLowerCase()));
      const exp = key ? explanations[key] : null;
      if (!exp) return;

      const col: [number,number,number] = issue.type==='good' ? [52,211,153] : issue.type==='warning' ? [251,191,36] : [248,113,113];
      const label = issue.type === 'good' ? 'GOOD' : issue.type === 'warning' ? 'WARNING' : 'CRITICAL';

      // Estimate block height
      const whyLines = wrap(exp.why, 158, 8);
      const howLines = wrap(exp.how, 158, 8);
      const impactLines = wrap(exp.impact, 158, 8);
      const blockH = 12 + (whyLines.length + howLines.length + impactLines.length) * 6 + 36;

      if (p2y + blockH > 278) {
        doc.addPage(); darkBg();
        doc.setFontSize(7); doc.setTextColor(40, 55, 75);
        doc.text(`${hostname}  •  URLBoost Pro  •  urlboost-pro.vercel.app`, W / 2, 8, { align: 'center' });
        p2y = 16;
      }

      // Card background
      doc.setFillColor(20, 30, 46); doc.roundedRect(14, p2y, 182, blockH, 3, 3, 'F');
      doc.setFillColor(...col); doc.rect(14, p2y, 3, blockH, 'F');

      // Issue title row
      doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
      doc.text(issue.message.slice(0, 90), 20, p2y + 8);
      // Badge
      doc.setFillColor(...col); doc.roundedRect(170, p2y + 3, 22, 8, 2, 2, 'F');
      doc.setTextColor(15, 23, 42); doc.setFontSize(6.5);
      doc.text(label, 181, p2y + 8.5, { align: 'center' });

      let by = p2y + 16;

      // Why it matters
      doc.setFontSize(7.5); doc.setTextColor(...col);
      doc.text('WHY IT MATTERS', 20, by); by += 5;
      doc.setTextColor(180, 195, 215); doc.setFontSize(8);
      whyLines.forEach(line => { doc.text(line, 20, by); by += 5.5; }); by += 2;

      // How to fix
      doc.setFontSize(7.5); doc.setTextColor(...col);
      doc.text('HOW TO FIX IT', 20, by); by += 5;
      doc.setTextColor(180, 195, 215); doc.setFontSize(8);
      howLines.forEach(line => { doc.text(line, 20, by); by += 5.5; }); by += 2;

      // Business impact
      doc.setFontSize(7.5); doc.setTextColor(...col);
      doc.text('BUSINESS IMPACT', 20, by); by += 5;
      doc.setTextColor(180, 195, 215); doc.setFontSize(8);
      impactLines.forEach(line => { doc.text(line, 20, by); by += 5.5; });

      p2y += blockH + 6;
    });

    // Next steps section
    if (p2y + 55 > 278) { doc.addPage(); darkBg(); p2y = 16; }
    p2y += 4;
    doc.setDrawColor(40, 55, 75); doc.line(14, p2y, 196, p2y); p2y += 8;
    doc.setFontSize(11); doc.setTextColor(255, 255, 255);
    doc.text('Recommended Next Steps', 14, p2y); p2y += 10;

    const nextSteps = [
      { n: '1', text: 'Fix all CRITICAL issues first — these have the biggest impact on search visibility and should be done within the next 7 days.' },
      { n: '2', text: 'Address WARNING items next — title length, meta description, and Open Graph tags can usually be fixed in under an hour.' },
      { n: '3', text: 'Submit your sitemap to Google Search Console and Bing Webmaster Tools if you have not already — this tells search engines where your pages are.' },
      { n: '4', text: 'Install Google Analytics 4 and Microsoft Clarity (both free) to track how visitors interact with your site after these improvements.' },
      { n: '5', text: 'Re-run this analysis in 2–4 weeks after making changes to verify your score has improved and no regressions have been introduced.' },
    ];

    nextSteps.forEach(step => {
      const lines = wrap(step.text, 163, 8);
      const h = lines.length * 6 + 10;
      doc.setFillColor(22, 33, 52); doc.roundedRect(14, p2y, 182, h, 2, 2, 'F');
      doc.setFillColor(96, 165, 250); doc.circle(20, p2y + h / 2, 3.5, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.text(step.n, 20, p2y + h / 2 + 2.5, { align: 'center' });
      doc.setTextColor(180, 195, 215); doc.setFontSize(8);
      lines.forEach((line, i) => doc.text(line, 27, p2y + 7 + i * 6));
      p2y += h + 4;
    });

    // Disclaimer
    p2y += 6;
    if (p2y + 20 > 278) { doc.addPage(); darkBg(); p2y = 16; }
    doc.setFillColor(18, 26, 40); doc.roundedRect(14, p2y, 182, 18, 2, 2, 'F');
    doc.setFontSize(7); doc.setTextColor(80, 100, 130);
    const disclaimer = 'This report is based on a static HTML analysis of the page at the time of scanning. Dynamically loaded content (JavaScript-rendered elements) may not be fully captured. SEO results vary based on many factors including competition, content quality, and backlink profile. This report is intended as a starting-point guide and not a substitute for a comprehensive SEO audit.';
    const dLines = wrap(disclaimer, 172, 7);
    dLines.forEach((line, i) => doc.text(line, 18, p2y + 6 + i * 5));

    // Page 2 footer
    doc.setFontSize(7); doc.setTextColor(40, 55, 75);
    doc.text('Page 2 of 2  •  URLBoost Pro  •  urlboost-pro.vercel.app', W / 2, 291, { align: 'center' });

    doc.save(`URLBoost_${hostname}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const reset = () => { setStep('input'); setSeoData(null); setUrl(''); setError(''); setProgress(0); };

  const scoreColor = (s: number) => s >= 70 ? 'text-emerald-500' : s >= 40 ? 'text-amber-500' : 'text-red-500';
  const scoreLabel = (s: number) => s >= 70 ? 'Good' : s >= 40 ? 'Needs Work' : 'Poor';
  const issueIcon = (t: SeoIssue['type']) =>
    t==='good' ? <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={16}/> :
    t==='warning' ? <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16}/> :
    <XCircle className="text-red-500 shrink-0 mt-0.5" size={16}/>;
  const issueBg = (t: SeoIssue['type']) =>
    t==='good' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/40' :
    t==='warning' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40' :
    'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/40';

  const postedCount = seoData ? submissions.filter(r => r.submittedUrl === seoData.url).length : 0;

  // Shared class shortcuts
  const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl';
  const input = 'w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40 placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white transition-colors';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-200">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">URLBoost Pro</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">SEO Analysis · Free Submissions · Tracker · PDF Reports</p>
          </div>
          <button
            onClick={() => setDark(d => !d)}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-slate-600" />}
          </button>
        </div>

        {step !== 'input' && (
          <button onClick={reset} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm mb-6 transition-colors">
            <RotateCcw size={14} /> Analyze another URL
          </button>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 mb-6 text-sm flex items-start gap-2">
            <XCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* Warning modal */}
        {warnSite && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-7 max-w-sm w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                <h3 className="font-bold text-lg">Already Submitted!</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-sm mb-2">
                You already submitted <span className="text-slate-900 dark:text-white font-medium break-all">{seoData?.url}</span> to <span className="text-amber-600 dark:text-amber-400 font-medium">{warnSite.name}</span>.
              </p>
              {(() => { const rec = getRecord(warnSite); return rec ? <p className="text-slate-400 text-xs mb-5">Originally submitted on {new Date(rec.date).toLocaleString()}</p> : null; })()}
              <div className="flex gap-3">
                <button onClick={() => setWarnSite(null)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                <button onClick={() => proceedAnyway(warnSite)} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-medium transition-colors">Submit Again</button>
              </div>
            </div>
          </div>
        )}

        {/* STEP: Input */}
        {step === 'input' && (
          <div className={`${card} p-8`}>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2 font-medium">Enter your website URL</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !loading && url) void analyze(); }}
                  placeholder="https://yourwebsite.com"
                  className={`${input} pl-11`} />
              </div>
              <button onClick={() => void analyze()} disabled={loading || !url.trim()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap">
                {loading ? 'Analyzing…' : <><Search size={16} /> Analyze</>}
              </button>
            </div>
            {loading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1.5"><span>Fetching and analyzing…</span><span>{progress}%</span></div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-4">Checks 8 SEO factors: title, meta description, H1, alt text, viewport, schema.org, canonical URL, Open Graph.</p>
          </div>
        )}

        {/* STEP: Analysis */}
        {step === 'analysis' && seoData && (
          <div className="space-y-6">
            <div className={`${card} p-8`}>
              <div className="flex items-start justify-between mb-6">
                <div className="min-w-0 mr-4">
                  <h2 className="text-xl font-bold">SEO Analysis Results</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 break-all">{seoData.url}</p>
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
                  <div key={s.label} className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-3 text-center">
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
                      {issue.fix && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">→ {issue.fix}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setStep('submit')} className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Globe size={16} /> Submit to Directories
              </button>
              <button onClick={downloadReport} className="py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Download size={16} /> Download PDF Report
              </button>
            </div>
          </div>
        )}

        {/* STEP: Submissions */}
        {step === 'submit' && seoData && (
          <div className="space-y-5">
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-white">{postedCount}</span> of <span className="font-bold text-slate-900 dark:text-white">{sites.length}</span> submitted for <span className="text-blue-600 dark:text-blue-400 break-all">{new URL(seoData.url).hostname}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Shield size={13} className="text-emerald-500" /> Free · No signup
              </div>
            </div>

            <div className={`${card} overflow-hidden`}>
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Submission Sites</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">All free — no account or payment required</p>
                </div>
                <button onClick={() => { setShowAddForm(v => !v); setAddError(''); }}
                  className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors font-medium">
                  <Plus size={14} /> Add Site
                </button>
              </div>

              {showAddForm && (
                <div className="px-6 py-5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-medium mb-3">Add a custom submission site</p>
                  {addError && <p className="text-red-500 text-xs mb-3">{addError}</p>}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input value={newSite.name} onChange={e => setNewSite(s => ({ ...s, name: e.target.value }))} placeholder="Site name *" className={input} />
                    <select value={newSite.category} onChange={e => setNewSite(s => ({ ...s, category: e.target.value }))}
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-3 text-sm focus:border-blue-500 focus:outline-none text-slate-900 dark:text-white">
                      {['Directory','Search Engine','Archive','Social','Other'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <input value={newSite.url} onChange={e => setNewSite(s => ({ ...s, url: e.target.value }))} placeholder="Submission URL (https://...) *" className={`${input} mb-3`} />
                  <input value={newSite.desc} onChange={e => setNewSite(s => ({ ...s, desc: e.target.value }))} placeholder="Short description (optional)" className={`${input} mb-4`} />
                  <div className="flex gap-2">
                    <button onClick={addCustomSite} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">Add Site</button>
                    <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {sites.map(site => {
                  const record = getRecord(site);
                  const href = site.appendUrl ? site.url + encodeURIComponent(seoData.url) : site.url;
                  return (
                    <a key={site.id} href={href} target="_blank" rel="noopener noreferrer"
                      onClick={e => handleSiteClick(site, e)}
                      className={`flex items-center justify-between px-6 py-4 transition-colors group ${record ? 'bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                      <div className="flex items-center gap-3 min-w-0 mr-3">
                        {record
                          ? <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                          : <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                        }
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${record ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{site.name}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{site.category}</span>
                            {site.custom && <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">Custom</span>}
                            {record && <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500"><Clock size={10} />{new Date(record.date).toLocaleDateString()}</span>}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{site.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {record
                          ? <span className="text-xs text-emerald-600 dark:text-emerald-500 font-medium bg-emerald-100 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">Posted ✓</span>
                          : <ExternalLink size={15} className="text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
                        }
                        {site.custom && (
                          <button onClick={e => { e.preventDefault(); e.stopPropagation(); setSites(s => s.filter(x => x.id !== site.id)); }}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/50 text-slate-400 hover:text-red-500 transition-colors ml-1">
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
              <button onClick={() => setStep('report')} className="py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <ArrowRight size={16} /> View Final Report
              </button>
              <button onClick={downloadReport} className="py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <Download size={16} /> Download PDF
              </button>
            </div>
          </div>
        )}

        {/* STEP: Report */}
        {step === 'report' && seoData && (
          <div className="space-y-5">
            <div className={`${card} p-8 text-center`}>
              <CheckCircle className="w-14 h-14 mx-auto text-emerald-500 mb-4" />
              <h2 className="text-2xl font-bold mb-1">All Done!</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">
                SEO score: <span className={`font-bold ${scoreColor(seoData.score)}`}>{seoData.score}/100</span>
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-7">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{postedCount}</span> submission{postedCount !== 1 ? 's' : ''} recorded for <span className="text-blue-600 dark:text-blue-400">{new URL(seoData.url).hostname}</span>
              </p>
              <button onClick={downloadReport} className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3.5 rounded-xl font-semibold hover:opacity-90 transition-opacity text-sm">
                <Download size={18} /> Download Full Report (PDF)
              </button>
            </div>

            {postedCount > 0 && (
              <div className={`${card} overflow-hidden`}>
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-base">Submission Log</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">All recorded submissions for {seoData.url}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs">
                        <th className="text-left px-6 py-3 font-medium">Report Name</th>
                        <th className="text-left px-4 py-3 font-medium">Submitted URL</th>
                        <th className="text-left px-4 py-3 font-medium">Date</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {submissions.filter(r => r.submittedUrl === seoData.url).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-3 font-medium">{r.siteName}</td>
                          <td className="px-4 py-3 text-blue-600 dark:text-blue-400 text-xs break-all max-w-[180px]">{r.submittedTo}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(r.date).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full font-medium">
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
