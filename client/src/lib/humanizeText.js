const PHRASE_REPLACEMENTS = [
  [/\butilize\b/gi, "use"],
  [/\bfacilitate\b/gi, "help"],
  [/\bcommence\b/gi, "start"],
  [/\bterminate\b/gi, "end"],
  [/\btherefore\b/gi, "so"],
  [/\bmoreover\b/gi, "also"],
  [/\bfurthermore\b/gi, "also"],
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bit is important to note that\b/gi, "importantly,"],
  [/\bin conclusion\b/gi, "to wrap up"],
  [/\bas an AI language model,?\s*/gi, ""]
];

const SOFTENERS = [
  "In simple terms,",
  "Put simply,",
  "A practical way to see it is this:",
  "The main idea is simple:",
  "Here is the useful part:"
];

export function humanizeText(text) {
  const cleanText = String(text || "").trim();

  if (!cleanText) {
    return "";
  }

  let nextText = cleanText;

  PHRASE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    nextText = nextText.replace(pattern, replacement);
  });

  nextText = nextText
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\b(can not)\b/gi, "cannot")
    .replace(/\bdo not\b/gi, "don't")
    .replace(/\bdoes not\b/gi, "doesn't")
    .replace(/\bis not\b/gi, "isn't")
    .replace(/\bare not\b/gi, "aren't")
    .replace(/\bwill not\b/gi, "won't")
    .replace(/\bthat is\b/gi, "that's")
    .replace(/\bit is\b/gi, "it's");

  const sentences = nextText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return nextText;
  }

  const rewritten = sentences.map((sentence, index) => {
    if (index === 0 && sentence.length > 80) {
      return `${SOFTENERS[cleanText.length % SOFTENERS.length]} ${sentence}`;
    }

    if (index > 0 && index % 3 === 0 && !/^(also|but|so|and)\b/i.test(sentence)) {
      return `Also, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
    }

    return sentence;
  });

  return rewritten.join(" ");
}
