import { NextRequest, NextResponse } from 'next/server';

export interface AuditResult {
  url: string; timestamp: string;
  executive: { score: number; grade: string; majorIssues: string[]; priorityFixes: string[] };
  technical: { isHttps: boolean; hasCanonical: boolean; canonicalUrl: string; hasRobotsMeta: boolean; robotsContent: string; hasSitemap: boolean; sitemapUrl: string; hasViewport: boolean; hasCharset: boolean; hasLangAttr: boolean; langAttr: string; finalUrl: string; statusCode: number; hasHreflang: boolean };
  onPage: { title: string; titleLength: number; titleScore: 'good'|'warning'|'critical'; metaDesc: string; metaDescLength: number; metaDescScore: 'good'|'warning'|'critical'; h1Count: number; h1Text: string[]; h2Count: number; h2Text: string[]; h3Count: number; totalImages: number; imagesWithAlt: number; imagesMissingAlt: number; hasOpenGraph: boolean; ogTitle: string; ogDesc: string; ogImage: string; hasTwitterCard: boolean; hasSchema: boolean; schemaTypes: string[]; wordCount: number; isThinContent: boolean; internalLinks: number; externalLinks: number };
  performance: { available: boolean; performanceScore: number; lcp: number; lcpRating: string; cls: number; clsRating: string; fid: number; fidRating: string; fcp: number; fcpRating: string; ttfb: number; ttfbRating: string; speedIndex: number; totalBlockingTime: number; opportunities: string[]; diagnostics: string[] };
  mobile: { available: boolean; mobileScore: number; hasViewport: boolean; tapTargets: string; fontSizes: string; contentWidth: string };
  internalLinking: { totalInternalLinks: number; uniqueInternalLinks: string[]; hasNavigationLinks: boolean; hasBreadcrumbs: boolean; hasFooterLinks: boolean };
  localSeo: { hasAddress: boolean; hasPhone: boolean; hasEmail: boolean; hasMap: boolean; hasBusinessHours: boolean };
  issues: { critical: { item: string; detail: string; fix: string }[]; warnings: { item: string; detail: string; fix: string }[]; passed: { item: string; detail: string }[] };
}

async function fetchPageSpeed(url: string, strategy: 'mobile'|'desktop') {
  try {
    const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&category=seo`, { cache:'no-store', signal: AbortSignal.timeout(25000) });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error:'Invalid request.' }, { status:400 }); }
  const { url } = body;
  if (!url) return NextResponse.json({ error:'URL required.' }, { status:400 });
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); if (!['http:','https:'].includes(parsedUrl.protocol)) throw new Error(); }
  catch { return NextResponse.json({ error:'Invalid URL.' }, { status:400 }); }

  let html='', finalUrl=url, statusCode=0;
  try {
    const ctrl = new AbortController(); const timer = setTimeout(()=>ctrl.abort(),12000);
    const res = await fetch(parsedUrl.toString(), { headers:{'User-Agent':'Mozilla/5.0 (compatible; URLBoostAudit/1.0)'}, cache:'no-store', signal:ctrl.signal, redirect:'follow' });
    clearTimeout(timer); statusCode=res.status; finalUrl=res.url; html=await res.text();
  } catch { return NextResponse.json({ error:'Could not fetch URL. Make sure it is publicly accessible.' }, { status:400 }); }

  const [psdD, psdM] = await Promise.allSettled([fetchPageSpeed(finalUrl,'desktop'), fetchPageSpeed(finalUrl,'mobile')]);
  const psD = psdD.status==='fulfilled' ? psdD.value : null;
  const psM = psdM.status==='fulfilled' ? psdM.value : null;

  const attr = (p: RegExp) => html.match(p)?.[1]?.trim() ?? '';
  const has  = (p: RegExp) => p.test(html);
  const tagList = (t: string) => html.match(new RegExp(`<${t}[\\s>][\\s\\S]*?<\\/${t}>`, 'gi')) ?? [];

  const title    = attr(/<title[^>]*>([\s\S]*?)<\/title>/i).replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  const metaDesc = attr(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i) || attr(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/i);
  const canonical= attr(/<link[^>]*rel=["']canonical["'][^>]*href=["'](.*?)["']/i) || attr(/<link[^>]*href=["'](.*?)["'][^>]*rel=["']canonical["']/i);
  const langAttr = attr(/<html[^>]*lang=["'](.*?)["']/i);
  const robotsMeta=attr(/<meta[^>]*name=["']robots["'][^>]*content=["'](.*?)["']/i);
  const ogTitle  = attr(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i);
  const ogDesc   = attr(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i);
  const ogImage  = attr(/<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["']/i);

  const h1Tags = tagList('h1').map(t=>t.replace(/<[^>]+>/g,'').trim()).filter(Boolean);
  const h2Tags = tagList('h2').map(t=>t.replace(/<[^>]+>/g,'').trim()).filter(Boolean);
  const h3Tags = tagList('h3');
  const imgs   = html.match(/<img[^>]*>/gi) ?? [];
  const imgsMissingAlt = imgs.filter(i=>!/alt=["'][^"']+["']/i.test(i)).length;

  const allLinks = html.match(/href=["'](.*?)["']/gi) ?? [];
  const hn = parsedUrl.hostname;
  const internalLinks = allLinks.filter(l=>l.includes(hn)||/href=["']\/(?!\/)/.test(l)).length;
  const externalLinks = allLinks.filter(l=>!l.includes(hn)&&/href=["']https?:/i.test(l)).length;
  const uniqueInternal = [...new Set(allLinks.filter(l=>l.includes(hn)||/href=["']\/(?!\/)/.test(l)).map(l=>l.replace(/href=["']/,'').replace(/["']/,'').trim()).filter(l=>l&&!l.startsWith('#')&&!l.startsWith('mailto:')))].slice(0,15);

  const schemaTypes = [...new Set((html.match(/"@type"\s*:\s*"([^"]+)"/g)??[]).map(m=>m.match(/"([^"]+)"\s*$/)?.[1]??'').filter(Boolean))];
  const wordCount = html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(w=>w.length>2).length;

  let hasSitemap=false, sitemapUrl='';
  try { const rb=await(await fetch(`${parsedUrl.origin}/robots.txt`,{signal:AbortSignal.timeout(5000),cache:'no-store'})).text(); const sm=rb.match(/Sitemap:\s*(https?:\/\/\S+)/i); if(sm){hasSitemap=true;sitemapUrl=sm[1];} } catch{}
  if(!hasSitemap){ for(const p of['/sitemap.xml','/sitemap_index.xml']){ try{ const sr=await fetch(`${parsedUrl.origin}${p}`,{signal:AbortSignal.timeout(4000),cache:'no-store'}); if(sr.ok){hasSitemap=true;sitemapUrl=`${parsedUrl.origin}${p}`;break;} }catch{} } }

  const perfOK = !!psD?.lighthouseResult;
  let perfScore=0,lcp=0,cls=0,fid=0,fcp=0,ttfb=0,si=0,tbt=0; const opps:string[]=[],diags:string[]=[];
  if(perfOK){ const m=psD.lighthouseResult.audits??{}; perfScore=Math.round((psD.lighthouseResult.categories?.performance?.score??0)*100); lcp=m['largest-contentful-paint']?.numericValue??0; cls=m['cumulative-layout-shift']?.numericValue??0; fid=m['max-potential-fid']?.numericValue??0; fcp=m['first-contentful-paint']?.numericValue??0; ttfb=m['server-response-time']?.numericValue??0; si=m['speed-index']?.numericValue??0; tbt=m['total-blocking-time']?.numericValue??0; ['render-blocking-resources','uses-optimized-images','uses-webp-images','unused-css-rules','unused-javascript','uses-text-compression'].forEach(k=>{if((m[k]?.score??1)<0.9&&m[k]?.title)opps.push(m[k].title);}); ['uses-long-cache-ttl','dom-size','bootup-time','mainthread-work-breakdown'].forEach(k=>{if((m[k]?.score??1)<0.9&&m[k]?.title)diags.push(m[k].title);}); }

  const mobOK=!!psM?.lighthouseResult; let mobScore=0,tapT='N/A',fontS='N/A',conW='N/A';
  if(mobOK){ const ml=psM.lighthouseResult; mobScore=Math.round((ml.categories?.performance?.score??0)*100); const ma=ml.audits??{}; tapT=ma['tap-targets']?.score===1?'Pass':ma['tap-targets']?.displayValue??'Issues found'; fontS=ma['font-size']?.score===1?'Pass':ma['font-size']?.displayValue??'Issues found'; conW=ma['content-width']?.score===1?'Pass':ma['content-width']?.displayValue??'Issues found'; }

  const issues={critical:[] as {item:string;detail:string;fix:string}[], warnings:[] as {item:string;detail:string;fix:string}[], passed:[] as {item:string;detail:string}[]};
  const chk=(pass:boolean,pi:string,pd:string,fi:string,fd:string,ff:string,sev:'critical'|'warnings'='warnings')=>{ if(pass) issues.passed.push({item:pi,detail:pd}); else issues[sev].push({item:fi,detail:fd,fix:ff}); };

  chk(!!title,'Title tag present',`"${title.slice(0,55)}" (${title.length} chars)`,'Missing title tag','No <title> tag found.','Add a descriptive <title> of 50-60 characters.','critical');
  chk(title.length>=10&&title.length<=60,'Title length optimal',`${title.length} chars — ideal range`,'Title length issue',`${title.length} chars — ${title.length>60?'over 60':'under 10'}.`,title.length>60?'Shorten to under 60 chars.':'Expand to 50-60 chars.');
  chk(metaDesc.length>=50&&metaDesc.length<=160,'Meta description optimal',`${metaDesc.length} chars`,metaDesc?'Meta description length':'Missing meta description',metaDesc?`${metaDesc.length} chars.`:'No meta description.','Write 150-160 char meta description.');
  chk(h1Tags.length===1,'Single H1 tag',`"${(h1Tags[0]??'').slice(0,40)}"`, 'H1 tag issue', h1Tags.length===0?'No H1 found.':`${h1Tags.length} H1 tags — should be 1.`,'Use exactly one H1 per page.',h1Tags.length===0?'critical':'warnings');
  chk(parsedUrl.protocol==='https:','HTTPS enabled','Secure HTTPS.','Not HTTPS','Site uses insecure HTTP.','Install SSL certificate.','critical');
  chk(!!canonical,'Canonical tag present',canonical.slice(0,55)||'Set.','Missing canonical tag','No canonical URL tag.','Add <link rel="canonical">.','warnings');
  chk(has(/name=["']viewport["']/i),'Viewport tag present','Mobile-friendly.','Missing viewport','No viewport meta tag.','Add viewport meta tag.','critical');
  chk(imgsMissingAlt===0,'All images have alt text',`${imgs.length} images — all have alt.`,'Images missing alt',`${imgsMissingAlt}/${imgs.length} images missing alt.`,`Add alt text to ${imgsMissingAlt} images.`,imgsMissingAlt>3?'critical':'warnings');
  chk(has(/application\/ld\+json|schema\.org/i),'Structured data present',schemaTypes.join(', ')||'Detected.','No structured data','No Schema.org markup.','Add JSON-LD structured data.','warnings');
  chk(has(/<meta[^>]*property=["']og:/i),'Open Graph tags present','og:title, og:description detected.','No Open Graph tags','No OG meta tags.','Add og:title, og:description, og:image, og:url.','warnings');
  chk(hasSitemap,'XML sitemap found',sitemapUrl||'Found.','No XML sitemap','No sitemap.xml detected.','Create and submit sitemap.xml.','warnings');
  chk(wordCount>=300,'Sufficient content',`${wordCount} words.`,'Thin content',`Only ${wordCount} words — aim for 300+.`,'Add more content to this page.',wordCount<100?'critical':'warnings');
  chk(!!langAttr,'Language attribute set',`lang="${langAttr}"`,'Missing lang attribute','No lang on <html>.','Add lang="en" to <html> tag.','warnings');
  chk(has(/name=["']twitter:card["']/i),'Twitter Card tags present','Twitter meta tags found.','No Twitter Card tags','No Twitter Card tags.','Add twitter:card, twitter:title, twitter:description.','warnings');
  chk(!!has(/<nav[\s>]/i),'Navigation element present','<nav> found.','No nav element','No <nav> element.','Use <nav> for main navigation.','warnings');
  if(perfOK){ chk(lcp<=2500,'LCP is good',`${(lcp/1000).toFixed(2)}s`,'LCP needs improvement',`${(lcp/1000).toFixed(2)}s — aim under 2.5s.`,'Optimise largest element.',lcp>4000?'critical':'warnings'); chk(cls<=0.1,'CLS is good',`${cls.toFixed(3)}`,'CLS needs improvement',`${cls.toFixed(3)} — aim under 0.1.`,'Set explicit width/height on media.',cls>0.25?'critical':'warnings'); chk(ttfb<=800,'TTFB is good',`${Math.round(ttfb)}ms`,'Slow server response',`${Math.round(ttfb)}ms — aim under 800ms.`,'Use a CDN or optimise server.',ttfb>1800?'critical':'warnings'); chk(tbt<=200,'Low blocking time',`${Math.round(tbt)}ms`,'High blocking time',`${Math.round(tbt)}ms — aim under 200ms.`,'Reduce JavaScript execution time.',tbt>600?'critical':'warnings'); }

  const tot=issues.critical.length+issues.warnings.length+issues.passed.length;
  const raw=((issues.passed.length+issues.warnings.length*0.5)/Math.max(tot,1))*100;
  const overallScore=Math.min(100,Math.round(raw*0.9+(perfOK?(perfScore/100)*10:0)));
  const grade=overallScore>=80?'A':overallScore>=65?'B':overallScore>=50?'C':overallScore>=35?'D':'F';

  return NextResponse.json({ url:finalUrl, timestamp:new Date().toISOString(),
    executive:{ score:overallScore, grade, majorIssues:issues.critical.map(i=>i.item).slice(0,5), priorityFixes:[...issues.critical,...issues.warnings].map(i=>i.fix).slice(0,6) },
    technical:{ isHttps:parsedUrl.protocol==='https:', hasCanonical:!!canonical, canonicalUrl:canonical, hasRobotsMeta:!!robotsMeta, robotsContent:robotsMeta, hasSitemap, sitemapUrl, hasViewport:has(/name=["']viewport["']/i), hasCharset:has(/charset=/i), hasLangAttr:!!langAttr, langAttr, finalUrl, statusCode, hasHreflang:has(/rel=["']alternate["'][^>]*hreflang/i) },
    onPage:{ title, titleLength:title.length, titleScore:!title?'critical':title.length<10||title.length>60?'warning':'good', metaDesc, metaDescLength:metaDesc.length, metaDescScore:!metaDesc?'warning':metaDesc.length<50||metaDesc.length>160?'warning':'good', h1Count:h1Tags.length, h1Text:h1Tags.slice(0,3), h2Count:h2Tags.length, h2Text:h2Tags.slice(0,5), h3Count:h3Tags.length, totalImages:imgs.length, imagesWithAlt:imgs.length-imgsMissingAlt, imagesMissingAlt:imgsMissingAlt, hasOpenGraph:has(/<meta[^>]*property=["']og:/i), ogTitle, ogDesc, ogImage, hasTwitterCard:has(/name=["']twitter:card["']/i), hasSchema:has(/application\/ld\+json|schema\.org/i), schemaTypes, wordCount, isThinContent:wordCount<300, internalLinks, externalLinks },
    performance:{ available:perfOK, performanceScore:perfScore, lcp:Math.round(lcp), lcpRating:lcp<=2500?'Good':lcp<=4000?'Needs Improvement':'Poor', cls:parseFloat(cls.toFixed(3)), clsRating:cls<=0.1?'Good':cls<=0.25?'Needs Improvement':'Poor', fid:Math.round(fid), fidRating:fid<=100?'Good':fid<=300?'Needs Improvement':'Poor', fcp:Math.round(fcp), fcpRating:fcp<=1800?'Good':fcp<=3000?'Needs Improvement':'Poor', ttfb:Math.round(ttfb), ttfbRating:ttfb<=800?'Good':ttfb<=1800?'Needs Improvement':'Poor', speedIndex:Math.round(si), totalBlockingTime:Math.round(tbt), opportunities:opps, diagnostics:diags },
    mobile:{ available:mobOK, mobileScore:mobScore, hasViewport:has(/name=["']viewport["']/i), tapTargets:tapT, fontSizes:fontS, contentWidth:conW },
    internalLinking:{ totalInternalLinks:internalLinks, uniqueInternalLinks:uniqueInternal, hasNavigationLinks:has(/<nav[\s>]/i), hasBreadcrumbs:has(/breadcrumb/i), hasFooterLinks:has(/<footer[\s>]/i) },
    localSeo:{ hasAddress:has(/street|avenue|road|suite|city|state|zip|postal/i), hasPhone:has(/<tel:|phone|tel\s*:/i), hasEmail:has(/mailto:|contact.*@/i), hasMap:has(/maps\.google|google\.com\/maps|maps\.apple/i), hasBusinessHours:has(/hours|mon.*fri|monday|opening.time/i) },
    issues,
  } as AuditResult);
}
