import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { Groq } from "groq-sdk";
import 'dotenv/config';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);

const wss = new WebSocketServer({ server });

// ---------------- Groq Client ----------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ---------------- Character State ----------------
let character = {
  name: "Aiko",
  level: 1,
  mood: "neutral",
  lastMessage: "Ready to play!",
};

// ---------------- AI Response Function ----------------
let recentCommands = [];

async function generateAIResponse(prompt) {
  try {
    const repeatCount = recentCommands.filter(cmd => cmd === prompt).length;
    recentCommands.push(prompt);
    if (recentCommands.length > 5) recentCommands.shift();

    const repetitionNote = repeatCount > 0
      ? `Add a funny twist because viewer repeated this command ${repeatCount} time(s).`
      : '';

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `
You are ${character.name}, a funny and reactive AI character.
React to viewer commands with:
- Short emotional response
- Playful Tagalog joke or mild curse
- Keep it fun and engaging for live viewers
${repetitionNote}
Viewer says: "${prompt}"
Character current mood: ${character.mood}, Level: ${character.level}
Respond in 1-2 sentences max.
`,
        },
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 1,
      max_completion_tokens: 150,
      top_p: 1,
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of chatCompletion) {
      fullResponse += chunk.choices[0]?.delta?.content || "";
    }

    return fullResponse || "Hmm… I have no words right now!";
  } catch (err) {
    console.error(err);
    return "Oops! My circuits got tangled. 😅";
  }
}

// ---------------- WebSocket Broadcast ----------------
function broadcastCharacter() {
  wss.clients.forEach((client) => {
    client.send(JSON.stringify({ type: "update", data: character }));
  });
}

// ---------------- TikTok Live Integration ----------------
const tiktokUsername = process.env.TIKTOK_USERNAME;
const tiktokLive = new TikTokLiveConnection(tiktokUsername);

tiktokLive.connect()
  .then(() => console.log(`Connected to TikTok Live: ${tiktokUsername}`))
  .catch(err => console.error("TikTok connection failed:", err));
// Handle gifts
tiktokLive.on(WebcastEvent.GIFT, (data) => {
  console.log(`Gift: ${data.giftName} x${data.repeatCount} from ${data.user.uniqueId}`);

  character.level += data.repeatCount || 1;
  character.mood = "happy";
  character.lastMessage = `Thank you ${data.user.uniqueId} for sending ${data.giftName}! 🎉`;

  broadcastCharacter();
});

// Handle chat messages
tiktokLive.on(WebcastEvent.CHAT, async (data) => {
  console.log(`${data.user.uniqueId}: ${data.comment}`);
  
  const userMessage = data.comment.toLowerCase();

  // Mood updates based on chat content
  if (userMessage.includes("gift")) {
    character.level++;
    character.mood = "happy";
  } else if (userMessage.includes("angry")) {
    character.mood = "angry";
  } else if (userMessage.includes("yay") || userMessage.includes("wow")) {
    character.mood = "excited";
  } else {
    character.mood = "curious";
  }

  // Generate AI response
  const aiReply = await generateAIResponse(userMessage);
  character.lastMessage = aiReply;

  broadcastCharacter();
});

// ---------------- WebSocket init ----------------
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "init", data: character }));
});
