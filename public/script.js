const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
const socket = new WebSocket(`${protocol}://${location.host}`);


const characterEl = document.getElementById("character");
const statsEl = document.getElementById("stats");
const aiSpeechEl = document.getElementById("aiSpeech");
const confettiCanvas = document.getElementById("confettiCanvas");
const ctx = confettiCanvas.getContext("2d");

let character = {};
let typingTimeout = null;

// Resize canvas
function resizeCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Confetti particles
let confettiParticles = [];
function createConfetti() {
  for (let i = 0; i < 100; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * confettiCanvas.height - confettiCanvas.height,
      r: Math.random() * 6 + 4,
      d: Math.random() * 50 + 50,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`,
      tilt: Math.random() * 10 - 10,
      tiltAngleIncrement: Math.random() * 0.07 + 0.05,
      tiltAngle: 0,
    });
  }
}

function drawConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiParticles.forEach((p) => {
    ctx.beginPath();
    ctx.lineWidth = p.r / 2;
    ctx.strokeStyle = p.color;
    ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
    ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
    ctx.stroke();

    p.tiltAngle += p.tiltAngleIncrement;
    p.y += (Math.cos(p.tiltAngle) + p.r / 2) / 2;
    p.x += Math.sin(p.tiltAngle) / 2;

    if (p.y > confettiCanvas.height) {
      p.y = -10;
      p.x = Math.random() * confettiCanvas.width;
    }
  });
  requestAnimationFrame(drawConfetti);
}

function triggerConfetti() {
  createConfetti();

  // Emoji burst
  const emojis = ["🎉","💖","✨","🔥"];
  for (let i = 0; i < 10; i++) {
    const span = document.createElement("span");
    span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    span.style.position = "absolute";
    span.style.left = `${Math.random() * window.innerWidth}px`;
    span.style.top = `${Math.random() * window.innerHeight}px`;
    span.style.fontSize = `${Math.random() * 30 + 20}px`;
    document.body.appendChild(span);
    setTimeout(() => document.body.removeChild(span), 3000);
  }

  drawConfetti();
  setTimeout(() => {
    confettiParticles = [];
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }, 4000);
}

// WebSocket message
socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "init" || msg.type === "update") {
    character = msg.data;
    updateCharacter(msg.type === "update");
  }

  if (msg.type === "update" && character.mood === "happy") {
    triggerConfetti();
  }
};

// Update character display
function updateCharacter(isUpdate = false) {
  let emoji = "🤖";
  if (character.mood === "happy") emoji = "😄";
  if (character.mood === "angry") emoji = "😠";
  if (character.mood === "curious") emoji = "🤔";
  if (character.mood === "excited") emoji = "🤩";

  // Scale based on level
  const baseSize = 100;
  const scale = Math.min(baseSize + character.level * 10, 300);
  characterEl.style.fontSize = `${scale}px`;

  characterEl.textContent = emoji;
  statsEl.textContent = `Level: ${character.level} | Mood: ${character.mood}`;

  if (isUpdate) typeWriter(character.lastMessage);
}

// Typing effect for AI messages
function typeWriter(text) {
  aiSpeechEl.textContent = "";
  let index = 0;

  if (typingTimeout) clearTimeout(typingTimeout);

  function typeNext() {
    if (index < text.length) {
      aiSpeechEl.textContent += text.charAt(index);
      index++;
      typingTimeout = setTimeout(typeNext, 30);
    }
  }

  typeNext();

  if ("speechSynthesis" in window) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.pitch = 1.2;
    utter.rate = 1;
    speechSynthesis.speak(utter);
  }
}
