// =================== FINAL WORKING BOT ===================

// Global error handler
process.on("unhandledRejection", (err) => {
  console.log("Unhandled Error:", err?.message || err);
});

// Import required modules
const Imap = require("imap");
const { simpleParser } = require("mailparser");
const https = require("https");
const fetch = require("node-fetch");

// ====== CONFIGURATION ======
const TOKEN = process.env.TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const EMAIL = process.env.EMAIL;
const APP_PASSWORD = process.env.APP_PASSWORD;
// Function to send Telegram messages with SSL fix
function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

  const agent = new https.Agent({
    rejectUnauthorized: false, // <-- FIX SSL ECONNRESET
  });

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: text,
    }),
    agent: agent, // <-- pass the agent
  })
    .then(res => res.json())
    .then(data => console.log("✅ Message sent"))
    .catch(err => console.log("❌ Telegram Error:", err.message));
}

// ====== GMAIL CONFIG ======
const imap = new Imap({
  user: EMAIL,
  password: APP_PASSWORD,
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
});

// Function to open inbox
function openInbox(cb) {
  imap.openBox("INBOX", false, cb);
}

// IMAP ready event
imap.once("ready", function () {
  console.log("✅ Connected to Gmail");

  openInbox(function (err, box) {
    if (err) throw err;

    // Listen for new mail
    imap.on("mail", function () {
      console.log("📩 New mail detected");

      const imapFetch = imap.seq.fetch(box.messages.total + ":*", {
        bodies: "",
      });

      imapFetch.on("message", function (msg) {
        msg.on("body", function (stream) {
          simpleParser(stream, async (err, parsed) => {
            if (err) return;

            const text = `
📩 New Email!

From: ${parsed.from.text}
Subject: ${parsed.subject}
`;

            // Send message to Telegram
            sendTelegramMessage(text);
          });
        });
      });
    });
  });
});

// Connect to Gmail
imap.connect();