import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'URLBoostPro/1.0' },
      cache: 'no-store'
    });

    if (!response.ok) throw new Error('Failed to fetch');

    const html = await response.text();

    // Enhanced SEO Analysis
    const title = html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim() || '';
    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)?.[1] || '';
    const h1 = (html.match(/<h1/gi) || []).length;
    const h2 = (html.match(/<h2/gi) || []).length;
    const images = html.match(/<img[^>]*>/gi) || [];
    const missingAlt = images.filter(img => !/alt=["'][^"']*["']/i.test(img)).length;
    const hasSchema = html.includes('schema.org') || html.includes('application/ld+json');

    let score = 45;
    score += title.length > 10 && title.length < 60 ? 20 : 0;
    score += metaDesc.length > 50 && metaDesc.length < 160 ? 15 : 0;
    score += h1 === 1 ? 10 : 0;
    score += missingAlt === 0 ? 5 : 0;
    score += hasSchema ? 5 : 0;
    score = Math.min(100, Math.max(30, score));

    const issues = [
      { type: title ? (title.length < 60 ? 'good' : 'warning') : 'critical', message: `Title: ${title || 'Missing'}`, fix: !title ? 'Add unique <title> tag (50-60 chars)' : title.length > 60 ? 'Shorten title' : '' },
      { type: metaDesc ? 'good' : 'warning', message: `Meta Description: ${metaDesc ? 'Present' : 'Missing'}`, fix: !metaDesc ? 'Add 150-160 character meta description' : '' },
      { type: h1 === 1 ? 'good' : 'critical', message: `${h1} H1 tag(s)`, fix: h1 !== 1 ? 'Use exactly one H1 tag' : '' },
      { type: missingAlt === 0 ? 'good' : 'warning', message: `${missingAlt} images missing alt text`, fix: missingAlt > 0 ? 'Add descriptive alt attributes to images' : '' },
      { type: hasSchema ? 'good' : 'warning', message: hasSchema ? 'Schema.org markup detected' : 'No Schema.org markup found', fix: !hasSchema ? 'Add JSON-LD structured data' : '' },
    ];

    return Response.json({
      url,
      title: title || 'No Title',
      score: Math.round(score),
      metaDesc,
      h1Count: h1,
      missingAlt,
      hasSchema,
      issues,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: 'Could not access URL. Make sure it is public and not blocked.' }, { status: 400 });
  }
}