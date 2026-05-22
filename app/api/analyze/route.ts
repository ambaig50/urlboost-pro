import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { url } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required.' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return NextResponse.json({ error: 'Please enter a valid URL starting with http:// or https://' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; URLBoostPro/1.0; +https://urlboostpro.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Website returned ${response.status} ${response.statusText}.` },
        { status: 400 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return NextResponse.json({ error: 'URL does not appear to be an HTML page.' }, { status: 400 });
    }

    const html = await response.text();

    // --- Extraction ---
    const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim().replace(/\s+/g, ' ') ?? '';
    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)?.[1]
      ?? html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/i)?.[1]
      ?? '';
    const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
    const h2Count = (html.match(/<h2[\s>]/gi) ?? []).length;
    const images = html.match(/<img[^>]*>/gi) ?? [];
    const missingAlt = images.filter(img => !/alt=["'][^"']*["']/i.test(img)).length;
    const hasSchema = html.includes('schema.org') || html.includes('application/ld+json');
    const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);
    const hasCanonical = /<link[^>]*rel=["']canonical["']/i.test(html);
    const hasOpenGraph = /<meta[^>]*property=["']og:/i.test(html);

    // --- Scoring ---
    let score = 30;
    if (title.length >= 10 && title.length <= 60) score += 15;
    else if (title.length > 0) score += 7;
    if (metaDesc.length >= 50 && metaDesc.length <= 160) score += 12;
    else if (metaDesc.length > 0) score += 5;
    if (h1Count === 1) score += 12;
    if (missingAlt === 0 && images.length > 0) score += 8;
    else if (images.length === 0) score += 8;
    if (hasSchema) score += 6;
    if (hasViewport) score += 7;
    if (hasCanonical) score += 5;
    if (hasOpenGraph) score += 5;
    score = Math.min(100, Math.max(10, score));

    // --- Issues ---
    const issues: SeoIssue[] = [
      {
        type: !title ? 'critical' : title.length > 60 ? 'warning' : title.length < 10 ? 'warning' : 'good',
        message: title ? `Title tag: "${title.slice(0, 60)}${title.length > 60 ? '…' : ''}" (${title.length} chars)` : 'Title tag: Missing',
        fix: !title ? 'Add a unique <title> tag between 50–60 characters.' : title.length > 60 ? 'Shorten title to under 60 characters.' : title.length < 10 ? 'Title is too short — aim for 50–60 characters.' : '',
      },
      {
        type: !metaDesc ? 'warning' : metaDesc.length > 160 ? 'warning' : metaDesc.length < 50 ? 'warning' : 'good',
        message: metaDesc ? `Meta description: ${metaDesc.length} chars` : 'Meta description: Missing',
        fix: !metaDesc ? 'Add a meta description of 150–160 characters.' : metaDesc.length > 160 ? 'Shorten meta description to under 160 characters.' : metaDesc.length < 50 ? 'Meta description is too short — aim for 150–160 characters.' : '',
      },
      {
        type: h1Count === 1 ? 'good' : h1Count === 0 ? 'critical' : 'warning',
        message: `H1 tags: ${h1Count} found`,
        fix: h1Count === 0 ? 'Add exactly one H1 tag as the main page heading.' : h1Count > 1 ? `Remove ${h1Count - 1} extra H1 tag(s) — pages should have exactly one.` : '',
      },
      {
        type: missingAlt === 0 ? 'good' : missingAlt > 3 ? 'critical' : 'warning',
        message: images.length === 0 ? 'No images found on page' : `Images: ${images.length} total, ${missingAlt} missing alt text`,
        fix: missingAlt > 0 ? `Add descriptive alt attributes to ${missingAlt} image(s).` : '',
      },
      {
        type: hasViewport ? 'good' : 'critical',
        message: hasViewport ? 'Viewport meta tag present (mobile-friendly)' : 'Viewport meta tag missing',
        fix: !hasViewport ? 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile compatibility.' : '',
      },
      {
        type: hasSchema ? 'good' : 'warning',
        message: hasSchema ? 'Structured data (Schema.org) detected' : 'No structured data found',
        fix: !hasSchema ? 'Add JSON-LD structured data to help search engines understand your content.' : '',
      },
      {
        type: hasCanonical ? 'good' : 'warning',
        message: hasCanonical ? 'Canonical URL tag present' : 'No canonical URL tag',
        fix: !hasCanonical ? 'Add <link rel="canonical"> to prevent duplicate content issues.' : '',
      },
      {
        type: hasOpenGraph ? 'good' : 'warning',
        message: hasOpenGraph ? 'Open Graph tags present (social sharing ready)' : 'No Open Graph tags found',
        fix: !hasOpenGraph ? 'Add og:title, og:description, og:image for better social media previews.' : '',
      },
    ];

    const result: SeoResult = {
      url: parsedUrl.toString(),
      title: title || 'No Title Found',
      score: Math.round(score),
      metaDesc,
      h1Count,
      h2Count,
      missingAlt,
      hasSchema,
      hasViewport,
      hasCanonical,
      hasOpenGraph,
      issues,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out. The website took too long to respond.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Could not access the URL. Make sure it is publicly accessible and not behind a login.' }, { status: 400 });
  }
}
