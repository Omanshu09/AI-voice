// Pure helpers for speech. No DOM access at import time, so they can be unit tested in Node.

export function amountToWords(n) {
  const lakh = Math.floor(n / 100000), thousand = Math.floor((n % 100000) / 1000), rest = n % 1000;
  return [lakh && `${lakh} lakh`, thousand && `${thousand} thousand`, rest && `${rest}`].filter(Boolean).join(" ") || "0";
}

/** Makes text read well aloud: ₹1,35,000 -> "1 lakh 35 thousand rupees", 32.5% -> "32.5 percent". */
export function toSpeech(text) {
  return text
    .replace(/₹\s?([\d,]+)(\.\d+)?/g, (_, whole, frac) => {
      const n = Number(whole.replace(/,/g, ""));
      return `${amountToWords(n)}${frac ? " point " + frac.slice(1).split("").join(" ") : ""} rupees`;
    })
    .replace(/(\d+(?:\.\d+)?)\s?%/g, "$1 percent");
}

/** Splits into short chunks. Some browsers stop long utterances after ~15 seconds. */
export function splitSentences(text, maxLen = 200) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = [];
  for (const s of sentences) {
    const last = chunks[chunks.length - 1];
    if (last && (last + " " + s).length <= maxLen) chunks[chunks.length - 1] = last + " " + s;
    else chunks.push(s);
  }
  return chunks.length ? chunks : [text];
}

export const getRecognitionCtor = () =>
  typeof window === "undefined" ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null;
export const hasSynthesis = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

export function pickVoice(voices) {
  return voices.find(v => /^en[-_]IN$/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang) && /india/i.test(v.name)) || voices.find(v => /^en/i.test(v.lang)) || null;
}

export function browserSupportNote(ua = "") {
  if (/firefox/i.test(ua)) return "Firefox does not support browser speech recognition. You can still type, and Asha can still speak.";
  if (/safari/i.test(ua) && !/chrome|chromium|crios|edg/i.test(ua)) return "Safari's speech recognition support is limited and may behave differently. Chrome or Edge is recommended.";
  return "";
}
