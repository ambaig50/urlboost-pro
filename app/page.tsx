'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle, AlertCircle, Loader2, Download, Sun, Moon } from 'lucide-react';
import jsPDF from 'jspdf';

const freeSites = [
  { name: "Google Ping", url: "https://www.google.com/ping?sitemap=", category: "Search Engine" },
  { name: "Bing Webmasters", url: "https://www.bing.com/webmasters/submiturl", category: "Search Engine" },
  { name: "Yandex Webmaster", url: "https://webmaster.yandex.com/", category: "Search Engine" },
  { name: "Archive.org (Wayback)", url: "https://web.archive.org/save/", category: "Archive" },
  { name: "Viesearch", url: "https://viesearch.com/submit", category: "Directory" },
  { name: "Link Centre", url: "https://www.linkcentre.com/", category: "Directory" },
  { name: "ExactSeek", url: "https://www.exactseek.com/add.html", category: "Directory" },
  { name: "SonicRun", url: "https://www.sonicrun.com/freelisting.html", category: "Directory" },
  { name: "FreePRWebDirectory", url: "https://www.freeprwebdirectory.com/submit.php", category: "Directory" },
  { name: "Craigslist (Helper)", url: "#", category: "Classifieds", special: true },
];

export default function URLBoostPro() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [seoData, setSeoData] = useState<any>(null);
  const [step, setStep] = useState<'input' | 'analysis' | 'craigslist' | 'submit' | 'report'>('input');
  const [city, setCity] = useState('karachi');
  const [darkMode, setDarkMode] = useState(true);
  const [error, setError] = useState('');

  // Dark mode persistence
  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) setDarkMode(saved === 'true');
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  const analyze = async () => {
    if (!url.startsWith('http')) {
      setError('Please enter a valid URL starting with http/https');
      return;
    }

    setLoading(true);
    setError('');
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(p => Math.min(95, p + 8));
    }, 180);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) throw new Error('Failed to analyze');

      const data = await res.json();
      setSeoData(data);
      setProgress(100);
      setTimeout(() => setStep('analysis'), 400);
    } catch (err) {
      setError('Could not access the website. Make sure it is publicly accessible.');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const downloadReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("URLBoost Pro Report", 20, 25);
    doc.setFontSize(12);
    doc.text(`URL: ${seoData.url}`, 20, 45);
    doc.text(`SEO Score: ${seoData.score}/100`, 20, 55);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 65);

    doc.setFontSize(14);
    doc.text("Key Issues & Fixes:", 20, 85);
    seoData.issues.forEach((issue: any, i: number) => {
      doc.text(`${i+1}. ${issue.message}`, 20, 100 + i * 10);
    });

    doc.save(`URLBoost_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const openAllSites = () => {
    freeSites.forEach(site => {
      if (site.special) return;
      const finalUrl = site.url.includes('ping') || site.url.includes('save') 
        ? site.url + encodeURIComponent(url) 
        : site.url;
      window.open(finalUrl, '_blank');
    });
    setStep('report');
  };

  return (
    <div className="min-h-screen bg-gray-950 dark:bg-gray-950 text-white transition-colors">
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold">URLBoost Pro</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-3 bg-gray-800 rounded-full hover:bg-gray-700"
          >
            {darkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
        <p className="text-center text-gray-400 mb-12">SEO Analysis • Fixes • Free Submissions • Reports</p>

        {error && <p className="text-red-400 text-center mb-6">{error}</p>}

        {/* Input Step */}
        {step === 'input' && (
          <div className="bg-gray-900 rounded-3xl p-10">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full bg-black border border-gray-700 rounded-2xl px-6 py-5 text-lg focus:border-blue-500 outline-none"
            />
            <button
              onClick={analyze}
              disabled={loading || !url}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 py-5 rounded-2xl font-semibold text-lg disabled:opacity-60"
            >
              {loading ? "Analyzing..." : "Start SEO Analysis"}
            </button>
          </div>
        )}

        {/* Progress Bar */}
        {loading && (
          <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mt-6">
            <div className="bg-blue-600 h-2 transition-all duration-200" style={{ width: `${progress}%` }}></div>
          </div>
        )}

        {/* Analysis Step */}
        {step === 'analysis' && seoData && (
          <div className="bg-gray-900 rounded-3xl p-8">
            <div className="flex justify-between mb-8">
              <h2 className="text-3xl font-bold">SEO Analysis Results</h2>
              <div className="text-6xl font-bold text-emerald-400">{seoData.score}<span className="text-2xl">/100</span></div>
            </div>

            <div className="space-y-4">
              {seoData.issues.map((issue: any, i: number) => (
                <div key={i} className={`p-5 rounded-2xl flex gap-4 ${issue.type === 'good' ? 'bg-green-950/40' : 'bg-red-950/40'}`}>
                  {issue.type === 'good' ? <CheckCircle className="text-green-400" /> : <AlertCircle className="text-orange-400" />}
                  <div>
                    <p>{issue.message}</p>
                    {issue.fix && <p className="text-sm text-gray-400 mt-1">→ {issue.fix}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10">
              <button onClick={() => setStep('craigslist')} className="py-5 bg-orange-600 hover:bg-orange-700 rounded-2xl font-semibold">Craigslist Helper</button>
              <button onClick={() => setStep('submit')} className="py-5 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-semibold">Free Directory Submissions →</button>
            </div>
          </div>
        )}

        {/* Craigslist Helper */}
        {step === 'craigslist' && (
          <div className="bg-gray-900 rounded-3xl p-8">
            <h2 className="text-3xl font-bold mb-6">Craigslist Posting Helper</h2>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-black border border-gray-700 rounded-xl p-4 mb-6">
              <option value="karachi">Karachi</option>
              <option value="newyork">New York</option>
              <option value="losangeles">Los Angeles</option>
              <option value="chicago">Chicago</option>
              <option value="london">London</option>
            </select>

            <a href={`https://${city}.craigslist.org/post/`} target="_blank" className="block w-full text-center py-6 bg-orange-600 hover:bg-orange-700 rounded-2xl text-xl font-semibold">
              Open Craigslist Posting Page
            </a>

            <button onClick={() => setStep('submit')} className="mt-6 w-full py-4 border border-gray-600 rounded-2xl hover:bg-gray-800">Continue to Other Sites</button>
          </div>
        )}

        {/* Submissions */}
        {step === 'submit' && (
          <div className="bg-gray-900 rounded-3xl p-8">
            <h2 className="text-3xl font-bold mb-8">Free Submission Sites</h2>
            <button onClick={openAllSites} className="w-full py-6 bg-violet-600 hover:bg-violet-700 rounded-2xl text-xl font-bold mb-8">
              Open All Sites at Once
            </button>

            <div className="grid gap-4">
              {freeSites.map((site, i) => (
                <a key={i} href={site.url} target="_blank" className="block p-5 bg-gray-800 hover:bg-gray-700 rounded-2xl flex justify-between items-center">
                  <div>
                    <div className="font-medium">{site.name}</div>
                    <div className="text-sm text-gray-500">{site.category}</div>
                  </div>
                  <ArrowRight />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Report */}
        {step === 'report' && seoData && (
          <div className="bg-gray-900 rounded-3xl p-12 text-center">
            <CheckCircle className="w-24 h-24 mx-auto text-emerald-500 mb-6" />
            <h2 className="text-4xl font-bold mb-6">All Done!</h2>

            <button onClick={downloadReport} className="flex items-center gap-3 mx-auto bg-white text-black px-10 py-4 rounded-2xl font-semibold hover:bg-gray-200">
              <Download size={24} /> Download PDF Report
            </button>

            <div className="mt-12 max-w-md mx-auto text-left text-sm space-y-3">
              <p className="font-semibold">Next Steps:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-300">
                <li>Submit sitemap to Google Search Console</li>
                <li>Set up Google Analytics 4</li>
                <li>Use Microsoft Clarity for heatmaps</li>
                <li>Monitor rankings in 2–4 weeks</li>
              </ul>
            </div>

            <button onClick={() => window.location.reload()} className="mt-12 text-blue-400 underline">Analyze Another URL</button>
          </div>
        )}
      </div>
    </div>
  );
}
