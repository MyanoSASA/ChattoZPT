const messages = document.querySelector("#messages");
const composer = document.querySelector("#composer");
const promptInput = document.querySelector("#promptInput");
const newChatButton = document.querySelector("#newChatButton");
const themeToggleButton = document.querySelector("#themeToggleButton");

const lexicon = {
  openers: [
    "マジ",
    "いやマジで",
    "普通に",
    "それは",
    "かなり",
    "だいぶ",
    "正直",
    "ぶっちゃけ",
    "ガチで",
    "完全に",
    "めちゃくちゃ",
    "なかなか",
    "わりと",
    "相当",
    "もはや",
    "ちょっと",
    "シンプルに",
    "リアルに",
    "ワンチャン",
    "まじで",
    "てか",
    "なんか",
    "もう",
  ],
  cores: [
    "やばい",
    "エグい",
    "エモい",
    "やばすぎる",
    "えぐい",
    "エモすぎる",
    "エグすぎる",
    "無理",
    "バグってる",
    "あり",
    "なし",
  ],
  reactions: [
    "それエグいわ。",
    "それはやばい。",
    "それエモい。",
    "エモすぎる。",
    "普通にエモい。",
    "だいぶエモい。",
    "それ無理。",
    "やばすぎる。",
    "エグすぎる。",
    "もう無理。",
    "なんかやばい。",
    "全部やばい。",
    "意味わからんくらいやばい。",
    "それはもうやばい。",
    "それはもうエモ。",
    "普通に無理。",
    "てかやばい。",
    "マジでエグい。",
    "やばいしかない。",
  ],
  endings: [
    "つまり、かなりやばい。",
    "そこだけはマジ。",
    "もうやばい。",
    "もうエモい。",
    "これはやばい。",
    "マジでやばい。",
    "逆にエモい。",
    "さすがにやばい。",
    "もはややばい。",
    "もはやエモ。",
    "全部エグい。",
  ],
  keywordMentions: [
    "{keyword}の話、マジやばいし",
    "{keyword}はそれエグいわ。",
    "{keyword}って時点でやばいし",
    "その{keyword}、普通にエグい。",
    "{keyword}、普通にエモいし",
    "{keyword}、シンプルにやばい。",
    "{keyword}ってもうエモい。",
    "てか{keyword}がやばい。",
    "{keyword}だけで無理。",
    "{keyword}の時点でエモい。",
  ],
};

const stopWords = new Set([
  "これ",
  "それ",
  "あれ",
  "どれ",
  "ここ",
  "そこ",
  "ため",
  "こと",
  "もの",
  "感じ",
  "さん",
  "です",
  "ます",
  "する",
  "した",
  "して",
  "いる",
  "ある",
  "ない",
  "なる",
  "から",
  "まで",
  "より",
  "について",
  "お願い",
  "ください",
  "どう",
  "なぜ",
  "なに",
  "何",
  "今日",
  "明日",
]);

let isTyping = false;
let emptyStateTimer = null;
let emptyStateIndex = 0;

const emptyStateMessages = [
  "マジやばい。とりま打って。",
  "それエグいわ。なんか投げて。",
  "普通にやばい。一言でいい。",
  "かなりエモい。雑に来て。",
  "やばいしかない。短文でOK。",
  "とりま、ひとこと。",
];

const chatIconSvg = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 5.75A1.75 1.75 0 0 1 6.75 4h10.5A1.75 1.75 0 0 1 19 5.75v8.5A1.75 1.75 0 0 1 17.25 16H10l-4.2 3.15A.5.5 0 0 1 5 18.75v-13Z"/>
    <path d="M9 8h6l-6 5h6" class="avatar-cut"/>
  </svg>
`;

function choice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function renderEmptyState() {
  const copy = emptyStateMessages[emptyStateIndex % emptyStateMessages.length];
  messages.classList.add("messages-empty");
  messages.innerHTML = `
    <section class="empty-state" aria-label="はじめに">
      <div class="empty-state-mark" aria-hidden="true">
        ${chatIconSvg}
      </div>
      <p class="empty-state-copy" id="emptyStateCopy">${copy}</p>
      <p class="empty-state-hint">何か打って。</p>
    </section>
  `;
}

function stopEmptyStateLoop() {
  if (emptyStateTimer) {
    window.clearTimeout(emptyStateTimer);
    emptyStateTimer = null;
  }
}

function typeEmptyStateCopy(text) {
  const target = document.querySelector("#emptyStateCopy");
  if (!target) {
    return;
  }

  const tokens = text.split(/(?<=。)|\s+/).filter(Boolean);
  target.textContent = "";

  (async () => {
    for (const token of tokens) {
      const delay = Math.floor(Math.random() * 140) + 45;
      await new Promise((resolve) => setTimeout(resolve, delay));
      target.textContent += target.textContent ? ` ${token}` : token;
    }
  })();
}

function scheduleEmptyStateRotation() {
  stopEmptyStateLoop();

  emptyStateTimer = window.setTimeout(() => {
    if (!messages.classList.contains("messages-empty") || isTyping) {
      scheduleEmptyStateRotation();
      return;
    }

    emptyStateIndex = (emptyStateIndex + 1) % emptyStateMessages.length;
    typeEmptyStateCopy(emptyStateMessages[emptyStateIndex]);
    scheduleEmptyStateRotation();
  }, 5000);
}

function normalizeCandidate(word) {
  return word
    .replace(/^[\sはがをにへでもとの、。！？!?]+|[\sはがをにへでもとのだねよな、。！？!?]+$/g, "")
    .replace(/(です|ます|した|してる|して|する|だった|当たった|ほしい|だよ|だね|かな|かも)$/g, "");
}

function scoreCandidate(word, index) {
  const hasKanji = /[\u4e00-\u9fff]/.test(word);
  const hasKatakana = /[\u30a1-\u30ff]/.test(word);
  const hasAlphaNumber = /[a-zA-Z0-9]/.test(word);
  const lengthScore = Math.min(word.length, 12);
  const scriptScore = Number(hasKanji) * 4 + Number(hasKatakana) * 3 + Number(hasAlphaNumber) * 3;
  const positionPenalty = index * 0.08;

  return lengthScore + scriptScore - positionPenalty + Math.random();
}

function extractKeyword(text) {
  const normalizedText = text.replace(/[。、！？!?()[\]{}「」『』"'`~:;,.]/g, " ");
  const roughWords = normalizedText.match(/[一-龠ぁ-んァ-ヶーa-zA-Z0-9]{2,}/g) || [];
  const candidates = [];

  roughWords.forEach((word, index) => {
    const normalized = normalizeCandidate(word);
    const splitWords = normalized
      .split(/(?:について|お願い|ください|したい|して|する|です|ます|だった|だよ|だね|かな|かも|から|まで|より|って|とは|には|では|は|が|を|に|へ|で|と|も|の)/)
      .map(normalizeCandidate)
      .filter(Boolean);

    if (normalized.length >= 2 && normalized.length <= 12 && splitWords.length <= 1 && !stopWords.has(normalized)) {
      candidates.push({ word: normalized, score: scoreCandidate(normalized, index) });
    }

    const chunks = normalized.match(/[一-龠ァ-ヶーa-zA-Z0-9]{2,}|[ぁ-ん]{3,}/g) || [];
    [...chunks, ...splitWords].forEach((chunk) => {
      const normalizedChunk = normalizeCandidate(chunk);

      if (normalizedChunk.length >= 2 && normalizedChunk !== normalized && !stopWords.has(normalizedChunk)) {
        candidates.push({ word: normalizedChunk, score: scoreCandidate(normalizedChunk, index) + 1 });
      }
    });
  });

  if (candidates.length === 0) {
    return "";
  }

  const uniqueCandidates = new Map();
  candidates.forEach((candidate) => {
    const current = uniqueCandidates.get(candidate.word);

    if (!current || candidate.score > current.score) {
      uniqueCandidates.set(candidate.word, candidate);
    }
  });

  return [...uniqueCandidates.values()].sort((a, b) => b.score - a.score)[0].word.slice(0, 18);
}

function makeVibePhrase({ ending = "" } = {}) {
  return `${choice(lexicon.openers)}${choice(lexicon.cores)}${ending}`;
}

function makeKeywordMention(keyword) {
  return choice(lexicon.keywordMentions).replace("{keyword}", keyword);
}

function makeReplyToken(index, keyword) {
  const pattern = Math.random();

  if (index === 0 && keyword) {
    return makeKeywordMention(keyword);
  }

  if (index === 0) {
    return makeVibePhrase({ ending: "し" });
  }

  if (pattern < 0.62) {
    return choice(lexicon.reactions);
  }

  if (pattern < 0.84) {
    return makeVibePhrase({ ending: "。" });
  }

  return choice(lexicon.endings);
}

function pickTokenCount() {
  return choice([2, 2, 2, 3, 3, 3, 4, 5]);
}

function buildReply(userText) {
  const tokenCount = pickTokenCount();
  const keyword = extractKeyword(userText);
  const tokens = [];

  for (let i = 0; i < tokenCount; i += 1) {
    tokens.push(makeReplyToken(i, keyword));
  }

  if (userText.trim().endsWith("?") || userText.trim().endsWith("？")) {
    tokens.splice(2, 0, "マジやばい");
  }

  return tokens.slice(0, 5);
}

function getAvatarSvg(role) {
  if (role === "user") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0 1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z"/>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.75A1.75 1.75 0 0 1 6.75 4h10.5A1.75 1.75 0 0 1 19 5.75v8.5A1.75 1.75 0 0 1 17.25 16H10l-4.2 3.15A.5.5 0 0 1 5 18.75v-13Z"/>
      <path d="M9 8h6l-6 5h6" class="avatar-cut"/>
    </svg>
  `;
}

function createMessage(role, text = "") {
  const article = document.createElement("article");
  article.className = `message ${role}-message`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.innerHTML = getAvatarSvg(role);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.append(paragraph);

  article.append(avatar, bubble);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;

  return paragraph;
}

function resizeTextarea() {
  promptInput.style.height = "auto";
  promptInput.style.height = `${promptInput.scrollHeight}px`;
}

function setBusy(nextBusy) {
  isTyping = nextBusy;
  composer.querySelector("button").disabled = nextBusy;
}

async function typeTokens(target, tokens) {
  target.classList.add("typing-cursor");

  for (const token of tokens) {
    const delay = Math.floor(Math.random() * 145) + 45;
    await new Promise((resolve) => setTimeout(resolve, delay));
    target.textContent += target.textContent ? ` ${token}` : token;
    messages.scrollTop = messages.scrollHeight;
  }

  target.classList.remove("typing-cursor");
}

async function waitForThinking(target) {
  const delay = Math.floor(Math.random() * 1700) + 500;
  target.textContent = "考え中...";
  target.classList.add("typing-cursor");
  messages.scrollTop = messages.scrollHeight;

  await new Promise((resolve) => setTimeout(resolve, delay));

  target.textContent = "";
  target.classList.remove("typing-cursor");
}

composer.addEventListener("submit", async (event) => {
  event.preventDefault();

  const userText = promptInput.value.trim();
  if (!userText || isTyping) {
    return;
  }

  stopEmptyStateLoop();
  messages.classList.remove("messages-empty");
  if (messages.querySelector(".empty-state")) {
    messages.innerHTML = "";
  }
  createMessage("user", userText);
  promptInput.value = "";
  resizeTextarea();

  const replyTarget = createMessage("assistant");
  setBusy(true);
  await waitForThinking(replyTarget);
  await typeTokens(replyTarget, buildReply(userText));
  setBusy(false);
  promptInput.focus();
});

promptInput.addEventListener("input", resizeTextarea);

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

function resetChat({ focusInput = true } = {}) {
  stopEmptyStateLoop();
  emptyStateIndex = 0;
  renderEmptyState();
  scheduleEmptyStateRotation();

  if (focusInput) {
    promptInput.focus();
  }
}

newChatButton.addEventListener("click", () => {
  resetChat();
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggleButton.setAttribute("aria-label", theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え");
  localStorage.setItem("chatto-zpt-theme", theme);
}

const savedTheme = localStorage.getItem("chatto-zpt-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
applyTheme(savedTheme || (prefersDark ? "dark" : "light"));

themeToggleButton.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
});

resetChat({ focusInput: false });
