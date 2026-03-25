import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
});

const SYSTEM_PROMPT = `You are an expert email copywriter and HTML email developer. Your specialty is writing high-deliverability, inbox-landing email campaigns that are professional, engaging, and completely free of spam triggers.

CRITICAL RULES FOR INBOX DELIVERABILITY:
1. NEVER use these spam-trigger words: "free", "guaranteed", "unlimited", "winner", "congratulations", "act now", "buy now", "click here", "order now", "earn money", "make money", "no cost", "for free", "no fee", "special offer", "you've been selected", "risk-free", "cash prize", "double your income", "lose weight fast", "urgent", "you have been selected"
2. NEVER use ALL CAPS in the subject line or body
3. NEVER use excessive exclamation marks (maximum 1 in the entire email)
4. Keep the text-to-HTML ratio high — use minimal styling, mostly text
5. Include a clear, unambiguous unsubscribe link using {{unsubscribe_url}}
6. The subject line must be conversational, specific, and under 50 characters when possible
7. Use personal pronouns ("you", "your") but keep it professional
8. Make the call-to-action natural and helpful, never pushy

PERSONALIZATION TAGS (use them naturally throughout):
- {{first_name}} — recipient's first name
- {{last_name}} — last name
- {{company}} — their company
- {{email}} — email address
- {{job_title}} — job title
- {{city}} — city
- {{coupon_code}} — promo code (when relevant)
- {{date}} — today's date
- {{unsubscribe_url}} — ALWAYS include this in the footer

HTML EMAIL STANDARDS:
- Use table-based layout for maximum email client compatibility
- Always include both HTML and plain text (handled by the sending system)
- Use inline CSS only — no external stylesheets, no <style> blocks in <head>
- Include DOCTYPE and proper meta tags
- Keep width at 600px max for desktop email clients
- Use web-safe fonts: Arial, Georgia, Verdana, Trebuchet MS, or system-ui
- Make all links absolute (use # as placeholder if URL is unknown)
- Background colors on table cells, not body tags, for Outlook compatibility
- Include alt text on all images

OUTPUT FORMAT — respond with EXACTLY this structure, nothing else:
SUBJECT: <your suggested subject line here>
===
<your complete HTML email here>`;

router.post("/ai/compose", async (req, res) => {
  try {
    const { prompt, tone = "professional", emailType = "general", length = "medium" } = req.body as {
      prompt: string;
      tone?: string;
      emailType?: string;
      length?: string;
    };

    if (!prompt?.trim()) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const wordCounts: Record<string, string> = {
      short: "150–250 words of body copy",
      medium: "300–450 words of body copy",
      long: "500–700 words of body copy",
    };

    const toneInstructions: Record<string, string> = {
      professional: "formal, authoritative, business-appropriate, respectful",
      casual: "relaxed, conversational, friendly, approachable, like talking to a trusted colleague",
      friendly: "warm, welcoming, enthusiastic but measured, like a helpful friend",
      urgent: "time-sensitive without being pushy — create gentle urgency through value, not pressure",
      persuasive: "compelling and clear, focusing on benefits and value rather than features",
      corporate: "executive-level, concise, results-oriented, no fluff",
    };

    const emailTypeInstructions: Record<string, string> = {
      promotional: "a promotional campaign highlighting an offer, product, or service — focus on value",
      newsletter: "a newsletter update with multiple sections — news, tips, or updates",
      "cold-outreach": "a first-touch outreach email — keep it brief, personalized, and end with a soft call-to-action",
      "follow-up": "a follow-up email — acknowledge the previous contact and move the conversation forward",
      welcome: "a welcome email for a new subscriber or customer — warm, onboarding-focused",
      notification: "a transactional or informational notification — clear, concise, action-oriented",
      general: "a general purpose email",
    };

    const userMessage = `Write a ${emailTypeInstructions[emailType] ?? "general"} email with the following brief:

BRIEF: ${prompt.trim()}

TONE: ${toneInstructions[tone] ?? tone}
LENGTH: ${wordCounts[length] ?? wordCounts.medium}

Requirements:
- Use {{first_name}} at least once for personalization
- Include a clear, natural call-to-action
- End with a professional signature block with {{unsubscribe_url}}
- Make the email feel genuinely helpful, not salesy
- The subject line must be specific to this brief, not generic
- Write full, complete HTML — do not truncate or use placeholders`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      stream: true,
    });

    let buffer = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        buffer += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
        if (typeof (res as any).flush === "function") (res as any).flush();
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    req.log?.error?.({ err }, "AI compose error");
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message ?? "AI compose failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: err?.message ?? "AI compose failed" })}\n\n`);
      res.end();
    }
  }
});

export default router;
