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

    // Decode HTML entities so &amp; shows as & in PDF
    const decode = (str: string) =>
      str.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");

    const darkBg = () => { doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 297, 'F'); };
    const wrap = (text: string, maxW: number, fs: number): string[] => {
      doc.setFontSize(fs); return doc.splitTextToSize(text, maxW) as string[];
    };

    const sc = seoData.score;
    const scoreRgb: [number,number,number] = sc >= 70 ? [52,211,153] : sc >= 40 ? [251,191,36] : [248,113,113];
    const hostname = new URL(seoData.url).hostname;
    const dateStr = new Date(seoData.timestamp).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

    // ── PAGE 1: Score Card ───────────────────────────────────────────────────
    darkBg();
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, W, 44, 'F');
    doc.setFillColor(...scoreRgb); doc.rect(0, 0, 4, 44, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(18);
    doc.text('URLBoost Pro', 14, 15);
    doc.setFontSize(9); doc.setTextColor(148,163,184);
    doc.text('SEO Analysis & Submission Report', 14, 23);
    doc.text(`Website: ${hostname}`, 14, 31);
    doc.text(`Prepared: ${dateStr}`, 14, 38);

    doc.setFillColor(15,23,42); doc.roundedRect(148,6,52,32,5,5,'F');
    doc.setFontSize(26); doc.setTextColor(...scoreRgb);
    doc.text(`${sc}`, sc>=100?155:sc>=10?158:162, 27);
    doc.setFontSize(8); doc.setTextColor(148,163,184);
    doc.text('/ 100  SEO Score', 149, 34);

    doc.setFontSize(8); doc.setTextColor(100,116,139); doc.text('ANALYZED URL', 14, 54);
    doc.setFontSize(10); doc.setTextColor(96,165,250);
    doc.text(seoData.url.slice(0,90), 14, 61);
    doc.setFontSize(8); doc.setTextColor(100,116,139); doc.text('PAGE TITLE', 14, 70);
    doc.setFontSize(10); doc.setTextColor(220,230,245);
    doc.text(decode(seoData.title || 'No title found').slice(0,85), 14, 77);

    doc.setDrawColor(40,55,75); doc.setLineWidth(0.4); doc.line(14,83,196,83);

    const stats = [
      { label:'H1 Tags',     value:String(seoData.h1Count),           good:seoData.h1Count===1 },
      { label:'H2 Tags',     value:String(seoData.h2Count),           good:seoData.h2Count>0 },
      { label:'Missing Alt', value:String(seoData.missingAlt),        good:seoData.missingAlt===0 },
      { label:'Schema.org',  value:seoData.hasSchema?'Yes':'No',      good:seoData.hasSchema },
    ];
    stats.forEach((s, i) => {
      const x = 14 + i*46;
      doc.setFillColor(22,33,52); doc.roundedRect(x,88,42,22,3,3,'F');
      const col: [number,number,number] = s.good ? [52,211,153] : [248,113,113];
      doc.setFontSize(13); doc.setTextColor(...col);
      doc.text(s.value, x+21, 99, { align:'center' });
      doc.setFontSize(7); doc.setTextColor(100,116,139);
      doc.text(s.label, x+21, 106, { align:'center' });
    });

    doc.setFontSize(11); doc.setTextColor(255,255,255);
    doc.text('SEO Findings', 14, 122);
    doc.setDrawColor(40,55,75); doc.line(14,125,196,125);

    let y = 133;
    seoData.issues.forEach(issue => {
      const col: [number,number,number] = issue.type==='good'?[52,211,153]:issue.type==='warning'?[251,191,36]:[248,113,113];
      const bgCol: [number,number,number] = issue.type==='good'?[12,40,28]:issue.type==='warning'?[40,30,10]:[40,12,12];
      const symbol = issue.type==='good'?'OK':issue.type==='warning'?'!':'X';
      const rowH = issue.fix && issue.type !== 'good' ? 22 : 13;
      doc.setFillColor(...bgCol); doc.roundedRect(14,y-4,182,rowH,2,2,'F');
      doc.setFillColor(...col); doc.roundedRect(16,y-2.5,7,7,1,1,'F');
      doc.setTextColor(15,23,42); doc.setFontSize(6); doc.text(symbol, 19.5, y+2, { align:'center' });
      doc.setTextColor(220,230,245); doc.setFontSize(8.5);
      doc.text(decode(issue.message).slice(0,90), 26, y+2);
      y += 10;
      if (issue.fix && issue.type !== 'good') {
        doc.setTextColor(148,163,184); doc.setFontSize(7.5);
        doc.text('Fix: ' + issue.fix.slice(0,100), 26, y);
        y += 9;
      }
      y += 2;
    });

    // Submissions table
    const subs = submissions.filter(r => r.submittedUrl === seoData.url);
    if (subs.length > 0 && y < 255) {
      y += 4;
      doc.setDrawColor(40,55,75); doc.line(14,y,196,y); y+=8;
      doc.setFontSize(11); doc.setTextColor(255,255,255);
      doc.text(`Directory Submissions (${subs.length} submitted)`, 14, y); y+=9;
      doc.setFillColor(22,33,52); doc.rect(14,y-4,182,7,'F');
      doc.setFontSize(7); doc.setTextColor(100,116,139);
      doc.text('Site',17,y); doc.text('URL',72,y); doc.text('Date',145,y); doc.text('Status',177,y); y+=8;
      subs.forEach((sub,i) => {
        if(i%2===0){doc.setFillColor(18,27,42);doc.rect(14,y-4,182,7,'F');}
        doc.setTextColor(220,230,245); doc.setFontSize(7.5);
        doc.text(sub.siteName.slice(0,28),17,y);
        doc.setTextColor(96,165,250);
        doc.text(sub.submittedTo.replace('https://','').slice(0,38),72,y);
        doc.setTextColor(148,163,184);
        doc.text(new Date(sub.date).toLocaleDateString(),145,y);
        doc.setTextColor(52,211,153); doc.text('Posted',177,y); y+=8;
      });
    }

    doc.setFontSize(7); doc.setTextColor(40,55,75);
    doc.text('Page 1 of 2  |  URLBoost Pro  |  urlboost-pro.vercel.app', W/2, 291, { align:'center' });

    // ── PAGE 2: Detailed Client Explanation ──────────────────────────────────
    doc.addPage();
    darkBg();

    doc.setFillColor(30,41,59); doc.rect(0,0,W,38,'F');
    doc.setFillColor(...scoreRgb); doc.rect(0,0,4,38,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(15);
    doc.text('Detailed SEO Explanation & Recommendations', 14, 13);
    doc.setFontSize(8); doc.setTextColor(148,163,184);
    doc.text(`Prepared for: ${hostname}   |   ${dateStr}`, 14, 22);
    doc.text('Plain-English explanation of each finding with actionable steps for your developer or team.', 14, 30);

    // Score summary box
    let p2y = 46;
    const interpTitle = sc>=70
      ? `Your site is performing well (${sc}/100) — keep it up!`
      : sc>=40
      ? `Your site needs attention (${sc}/100) — fixable issues found`
      : `Critical SEO problems found (${sc}/100) — immediate action needed`;
    const interpBody = sc>=70
      ? `A score of ${sc}/100 means the core SEO fundamentals are in good shape. Google and other search engines can read and index your page effectively. Your next priority should be the warnings listed below and building quality backlinks from reputable websites in your industry.`
      : sc>=40
      ? `A score of ${sc}/100 means the basics are partially in place, but gaps exist that are likely reducing your visibility in search results. The issues flagged below are straightforward to fix and addressing them could meaningfully improve how often your page appears when potential customers search online.`
      : `A score of ${sc}/100 means search engines are struggling to understand and index your page. This directly impacts whether your site appears in search results at all. Treat the critical issues below as urgent — they should be fixed within the next few days.`;

    const interpLines = wrap(interpBody, 165, 8);
    const interpH = 14 + interpLines.length * 5.5;
    doc.setFillColor(22,33,52); doc.roundedRect(14,p2y,182,interpH,3,3,'F');
    doc.setFillColor(...scoreRgb); doc.rect(14,p2y,3,interpH,'F');
    doc.setFontSize(9.5); doc.setTextColor(255,255,255);
    doc.text(interpTitle, 20, p2y+8);
    doc.setFontSize(8); doc.setTextColor(180,195,215);
    interpLines.forEach((line,i) => doc.text(line, 20, p2y+15+i*5.5));
    p2y += interpH + 8;

    doc.setFontSize(10); doc.setTextColor(255,255,255);
    doc.text('What Each Finding Means For Your Business', 14, p2y);
    doc.setDrawColor(40,55,75); doc.line(14,p2y+3,196,p2y+3);
    p2y += 10;

    const explanations: Record<string,{why:string; how:string; impact:string; goodNote:string}> = {
      'Title tag': {
        why: 'The title tag is the blue clickable headline shown in Google search results. It is the single most important on-page SEO element — Google uses it to understand what your page is about.',
        how: 'Write a unique title per page, 50-60 characters, with your primary keyword near the front. Example: "Affordable Web Design London — YourBrand".',
        impact: 'A missing or poor title can cut click-through rates by 30-50% and weaken rankings for your target keywords.',
        goodNote: 'Your title tag is well-optimised. It is the right length and will display correctly in Google search results without being cut off.',
      },
      'Meta description': {
        why: 'The meta description appears below your title in search results. Google does not use it for ranking but it directly influences whether a user clicks your result.',
        how: 'Write a 150-160 character summary with your main keyword and a clear reason to click. Think of it as a short advertisement for the page.',
        impact: 'A compelling meta description can increase click-through rates by 5-15%, bringing more visitors without extra ad spend.',
        goodNote: 'Your meta description is present and a good length. Users searching Google will see a relevant preview of your page before clicking.',
      },
      'H1 tag': {
        why: 'The H1 is your page\'s main headline. Search engines treat it as a strong signal of the page topic. Each page should have exactly one H1.',
        how: 'Add one H1 that clearly describes the page using your primary keyword. Use H2 and H3 for sub-sections.',
        impact: 'Missing or multiple H1 tags confuse search engines about your page topic, reducing rankings for target keywords.',
        goodNote: 'Your page has exactly one H1 tag — this is correct. Search engines can clearly identify the main topic of this page.',
      },
      'Images': {
        why: 'Image alt attributes are text descriptions that search engines read — they cannot see images. Alt text also supports visually impaired users using screen readers.',
        how: 'Add a concise, descriptive alt attribute to every image. Describe the image naturally and include a keyword where relevant — avoid keyword stuffing.',
        impact: 'Images without alt text are invisible to search engines, losing opportunities in Google Image Search and failing accessibility standards.',
        goodNote: 'All images on your page have alt text, or no images are present. Either way, this element is not causing any SEO issues.',
      },
      'Viewport': {
        why: 'The viewport meta tag tells mobile browsers how to scale your page. Without it, your site may appear zoomed out or broken on phones.',
        how: 'Add this inside your head tag: meta name="viewport" content="width=device-width, initial-scale=1". This is standard on all modern sites.',
        impact: 'Google ranks the mobile version of your site first. A missing viewport tag signals poor mobile experience and directly hurts rankings.',
        goodNote: 'Your viewport tag is correctly set. Your site signals mobile-friendliness to Google, which is a positive ranking factor.',
      },
      'Structured data': {
        why: 'Schema.org structured data tells search engines exactly what your content is — a business, product, article, event etc. This unlocks rich results with star ratings, prices, and more in Google.',
        how: 'Add a JSON-LD script block in your page head describing your content. Use Google\'s Structured Data Markup Helper tool as a starting point.',
        impact: 'Rich results can double the visual space your listing takes in search results, significantly increasing clicks.',
        goodNote: 'Structured data is detected on your page. This gives you eligibility for rich results in Google such as star ratings, FAQs, and product details.',
      },
      'Canonical': {
        why: 'A canonical tag tells search engines which URL is the definitive version of a page, preventing duplicate content issues when the same content is accessible at multiple URLs.',
        how: 'Add a link rel="canonical" tag in your page head pointing to the preferred URL including the correct protocol and trailing slash.',
        impact: 'Without a canonical tag, search engines may split your page authority across URL variants, reducing rankings for all of them.',
        goodNote: 'Your canonical tag is set correctly. Search engines know which URL to rank and your page authority is not being diluted by duplicate URL variants.',
      },
      'Open Graph': {
        why: 'Open Graph tags control how your page looks when shared on Facebook, LinkedIn, WhatsApp and Twitter — including the image, title, and description shown in the preview.',
        how: 'Add og:title, og:description, og:image (1200x630px), and og:url tags to your page head. WordPress and Webflow have plugins to do this automatically.',
        impact: 'Without Open Graph tags, social shares show a broken or generic preview, reducing trust and click-throughs from social media.',
        goodNote: 'Open Graph tags are present. When someone shares your page on social media, it will show an attractive preview with your chosen image and description.',
      },
    };

    seoData.issues.forEach(issue => {
      const key = Object.keys(explanations).find(k => issue.message.toLowerCase().includes(k.toLowerCase()));
      const exp = key ? explanations[key] : null;
      if (!exp) return;

      const col: [number,number,number] = issue.type==='good'?[52,211,153]:issue.type==='warning'?[251,191,36]:[248,113,113];
      const label = issue.type==='good'?'GOOD':issue.type==='warning'?'WARNING':'CRITICAL';
      const isGood = issue.type === 'good';

      // For good items show only goodNote; for others show why/how/impact
      const lines1 = wrap(isGood ? exp.goodNote : exp.why, 158, 7.5);
      const lines2 = isGood ? [] : wrap(exp.how, 158, 7.5);
      const lines3 = isGood ? [] : wrap(exp.impact, 158, 7.5);
      const sections = isGood ? 1 : 3;
      const textLines = lines1.length + lines2.length + lines3.length;
      const blockH = 12 + textLines*5.2 + sections*9 + (isGood ? 0 : 4);

      if (p2y + blockH > 280) {
        doc.addPage(); darkBg();
        doc.setFontSize(7); doc.setTextColor(40,55,75);
        doc.text(`${hostname}  |  URLBoost Pro  |  urlboost-pro.vercel.app`, W/2, 8, { align:'center' });
        p2y = 14;
      }

      doc.setFillColor(20,30,46); doc.roundedRect(14,p2y,182,blockH,3,3,'F');
      doc.setFillColor(...col); doc.rect(14,p2y,3,blockH,'F');

      // Title + badge
      doc.setFontSize(9); doc.setTextColor(255,255,255);
      doc.text(decode(issue.message).slice(0,85), 20, p2y+8);
      doc.setFillColor(...col); doc.roundedRect(168,p2y+2,24,9,2,2,'F');
      doc.setTextColor(15,23,42); doc.setFontSize(6.5);
      doc.text(label, 180, p2y+8, { align:'center' });

      let by = p2y + 15;

      if (isGood) {
        // Good items: just show a positive confirmation note
        doc.setFontSize(7); doc.setTextColor(...col); doc.text('WHAT THIS MEANS', 20, by); by += 5;
        doc.setTextColor(180,195,215); doc.setFontSize(7.5);
        lines1.forEach(line => { doc.text(line, 20, by); by += 5.2; });
      } else {
        // Warning/Critical: show Why / How to Fix / Business Impact
        doc.setFontSize(7); doc.setTextColor(...col); doc.text('WHY IT MATTERS', 20, by); by += 5;
        doc.setTextColor(180,195,215); doc.setFontSize(7.5);
        lines1.forEach(line => { doc.text(line, 20, by); by += 5.2; }); by += 4;

        doc.setFontSize(7); doc.setTextColor(...col); doc.text('HOW TO FIX IT', 20, by); by += 5;
        doc.setTextColor(180,195,215); doc.setFontSize(7.5);
        lines2.forEach(line => { doc.text(line, 20, by); by += 5.2; }); by += 4;

        doc.setFontSize(7); doc.setTextColor(...col); doc.text('BUSINESS IMPACT', 20, by); by += 5;
        doc.setTextColor(180,195,215); doc.setFontSize(7.5);
        lines3.forEach(line => { doc.text(line, 20, by); by += 5.2; });
      }

      p2y += blockH + 5;
    });

    // Recommended next steps
    if (p2y + 50 > 280) { doc.addPage(); darkBg(); p2y = 14; }
    p2y += 4;
    doc.setDrawColor(40,55,75); doc.line(14,p2y,196,p2y); p2y += 8;
    doc.setFontSize(10); doc.setTextColor(255,255,255);
    doc.text('Recommended Next Steps', 14, p2y); p2y += 8;

    const steps = [
      'Fix all CRITICAL issues first — these have the biggest impact on search visibility and should be resolved within 7 days.',
      'Address WARNING items next — most can be fixed in under an hour by your developer or through your CMS settings.',
      'Submit your sitemap to Google Search Console and Bing Webmaster Tools so search engines know where your pages are.',
      'Install Google Analytics 4 and Microsoft Clarity (both free) to track how visitors use your site after improvements.',
      'Re-run this analysis in 2-4 weeks to verify your score has improved and catch any new issues.',
    ];
    steps.forEach((text, idx) => {
      const lines = wrap(text, 163, 7.5);
      const h = lines.length*5.5 + 8;
      if (p2y + h > 280) { doc.addPage(); darkBg(); p2y = 14; }
      doc.setFillColor(22,33,52); doc.roundedRect(14,p2y,182,h,2,2,'F');
      doc.setFillColor(96,165,250); doc.circle(21,p2y+h/2,3.5,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(7); doc.text(String(idx+1), 21, p2y+h/2+2.5, { align:'center' });
      doc.setTextColor(180,195,215); doc.setFontSize(7.5);
      lines.forEach((line,i) => doc.text(line, 28, p2y+6+i*5.5));
      p2y += h + 4;
    });

    // Disclaimer
    p2y += 4;
    if (p2y + 18 > 280) { doc.addPage(); darkBg(); p2y = 14; }
    doc.setFillColor(18,26,40); doc.roundedRect(14,p2y,182,16,2,2,'F');
    doc.setFontSize(6.5); doc.setTextColor(80,100,130);
    const disc = 'Disclaimer: This report is based on static HTML analysis at the time of scanning. JavaScript-rendered content may not be fully captured. SEO results depend on many factors including competition, content quality, and backlinks. This report is a starting-point guide and not a substitute for a full professional SEO audit.';
    wrap(disc, 172, 6.5).forEach((line,i) => doc.text(line, 18, p2y+5+i*4.5));

    doc.setFontSize(7); doc.setTextColor(40,55,75);
    doc.text('Page 2 of 2  |  URLBoost Pro  |  urlboost-pro.vercel.app', W/2, 291, { align:'center' });

    doc.save(`URLBoost_${hostname}_${new Date().toISOString().slice(0,10)}.pdf`);
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
