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

    const decode = (str: string) =>
      str.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    const darkBg = () => { doc.setFillColor(15,23,42); doc.rect(0,0,W,297,'F'); };
    const wrap = (text: string, maxW: number, fs: number): string[] => {
      doc.setFontSize(fs); return doc.splitTextToSize(text, maxW) as string[];
    };
    // Extract just the check name from issue message e.g. "Title tag: ..." -> "Title tag"
    const checkName = (msg: string): string => {
      const decoded = decode(msg);
      // Known short names mapped from message content
      if (decoded.toLowerCase().includes('title tag')) return 'Title Tag';
      if (decoded.toLowerCase().includes('meta description')) return 'Meta Description';
      if (decoded.toLowerCase().includes('h1 tag')) return 'H1 Tag';
      if (decoded.toLowerCase().includes('image')) return 'Image Alt Text';
      if (decoded.toLowerCase().includes('viewport')) return 'Viewport Tag';
      if (decoded.toLowerCase().includes('structured data') || decoded.toLowerCase().includes('schema')) return 'Structured Data';
      if (decoded.toLowerCase().includes('canonical')) return 'Canonical URL';
      if (decoded.toLowerCase().includes('open graph')) return 'Open Graph';
      // Fallback: take text before first colon or first 22 chars
      const colon = decoded.indexOf(':');
      return colon > 0 ? decoded.slice(0, colon) : decoded.slice(0, 22);
    };

    const sc = seoData.score;
    const scoreRgb: [number,number,number] = sc>=70?[52,211,153]:sc>=40?[251,191,36]:[248,113,113];
    const hostname = new URL(seoData.url).hostname;
    const dateStr = new Date(seoData.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});

    // ═══════════════════════════════════════════════════
    // PAGE 1 — Score Card
    // ═══════════════════════════════════════════════════
    darkBg();

    // Header
    doc.setFillColor(30,41,59); doc.rect(0,0,W,42,'F');
    doc.setFillColor(...scoreRgb); doc.rect(0,0,4,42,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(17);
    doc.text('URLBoost Pro', 14, 14);
    doc.setFontSize(8.5); doc.setTextColor(148,163,184);
    doc.text('SEO Analysis & Submission Report', 14, 22);
    doc.text(`Website: ${hostname}`, 14, 30);
    doc.text(`Prepared: ${dateStr}`, 14, 37);

    // Score box
    doc.setFillColor(15,23,42); doc.roundedRect(148,5,52,32,5,5,'F');
    doc.setFontSize(26); doc.setTextColor(...scoreRgb);
    doc.text(`${sc}`, sc>=100?154:sc>=10?158:163, 26);
    doc.setFontSize(7.5); doc.setTextColor(148,163,184);
    doc.text('/ 100  SEO Score', 149, 33);

    // URL & title
    let y1 = 52;
    doc.setFontSize(7); doc.setTextColor(100,116,139); doc.text('ANALYZED URL', 14, y1);
    doc.setFontSize(9.5); doc.setTextColor(96,165,250);
    doc.text(seoData.url.slice(0,90), 14, y1+7);
    doc.setFontSize(7); doc.setTextColor(100,116,139); doc.text('PAGE TITLE', 14, y1+15);
    doc.setFontSize(9.5); doc.setTextColor(220,230,245);
    doc.text(decode(seoData.title||'No title found').slice(0,85), 14, y1+22);

    doc.setDrawColor(40,55,75); doc.setLineWidth(0.4); doc.line(14,y1+28,196,y1+28);

    // Stat boxes
    const stats = [
      {label:'H1 Tags',    value:String(seoData.h1Count),    good:seoData.h1Count===1},
      {label:'H2 Tags',    value:String(seoData.h2Count),    good:seoData.h2Count>0},
      {label:'Missing Alt',value:String(seoData.missingAlt), good:seoData.missingAlt===0},
      {label:'Schema.org', value:seoData.hasSchema?'Yes':'No',good:seoData.hasSchema},
    ];
    stats.forEach((s,i) => {
      const x = 14+i*46;
      doc.setFillColor(22,33,52); doc.roundedRect(x,y1+33,42,19,3,3,'F');
      const col:[number,number,number] = s.good?[52,211,153]:[248,113,113];
      doc.setFontSize(12); doc.setTextColor(...col);
      doc.text(s.value, x+21, y1+44, {align:'center'});
      doc.setFontSize(6.5); doc.setTextColor(100,116,139);
      doc.text(s.label, x+21, y1+50, {align:'center'});
    });

    // SEO Findings
    let y = y1+60;
    doc.setFontSize(10); doc.setTextColor(255,255,255); doc.text('SEO Findings', 14, y);
    doc.setDrawColor(40,55,75); doc.line(14,y+3,196,y+3); y+=10;

    seoData.issues.forEach(issue => {
      const col:[number,number,number] = issue.type==='good'?[52,211,153]:issue.type==='warning'?[251,191,36]:[248,113,113];
      const bgCol:[number,number,number] = issue.type==='good'?[12,40,28]:issue.type==='warning'?[40,30,10]:[40,12,12];
      const hasFix = issue.fix && issue.type!=='good';
      const rowH = hasFix ? 19 : 11;
      doc.setFillColor(...bgCol); doc.roundedRect(14,y-3,182,rowH,2,2,'F');
      doc.setFillColor(...col); doc.rect(14,y-3,3,rowH,'F');
      const statusLabel = issue.type==='good'?'GOOD':issue.type==='warning'?'WARN':'CRIT';
      doc.setFillColor(...col); doc.roundedRect(178,y-1,14,7,1,1,'F');
      doc.setTextColor(15,23,42); doc.setFontSize(5.5);
      doc.text(statusLabel, 185, y+4, {align:'center'});
      doc.setTextColor(220,230,245); doc.setFontSize(8);
      doc.text(decode(issue.message).slice(0,84), 20, y+4);
      y += 8;
      if (hasFix) {
        doc.setTextColor(148,163,184); doc.setFontSize(7);
        doc.text('Fix: '+issue.fix.slice(0,100), 20, y+2);
        y += 8;
      }
      y += 2;
    });

    // Submissions
    const subs = submissions.filter(r=>r.submittedUrl===seoData.url);
    if (subs.length>0 && y<252) {
      y+=3; doc.setDrawColor(40,55,75); doc.line(14,y,196,y); y+=7;
      doc.setFontSize(10); doc.setTextColor(255,255,255);
      doc.text(`Directory Submissions (${subs.length})`, 14, y); y+=8;
      doc.setFillColor(22,33,52); doc.rect(14,y-4,182,7,'F');
      doc.setFontSize(6.5); doc.setTextColor(100,116,139);
      doc.text('Site',17,y); doc.text('URL',72,y); doc.text('Date',148,y); doc.text('Status',178,y); y+=7;
      subs.forEach((sub,i)=>{
        if(i%2===0){doc.setFillColor(18,27,42);doc.rect(14,y-4,182,7,'F');}
        doc.setTextColor(220,230,245); doc.setFontSize(7);
        doc.text(sub.siteName.slice(0,28),17,y);
        doc.setTextColor(96,165,250); doc.text(sub.submittedTo.replace('https://','').slice(0,38),72,y);
        doc.setTextColor(148,163,184); doc.text(new Date(sub.date).toLocaleDateString(),148,y);
        doc.setTextColor(52,211,153); doc.text('Posted',178,y); y+=7;
      });
    }

    doc.setFontSize(6.5); doc.setTextColor(40,55,75);
    doc.text('Page 1 of 2  |  URLBoost Pro  |  urlboost-pro.vercel.app', W/2, 291, {align:'center'});

    // ═══════════════════════════════════════════════════
    // PAGE 2 — Client Explanation
    // ═══════════════════════════════════════════════════
    doc.addPage(); darkBg();

    // Header
    doc.setFillColor(30,41,59); doc.rect(0,0,W,32,'F');
    doc.setFillColor(...scoreRgb); doc.rect(0,0,4,32,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(12);
    doc.text('Detailed SEO Explanation & Recommendations', 14, 11);
    doc.setFontSize(7); doc.setTextColor(148,163,184);
    doc.text(`Prepared for: ${hostname}  |  ${dateStr}`, 14, 19);
    doc.text('Plain-English explanation of each finding with actionable next steps.', 14, 26);

    // Score summary
    let p2y = 38;
    const interpTitle = sc>=70
      ? `Your site is performing well (${sc}/100) — keep it up!`
      : sc>=40 ? `Your site needs attention (${sc}/100) — fixable issues found`
      : `Critical SEO problems (${sc}/100) — immediate action needed`;
    const interpBody = sc>=70
      ? `A score of ${sc}/100 means core SEO fundamentals are in good shape. Search engines can read and index your page effectively. Focus on the warnings below and build quality backlinks from reputable websites.`
      : sc>=40
      ? `A score of ${sc}/100 means the basics are partially covered but gaps exist that reduce your search visibility. The flagged issues are straightforward to fix and could meaningfully improve how often your page appears in search results.`
      : `A score of ${sc}/100 means search engines are struggling to index your page. This directly impacts whether your site appears in search results at all. The critical issues below should be fixed within the next few days.`;

    const interpLines = wrap(interpBody, 163, 7);
    const interpH = 10 + interpLines.length*4.5;
    doc.setFillColor(22,33,52); doc.roundedRect(14,p2y,182,interpH,2,2,'F');
    doc.setFillColor(...scoreRgb); doc.rect(14,p2y,3,interpH,'F');
    doc.setFontSize(8); doc.setTextColor(255,255,255);
    doc.text(interpTitle, 20, p2y+6);
    doc.setFontSize(7); doc.setTextColor(180,195,215);
    interpLines.forEach((line,i) => doc.text(line, 20, p2y+12+i*4.5));
    p2y += interpH+6;

    doc.setFontSize(8.5); doc.setTextColor(255,255,255);
    doc.text('What Each Finding Means For Your Business', 14, p2y);
    doc.setDrawColor(40,55,75); doc.line(14,p2y+3,196,p2y+3); p2y+=8;

    const explanations: Record<string,{why:string;how:string;impact:string;goodNote:string}> = {
      'Title tag':{
        goodNote:'Title tag is well-optimised and the right length. It will display correctly in Google results without being cut off.',
        why:'The title tag is the blue clickable headline in Google results — the most important on-page SEO element.',
        how:'Write a unique title per page, 50-60 chars, with your primary keyword near the front.',
        impact:'A poor title cuts click-through rates by 30-50% and weakens rankings for target keywords.',
      },
      'Meta description':{
        goodNote:'Meta description is present and a good length. Google will show users a relevant preview before they click.',
        why:'The meta description appears below your title in results and directly influences whether users click.',
        how:'Write 150-160 characters with your main keyword and a clear reason to click.',
        impact:'A compelling description can increase click-through rates by 5-15% with no extra ad spend.',
      },
      'H1 tag':{
        goodNote:"Page has exactly one H1 tag — correct. Search engines can clearly identify this page's main topic.",
        why:'The H1 is the main headline. Each page should have exactly one so search engines understand the topic.',
        how:'Add one H1 with your primary keyword. Use H2 and H3 for sub-sections to create a clear hierarchy.',
        impact:'Missing or multiple H1 tags confuse search engines and reduce keyword rankings.',
      },
      'Images':{
        goodNote:'All images have alt text or no images are present. No SEO issues with image accessibility.',
        why:'Image alt text is read by search engines since they cannot see images, and supports screen reader users.',
        how:'Add short descriptive alt attributes to every image including a keyword where natural.',
        impact:'Missing alt text means search engines skip your images, losing Google Image Search visibility.',
      },
      'Viewport':{
        goodNote:'Viewport tag is correctly set, signalling mobile-friendliness to Google — a direct ranking factor.',
        why:'The viewport tag tells mobile browsers how to scale your page. Without it, it may appear broken on phones.',
        how:'Add: meta name="viewport" content="width=device-width, initial-scale=1" inside your head tag.',
        impact:'Google ranks the mobile version first. A missing viewport tag directly hurts your rankings.',
      },
      'Structured data':{
        goodNote:'Schema.org structured data detected. Your page is eligible for rich results in Google like star ratings and FAQs.',
        why:'Schema.org data tells search engines what your content is — product, business, article — enabling rich results.',
        how:"Add a JSON-LD block in your head. Use Google's Structured Data Markup Helper as a starting point.",
        impact:'Rich results can double your search listing size and significantly increase click-through rates.',
      },
      'Canonical':{
        goodNote:'Canonical tag is set correctly. Search engines know which URL to rank and authority is not being diluted.',
        why:'A canonical tag tells search engines which URL is definitive, preventing duplicate content issues.',
        how:'Add link rel="canonical" in your page head pointing to the preferred URL with correct protocol.',
        impact:'Without it, authority may be split across URL variants, reducing rankings across all of them.',
      },
      'Open Graph':{
        goodNote:'Open Graph tags are present. Your page will show an attractive preview when shared on social media.',
        why:'Open Graph controls how your page looks when shared on Facebook, LinkedIn, WhatsApp and Twitter.',
        how:'Add og:title, og:description, og:image (1200x630px), and og:url to your page head.',
        impact:'Without these tags, social shares show a broken preview, reducing trust and click-throughs.',
      },
    };

    // GOOD items — 2-column grid showing SHORT name + note only
    const goodIssues = seoData.issues.filter(i=>i.type==='good');
    const actionIssues = seoData.issues.filter(i=>i.type!=='good');

    if (goodIssues.length > 0) {
      doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.text('PASSING CHECKS', 14, p2y); p2y+=4;
      const colW = 89; const gap = 4;
      let col0y = p2y; let col1y = p2y; let colIdx = 0;

      goodIssues.forEach(issue => {
        const key = Object.keys(explanations).find(k=>issue.message.toLowerCase().includes(k.toLowerCase()));
        const exp = key ? explanations[key] : null;
        const noteText = exp?.goodNote || decode(issue.message);
        const shortName = checkName(issue.message); // e.g. "Title Tag"
        const noteLines = wrap(noteText, 80, 6.5);
        const cardH = 9 + noteLines.length*4;
        const cx = colIdx===0 ? 14 : 14+colW+gap;
        const cy = colIdx===0 ? col0y : col1y;

        doc.setFillColor(12,40,28); doc.roundedRect(cx,cy,colW,cardH,2,2,'F');
        doc.setFillColor(52,211,153); doc.rect(cx,cy,2,cardH,'F');
        // Short name as heading
        doc.setFontSize(7); doc.setTextColor(52,211,153);
        doc.text(shortName, cx+5, cy+6);
        // Note text
        doc.setTextColor(160,185,165); doc.setFontSize(6.5);
        noteLines.forEach((line,i)=>doc.text(line, cx+5, cy+11+i*4));

        if (colIdx===0) { col0y+=cardH+3; colIdx=1; }
        else { col1y+=cardH+3; colIdx=0; }
      });
      p2y = Math.max(col0y,col1y)+3;
    }

    // WARNING/CRITICAL items — full width
    if (actionIssues.length > 0) {
      doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.text('ITEMS NEEDING ATTENTION', 14, p2y); p2y+=4;

      actionIssues.forEach(issue => {
        const key = Object.keys(explanations).find(k=>issue.message.toLowerCase().includes(k.toLowerCase()));
        const exp = key ? explanations[key] : null;
        if (!exp) return;

        const col:[number,number,number] = issue.type==='warning'?[251,191,36]:[248,113,113];
        const label = issue.type==='warning'?'WARNING':'CRITICAL';

        const whyL = wrap(exp.why, 155, 7);
        const howL = wrap(exp.how, 155, 7);
        const impL = wrap(exp.impact, 155, 7);
        const blockH = 10+(whyL.length+howL.length+impL.length)*4.5+18;

        doc.setFillColor(30,20,12); doc.roundedRect(14,p2y,182,blockH,2,2,'F');
        doc.setFillColor(...col); doc.rect(14,p2y,3,blockH,'F');
        doc.setFontSize(8); doc.setTextColor(255,255,255);
        // Use short check name as heading
        doc.text(checkName(issue.message), 20, p2y+7);
        doc.setFontSize(6.5); doc.setTextColor(148,163,184);
        doc.text(decode(issue.message).slice(0,75), 20, p2y+13);
        doc.setFillColor(...col); doc.roundedRect(167,p2y+1.5,23,8,2,2,'F');
        doc.setTextColor(15,23,42); doc.setFontSize(6);
        doc.text(label, 178.5, p2y+7, {align:'center'});

        let by = p2y+18;
        doc.setFontSize(6); doc.setTextColor(...col); doc.text('WHY IT MATTERS', 20, by); by+=4;
        doc.setTextColor(180,195,215); doc.setFontSize(7);
        whyL.forEach(l=>{doc.text(l,20,by);by+=4.5;}); by+=2;

        doc.setFontSize(6); doc.setTextColor(...col); doc.text('HOW TO FIX IT', 20, by); by+=4;
        doc.setTextColor(180,195,215); doc.setFontSize(7);
        howL.forEach(l=>{doc.text(l,20,by);by+=4.5;}); by+=2;

        doc.setFontSize(6); doc.setTextColor(...col); doc.text('BUSINESS IMPACT', 20, by); by+=4;
        doc.setTextColor(180,195,215); doc.setFontSize(7);
        impL.forEach(l=>{doc.text(l,20,by);by+=4.5;});

        p2y += blockH+4;
      });
    }

    // Next steps
    p2y+=2;
    doc.setDrawColor(40,55,75); doc.line(14,p2y,196,p2y); p2y+=5;
    doc.setFontSize(8.5); doc.setTextColor(255,255,255); doc.text('Recommended Next Steps', 14, p2y); p2y+=5;
    const steps = [
      '1. Fix CRITICAL issues within 7 days — biggest impact on search visibility.',
      '2. Address WARNING items next — most take under an hour with a developer or CMS.',
      '3. Submit your sitemap to Google Search Console and Bing Webmaster Tools.',
      '4. Install Google Analytics 4 and Microsoft Clarity (free) to track visitor behaviour.',
      '5. Re-run this analysis in 2-4 weeks to verify improvement and catch new issues.',
    ];
    const stepsH = steps.length*5.8+6;
    doc.setFillColor(20,30,46); doc.roundedRect(14,p2y,182,stepsH,2,2,'F');
    doc.setFontSize(7); doc.setTextColor(180,195,215);
    steps.forEach((step,i) => doc.text(step, 18, p2y+5+i*5.8));
    p2y += stepsH+4;

    // Pre-calculate disclaimer so it never overlaps steps
    const discText = 'Disclaimer: Based on static HTML analysis at time of scanning. JavaScript-rendered content may not be captured. SEO results depend on competition, content quality, and backlinks. This is a starting-point guide, not a substitute for a full professional SEO audit.';
    const discLines = wrap(discText, 172, 6);
    const discH = discLines.length*4+8;
    // Ensure minimum 5pt gap — nudge p2y down if too close to bottom
    if (p2y + discH + 10 > 284) p2y = 284 - discH - 10;
    // Draw separator line between steps and disclaimer
    doc.setDrawColor(30,42,60); doc.line(14, p2y, 196, p2y); p2y += 4;
    doc.setFillColor(18,26,40); doc.roundedRect(14,p2y,182,discH,2,2,'F');
    doc.setFontSize(6); doc.setTextColor(80,100,130);
    discLines.forEach((line,i)=>doc.text(line,18,p2y+5+i*4));

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
