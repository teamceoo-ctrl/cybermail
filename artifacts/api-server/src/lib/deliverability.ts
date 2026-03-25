export interface DeliverabilityCheck {
  id: string;
  category: "subject" | "content" | "structure" | "sender" | "legal";
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  impact: "high" | "medium" | "low";
}

export interface DeliverabilityReport {
  score: number;
  inboxProbability: number;
  checks: DeliverabilityCheck[];
  topIssues: string[];
  suggestions: string[];
}

const SPAM_PHRASES = [
  "act now", "action required", "apply now", "avoid bankruptcy",
  "buy direct", "buy now", "buy today", "call free",
  "call now", "cancel at any time", "check or money order",
  "click here", "click below", "click to remove",
  "collect child support", "compare rates",
  "congratulations", "credit card offers",
  "cures baldness", "dear friend",
  "double your cash", "double your income",
  "earn extra cash", "earn money", "earn per week",
  "easy money", "eliminate bad credit", "eliminate debt",
  "exclusive deal", "extra cash", "extra income",
  "fast cash", "financial freedom", "for free",
  "free access", "free cell phone", "free consultation",
  "free gift", "free hosting", "free info",
  "free investment", "free leads", "free membership",
  "free money", "free offer", "free preview",
  "free quote", "free sample", "free trial",
  "free website", "full refund", "get it now",
  "get paid", "get started now", "great offer",
  "guaranteed", "have been selected", "hidden charges",
  "home based business", "income from home",
  "increase sales", "increase traffic",
  "increase your income", "internet marketing",
  "investment decision", "join millions",
  "limited time offer", "lose weight fast",
  "lowest price", "luxury car", "make $",
  "make money", "meet singles", "member in standing",
  "miracle", "money back guarantee", "multi-level marketing",
  "no age restrictions", "no catch", "no cost",
  "no credit check", "no experience", "no fees",
  "no gimmick", "no hidden", "no interest", "no investment",
  "no middleman", "no obligation", "no purchase necessary",
  "no questions asked", "no risk", "no selling",
  "no strings attached", "not junk", "not spam",
  "now only", "offer expires", "once in a lifetime",
  "one hundred percent guaranteed", "one time",
  "online biz opportunity", "open immediately",
  "order now", "order today", "potential earnings",
  "prize", "promise", "pure profit", "real thing",
  "remove", "risk free", "risk-free", "save big",
  "save up to", "serious cash", "special offer",
  "special promotion", "subject to credit",
  "this is not junk", "this is not spam",
  "thousands of dollars", "trial offer", "unlimited",
  "unsecured credit", "unsecured debt", "urgent",
  "vacation for two", "valium", "venture capital",
  "viagra", "visit our website", "weight loss",
  "while supplies last", "win", "you are a winner",
  "you have been chosen", "you have been selected",
  "your income", "zero cost", "zero risk",
  "100% free", "100% satisfied", "50% off",
];

const FREE_EMAIL_PROVIDERS = [
  "gmail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "hotmail.co.uk",
  "outlook.com", "aol.com", "icloud.com", "me.com", "mac.com",
  "live.com", "msn.com", "protonmail.com", "yandex.com",
  "mail.com", "gmx.com", "zoho.com", "inbox.com",
];

const URL_SHORTENERS = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
  "buff.ly", "adf.ly", "short.io", "rebrand.ly", "tiny.cc",
  "shorturl.at", "cutt.ly", "v.gd", "rb.gy",
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function findSpamPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return SPAM_PHRASES.filter((phrase) => lower.includes(phrase));
}

function capsPercentage(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (!letters) return 0;
  const upper = text.replace(/[^A-Z]/g, "");
  return upper.length / letters.length;
}

function countLinks(html: string): number {
  return (html.match(/<a\s/gi) || []).length;
}

function hasUnsubscribeLink(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("unsubscribe") ||
    lower.includes("opt-out") ||
    lower.includes("opt out") ||
    lower.includes("manage preferences") ||
    lower.includes("email preferences")
  );
}

function hasPersonalizationToken(text: string): boolean {
  return /\{\{.+?\}\}/.test(text) || /\[.+?\]/.test(text);
}

function hasMissingAltImages(html: string): boolean {
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  return imgTags.some((tag) => !/alt\s*=/i.test(tag) || /alt\s*=\s*["']\s*["']/i.test(tag));
}

function hasPhysicalAddress(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    /\d+\s+\w+\s+(st|street|ave|avenue|blvd|boulevard|rd|road|drive|dr|lane|ln|way|court|ct|place|pl)/i.test(lower) ||
    lower.includes("p.o. box") ||
    lower.includes("po box") ||
    /[a-z\s]+,\s+[a-z]{2}\s+\d{5}/i.test(lower)
  );
}

function extractUrls(html: string): string[] {
  const matches = html.match(/https?:\/\/([^"'\s>]+)/gi) || [];
  return matches;
}

function hasUrlShortener(html: string): boolean {
  const lower = html.toLowerCase();
  return URL_SHORTENERS.some((domain) => lower.includes(domain));
}

function getHtmlSizeKb(html: string): number {
  return new TextEncoder().encode(html).length / 1024;
}

function countImages(html: string): number {
  return (html.match(/<img\s/gi) || []).length;
}

function hasPreheaderText(html: string): boolean {
  const lower = html.toLowerCase();
  return lower.includes("preheader") || /display\s*:\s*none/i.test(html) || lower.includes("preview text");
}

// Weighted score: each check contributes to a penalty pool
// Normalised so that a "typical" problem email scores ~40-60
const PENALTY: Record<string, Record<string, number>> = {
  high:   { fail: 14, warn: 7 },
  medium: { fail: 8,  warn: 3 },
  low:    { fail: 3,  warn: 1 },
};

export function analyzeDeliverability(params: {
  fromName: string;
  fromEmail: string;
  subject: string;
  htmlContent: string;
  replyTo?: string;
}): DeliverabilityReport {
  const { fromName, fromEmail, subject, htmlContent, replyTo } = params;
  const checks: DeliverabilityCheck[] = [];
  const hasHtml = htmlContent.trim().length > 0;
  const plainText = stripHtml(htmlContent);
  const wordCount = countWords(plainText);
  const linkCount = countLinks(htmlContent);
  const imageCount = countImages(htmlContent);
  const subjectSpam = findSpamPhrases(subject);
  const contentSpam = findSpamPhrases(plainText);
  const subjectCaps = capsPercentage(subject);
  const emailDomain = fromEmail.split("@")[1]?.toLowerCase() || "";
  const htmlSizeKb = getHtmlSizeKb(htmlContent);

  // ── SUBJECT LINE CHECKS ─────────────────────────────────────────────
  if (!subject || subject.trim().length === 0) {
    checks.push({ id: "subject_empty", category: "subject", label: "Subject line is missing", status: "fail", detail: "Every email needs a subject line — missing subjects trigger spam filters immediately.", impact: "high" });
  } else {
    if (subject.trim().length < 20) {
      checks.push({ id: "subject_short", category: "subject", label: "Subject line is very short", status: "warn", detail: `"${subject}" is only ${subject.length} chars. Aim for 30-50 characters for best open rates.`, impact: "medium" });
    } else if (subject.trim().length > 70) {
      checks.push({ id: "subject_long", category: "subject", label: "Subject line is too long", status: "warn", detail: `Subject is ${subject.length} chars — most clients clip at 60-70. Important words may be cut off.`, impact: "medium" });
    } else {
      checks.push({ id: "subject_length", category: "subject", label: "Subject line length is good", status: "pass", detail: `${subject.length} characters — within the ideal 20-70 char range.`, impact: "low" });
    }

    if (subjectCaps > 0.4) {
      checks.push({ id: "subject_caps", category: "subject", label: "Excessive CAPS in subject line", status: "fail", detail: `${Math.round(subjectCaps * 100)}% of subject letters are uppercase. CAPS triggers every major spam filter.`, impact: "high" });
    } else if (subjectCaps > 0.2) {
      checks.push({ id: "subject_caps_warn", category: "subject", label: "Moderate CAPS in subject line", status: "warn", detail: `${Math.round(subjectCaps * 100)}% uppercase — keep it below 20% to stay safe.`, impact: "medium" });
    } else {
      checks.push({ id: "subject_caps_ok", category: "subject", label: "Subject line capitalisation is normal", status: "pass", detail: "No excessive ALL CAPS detected.", impact: "low" });
    }

    if (subjectSpam.length > 0) {
      checks.push({ id: "subject_spam_words", category: "subject", label: "Spam trigger words in subject", status: "fail", detail: `Found: "${subjectSpam.slice(0, 3).join('", "')}"${subjectSpam.length > 3 ? ` (+${subjectSpam.length - 3} more)` : ""}. Replace these with natural language.`, impact: "high" });
    } else {
      checks.push({ id: "subject_spam_words_ok", category: "subject", label: "No spam trigger words in subject", status: "pass", detail: "Subject line is clean of known spam phrases.", impact: "high" });
    }

    if (/!!|!{2,}|\?{2,}/.test(subject)) {
      checks.push({ id: "subject_punctuation", category: "subject", label: "Excessive punctuation in subject", status: "warn", detail: 'Multiple "!!" or "??" are classic spam signals. Use at most one per subject.', impact: "medium" });
    } else {
      checks.push({ id: "subject_punctuation_ok", category: "subject", label: "Punctuation in subject is clean", status: "pass", detail: "No repeated exclamation marks or question marks.", impact: "low" });
    }

    if (/\$\$|\$\d/.test(subject)) {
      checks.push({ id: "subject_dollar", category: "subject", label: "Currency symbols in subject", status: "warn", detail: "Dollar signs in subjects are heavily weighted spam signals. Spell out amounts instead.", impact: "medium" });
    }

    if (hasPersonalizationToken(subject)) {
      checks.push({ id: "subject_personalization", category: "subject", label: "Subject line is personalized", status: "pass", detail: "Personalization tokens detected — personalized subjects get 26% higher open rates.", impact: "medium" });
    } else {
      checks.push({ id: "subject_no_personalization", category: "subject", label: "No personalization in subject", status: "warn", detail: "Add {{firstName}} or similar tokens to boost open rates and engagement signals.", impact: "medium" });
    }
  }

  // ── CONTENT CHECKS ──────────────────────────────────────────────────
  if (!hasHtml) {
    checks.push({ id: "content_empty", category: "content", label: "Email body is empty", status: "fail", detail: "Empty emails are automatically flagged as spam.", impact: "high" });
  } else {
    if (wordCount < 50) {
      checks.push({ id: "content_short", category: "content", label: "Email body is very short", status: "warn", detail: `Only ${wordCount} words detected. Very short emails look like phishing attempts. Aim for 100+ words.`, impact: "medium" });
    } else if (wordCount > 2500) {
      checks.push({ id: "content_long", category: "content", label: "Email body is very long", status: "warn", detail: `${wordCount} words — very long emails hurt engagement. Most effective emails are 150-500 words.`, impact: "low" });
    } else {
      checks.push({ id: "content_length_ok", category: "content", label: "Email body length is appropriate", status: "pass", detail: `${wordCount} words — within a healthy range for deliverability.`, impact: "low" });
    }

    if (contentSpam.length > 5) {
      checks.push({ id: "content_spam_density", category: "content", label: "High spam phrase density in body", status: "fail", detail: `Found ${contentSpam.length} spam phrases: "${contentSpam.slice(0, 3).join('", "')}". Rewrite these sections with natural language.`, impact: "high" });
    } else if (contentSpam.length > 1) {
      checks.push({ id: "content_spam_words", category: "content", label: "Some spam phrases in body", status: "warn", detail: `Found ${contentSpam.length} spam phrases: "${contentSpam.join('", "')}". Try rewording these.`, impact: "high" });
    } else {
      checks.push({ id: "content_spam_clean", category: "content", label: "Email body is spam-phrase clean", status: "pass", detail: "No significant spam trigger phrases detected in the body content.", impact: "high" });
    }

    const contentCaps = capsPercentage(plainText);
    if (contentCaps > 0.15) {
      checks.push({ id: "content_caps", category: "content", label: "Too many ALL CAPS words in body", status: "warn", detail: `${Math.round(contentCaps * 100)}% of body text is uppercase. Tone it down to below 10%.`, impact: "medium" });
    } else {
      checks.push({ id: "content_caps_ok", category: "content", label: "Body capitalisation is normal", status: "pass", detail: "No excessive ALL CAPS detected in email body.", impact: "low" });
    }

    if (linkCount > 8) {
      checks.push({ id: "content_too_many_links", category: "content", label: "Too many links in email", status: "fail", detail: `${linkCount} links detected. Emails with 10+ links are heavily penalised. Keep to 3-5 maximum.`, impact: "high" });
    } else if (linkCount > 5) {
      checks.push({ id: "content_many_links", category: "content", label: "High number of links", status: "warn", detail: `${linkCount} links found. Consider cutting to 3-5 for better deliverability.`, impact: "medium" });
    } else {
      checks.push({ id: "content_links_ok", category: "content", label: "Link count is acceptable", status: "pass", detail: `${linkCount} link${linkCount !== 1 ? "s" : ""} detected — within a safe range.`, impact: "medium" });
    }

    if (hasMissingAltImages(htmlContent)) {
      checks.push({ id: "content_img_alt", category: "content", label: "Images missing alt text", status: "warn", detail: "Some images have empty or missing alt attributes. Spam filters use this as a signal.", impact: "low" });
    } else if (imageCount > 0) {
      checks.push({ id: "content_img_alt_ok", category: "content", label: "All images have alt text", status: "pass", detail: `Good — all ${imageCount} <img> tag${imageCount !== 1 ? "s" : ""} include descriptive alt attributes.`, impact: "low" });
    }

    // Text-to-image ratio check
    if (imageCount > 0 && wordCount < 20) {
      checks.push({ id: "content_image_heavy", category: "content", label: "Email is almost entirely images", status: "fail", detail: `${imageCount} image${imageCount !== 1 ? "s" : ""} but only ${wordCount} words of text. Image-only emails are blocked by most spam filters — add meaningful text content.`, impact: "high" });
    } else if (imageCount > 3 && wordCount < 50) {
      checks.push({ id: "content_image_ratio", category: "content", label: "Low text-to-image ratio", status: "warn", detail: `${imageCount} images with only ${wordCount} words. Aim for at least 60% text content for better deliverability.`, impact: "medium" });
    } else if (imageCount > 0) {
      checks.push({ id: "content_image_ratio_ok", category: "content", label: "Text-to-image ratio is acceptable", status: "pass", detail: `${imageCount} image${imageCount !== 1 ? "s" : ""} alongside ${wordCount} words of text — good balance.`, impact: "medium" });
    }

    // URL shortener check
    if (hasUrlShortener(htmlContent)) {
      checks.push({ id: "content_url_shortener", category: "content", label: "URL shortener detected", status: "fail", detail: "Shortened URLs (bit.ly, tinyurl, t.co, etc.) are a top spam signal — they hide the destination and are blocked by most corporate filters. Use full URLs.", impact: "high" });
    } else {
      checks.push({ id: "content_url_shortener_ok", category: "content", label: "No URL shorteners detected", status: "pass", detail: "Good — no shortened URLs found. Full domain links are trusted by spam filters.", impact: "medium" });
    }

    // HTML size check
    if (htmlSizeKb > 100) {
      checks.push({ id: "content_html_size", category: "content", label: "HTML is very large (>100 KB)", status: "fail", detail: `HTML size is ${Math.round(htmlSizeKb)} KB. Emails over 100 KB trigger Gmail clipping and many spam filters. Remove inline images, minify CSS, and trim unnecessary markup.`, impact: "high" });
    } else if (htmlSizeKb > 60) {
      checks.push({ id: "content_html_size_warn", category: "content", label: "HTML size is approaching limit", status: "warn", detail: `HTML size is ${Math.round(htmlSizeKb)} KB. Gmail clips at 102 KB — keep under 60 KB for safe delivery.`, impact: "medium" });
    } else {
      checks.push({ id: "content_html_size_ok", category: "content", label: "HTML size is within safe limits", status: "pass", detail: `HTML size is ${Math.round(htmlSizeKb * 10) / 10} KB — well under the 102 KB Gmail clip limit.`, impact: "medium" });
    }

    if (hasPersonalizationToken(plainText)) {
      checks.push({ id: "content_personalization", category: "content", label: "Body contains personalization", status: "pass", detail: "Personalization tokens boost engagement metrics, which improves long-term sender reputation.", impact: "medium" });
    } else {
      checks.push({ id: "content_no_personalization", category: "content", label: "No personalization in body", status: "warn", detail: "Add {{firstName}}, {{company}} or similar tokens to increase perceived relevance.", impact: "medium" });
    }

    // Preheader check
    if (!hasPreheaderText(htmlContent)) {
      checks.push({ id: "content_no_preheader", category: "content", label: "No preheader text detected", status: "warn", detail: "Preheader text is the preview line shown after the subject in inbox views. Add a hidden <span> with preview text to improve open rates.", impact: "low" });
    } else {
      checks.push({ id: "content_preheader_ok", category: "content", label: "Preheader text found", status: "pass", detail: "Preview text detected — this gives recipients a compelling reason to open.", impact: "low" });
    }
  }

  // ── STRUCTURE CHECKS (only if HTML provided) ─────────────────────────
  if (hasHtml) {
    const hasDoctype = /<!doctype/i.test(htmlContent);
    if (!hasDoctype) {
      checks.push({ id: "structure_doctype", category: "structure", label: "Missing DOCTYPE declaration", status: "warn", detail: "Without <!DOCTYPE html>, some clients treat the email as plain text and apply heuristic spam scoring.", impact: "low" });
    } else {
      checks.push({ id: "structure_doctype_ok", category: "structure", label: "DOCTYPE is present", status: "pass", detail: "Proper DOCTYPE helps email clients render the HTML correctly.", impact: "low" });
    }

    const hasCharset = /charset/i.test(htmlContent);
    if (!hasCharset) {
      checks.push({ id: "structure_charset", category: "structure", label: "Missing charset meta tag", status: "warn", detail: 'Add <meta charset="UTF-8"> to prevent garbled text in international clients.', impact: "low" });
    } else {
      checks.push({ id: "structure_charset_ok", category: "structure", label: "Character encoding declared", status: "pass", detail: "Charset meta tag found — text will render correctly across locales.", impact: "low" });
    }

    const hasViewport = /<meta[^>]+viewport/i.test(htmlContent);
    if (!hasViewport) {
      checks.push({ id: "structure_responsive", category: "structure", label: "No responsive viewport meta", status: "warn", detail: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile rendering.', impact: "low" });
    } else {
      checks.push({ id: "structure_responsive_ok", category: "structure", label: "Responsive viewport declared", status: "pass", detail: "Email will scale correctly on mobile devices.", impact: "low" });
    }

    const hasTableLayout = /<table/i.test(htmlContent);
    if (hasTableLayout) {
      checks.push({ id: "structure_table", category: "structure", label: "Table-based layout detected", status: "pass", detail: "Table layouts ensure maximum compatibility across email clients, especially Outlook.", impact: "low" });
    }

    const hasInlineStyles = /style\s*=/i.test(htmlContent);
    if (!hasInlineStyles && /<style/i.test(htmlContent)) {
      checks.push({ id: "structure_inline_styles", category: "structure", label: "Styles are not inlined", status: "warn", detail: "Many email clients strip <style> blocks. Inline your CSS with style=\"\" attributes for maximum compatibility.", impact: "medium" });
    } else if (hasInlineStyles) {
      checks.push({ id: "structure_inline_styles_ok", category: "structure", label: "Inline styles detected", status: "pass", detail: "Inline CSS improves rendering compatibility across email clients.", impact: "low" });
    }
  }

  // ── SENDER CHECKS ───────────────────────────────────────────────────
  if (!fromEmail || !fromEmail.includes("@")) {
    checks.push({ id: "sender_invalid", category: "sender", label: "From address is invalid or missing", status: "fail", detail: "A valid From email address is required for delivery.", impact: "high" });
  } else {
    if (FREE_EMAIL_PROVIDERS.includes(emailDomain)) {
      checks.push({ id: "sender_free_provider", category: "sender", label: "Sending from a free email provider", status: "fail", detail: `${emailDomain} is a consumer email provider. Most major spam filters block bulk email from free providers. Use a business domain.`, impact: "high" });
    } else {
      checks.push({ id: "sender_domain_ok", category: "sender", label: "Sender domain is a business address", status: "pass", detail: `${emailDomain} appears to be a custom business domain — good for deliverability.`, impact: "high" });
    }

    if (!fromName || fromName.trim().length === 0) {
      checks.push({ id: "sender_no_name", category: "sender", label: "No From name set", status: "warn", detail: "Emails without a display name look automated and impersonal. Use your brand name.", impact: "medium" });
    } else {
      checks.push({ id: "sender_name_ok", category: "sender", label: "From name is set", status: "pass", detail: `"${fromName}" will appear as the sender display name.`, impact: "medium" });
    }

    if (fromEmail.toLowerCase().startsWith("noreply@") || fromEmail.toLowerCase().startsWith("no-reply@") || fromEmail.toLowerCase().startsWith("donotreply@")) {
      checks.push({ id: "sender_noreply", category: "sender", label: "No-reply address detected", status: "warn", detail: "No-reply addresses hurt engagement. Replies are a positive deliverability signal — use a monitored inbox.", impact: "medium" });
    } else {
      checks.push({ id: "sender_replyable", category: "sender", label: "From address accepts replies", status: "pass", detail: "Using a replyable address improves trust signals with receiving mail servers.", impact: "medium" });
    }

    if (replyTo) {
      if (replyTo.includes("@")) {
        checks.push({ id: "sender_replyto", category: "sender", label: "Reply-To header is set", status: "pass", detail: `Replies will go to ${replyTo} — good practice for tracked campaigns.`, impact: "low" });
      } else {
        checks.push({ id: "sender_replyto_invalid", category: "sender", label: "Reply-To address appears invalid", status: "warn", detail: `"${replyTo}" doesn't look like a valid email address. Check the format.`, impact: "low" });
      }
    }
  }

  // ── LEGAL CHECKS (only if HTML provided) ────────────────────────────
  if (hasHtml) {
    if (!hasUnsubscribeLink(htmlContent)) {
      checks.push({ id: "legal_unsubscribe", category: "legal", label: "No unsubscribe link found", status: "fail", detail: "CAN-SPAM, GDPR, and CASL all require an unsubscribe mechanism. Missing this will get you flagged by every major filter.", impact: "high" });
    } else {
      checks.push({ id: "legal_unsubscribe_ok", category: "legal", label: "Unsubscribe link is present", status: "pass", detail: "Good — an opt-out mechanism is required by law and helps maintain a clean list.", impact: "high" });
    }

    if (!hasPhysicalAddress(htmlContent)) {
      checks.push({ id: "legal_address", category: "legal", label: "No physical address found", status: "warn", detail: "CAN-SPAM requires a valid physical postal address in commercial emails. Add your company address to the footer.", impact: "medium" });
    } else {
      checks.push({ id: "legal_address_ok", category: "legal", label: "Physical address detected in footer", status: "pass", detail: "Physical address found — meets CAN-SPAM compliance requirements.", impact: "medium" });
    }
  }

  // ── CALCULATE SCORE (normalised penalty system) ──────────────────────
  let totalPenalty = 0;
  let maxPossiblePenalty = 0;

  for (const c of checks) {
    const penalties = PENALTY[c.impact];
    const maxForCheck = penalties.fail;
    maxPossiblePenalty += maxForCheck;

    if (c.status === "fail") totalPenalty += penalties.fail;
    else if (c.status === "warn") totalPenalty += penalties.warn;
  }

  // Normalise: score = 100 * (1 - penalty/maxPenalty), floor at 5
  const rawScore = maxPossiblePenalty > 0
    ? 100 * (1 - totalPenalty / maxPossiblePenalty)
    : 100;

  const score = Math.max(5, Math.min(100, Math.round(rawScore)));
  const inboxProbability = Math.max(3, Math.min(97, Math.round(score * 0.9 + 2)));

  const failed = checks.filter((c) => c.status === "fail").sort((a) => (a.impact === "high" ? -1 : 1));
  const warned = checks.filter((c) => c.status === "warn").sort((a) => (a.impact === "high" ? -1 : 1));

  const topIssues = [...failed, ...warned].slice(0, 4).map((c) => c.label);

  const suggestions: string[] = [];
  if (checks.find((c) => c.id === "sender_free_provider")) suggestions.push("Switch to a dedicated sending domain with SPF, DKIM, and DMARC configured.");
  if (checks.find((c) => c.id === "legal_unsubscribe")) suggestions.push("Add an unsubscribe link to your footer — it's legally required and reduces spam complaints.");
  if (checks.find((c) => c.id === "legal_address")) suggestions.push("Include your physical company address in the email footer for CAN-SPAM compliance.");
  if (checks.find((c) => c.id === "subject_spam_words" || c.id === "content_spam_density" || c.id === "content_spam_words")) suggestions.push("Rewrite spam-flagged phrases using natural conversational language.");
  if (checks.find((c) => c.id === "subject_caps" || c.id === "subject_caps_warn")) suggestions.push("Remove ALL CAPS from your subject line — use sentence case or title case.");
  if (checks.find((c) => c.id === "subject_no_personalization" && c.status === "warn")) suggestions.push("Add {{firstName}} to your subject line to increase open rates by up to 26%.");
  if (checks.find((c) => c.id === "content_no_personalization" && c.status === "warn")) suggestions.push("Personalize the email body with the recipient's name or company.");
  if (checks.find((c) => c.id === "content_too_many_links" || c.id === "content_many_links")) suggestions.push("Reduce links to 3-5 per email. Too many URLs trigger link-ratio filters.");
  if (checks.find((c) => c.id === "content_url_shortener")) suggestions.push("Replace shortened URLs (bit.ly, tinyurl, etc.) with full domain links — spam filters block them.");
  if (checks.find((c) => c.id === "content_image_heavy" || c.id === "content_image_ratio")) suggestions.push("Add more text content. Image-heavy emails without sufficient text are blocked by most filters.");
  if (checks.find((c) => c.id === "content_html_size" || c.id === "content_html_size_warn")) suggestions.push("Reduce HTML size below 60 KB — inline CSS bloat and base64 images are the usual culprits.");
  if (checks.find((c) => c.id === "content_no_preheader")) suggestions.push("Add a hidden preheader span after <body> to show compelling preview text in inbox views.");
  if (suggestions.length === 0) suggestions.push("Great job — this email has no major deliverability issues. Monitor engagement metrics after sending.");

  return { score, inboxProbability, checks, topIssues, suggestions };
}
