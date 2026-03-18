const Imap = require("imap");
const { simpleParser } = require("mailparser");
const { Telegraf } = require("telegraf");

// ====== CONFIGURATION ======
const TOKEN = process.env.TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Trackers
let dailyCount = 0;
const startTime = Date.now();
const activeConnections = new Set();

const bot = new Telegraf(TOKEN);

// ====== TELEGRAM COMMANDS ======
bot.command("status", (ctx) => {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    const statusMsg = `🚀 **Bot Status Report**\n\n` +
        `✅ **Status:** Active\n` +
        `📧 **Active Inboxes:** ${activeConnections.size}\n` +
        `📬 **Emails Processed Today:** ${dailyCount}\n` +
        `⏳ **Uptime:** ${hours}h ${minutes}m\n\n` +
        `_Note: If connection is lost, Railway will auto-restart the process._`;

    ctx.replyWithMarkdown(statusMsg);
});

// Start Telegram Bot
bot.launch();
console.log("🤖 Telegram Bot command listener started");

// ====== MULTI-EMAIL LOGIC ======
function connectEmail(email, password) {
    if (!email || !password) return;

    const imap = new Imap({
        user: email,
        password: password,
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
        console.log(`✅ Connected: ${email}`);
        activeConnections.add(email);
        
        imap.openBox("INBOX", false, (err, box) => {
            if (err) return;

            imap.on("mail", () => {
                const f = imap.seq.fetch(box.messages.total + ":*", { bodies: "" });
                f.on("message", (msg) => {
                    msg.on("body", (stream) => {
                        simpleParser(stream, async (err, parsed) => {
                            if (err) return;
                            dailyCount++;

                            // Create a short summary (first 200 characters)
                            const summary = parsed.text ? parsed.text.substring(0, 200).replace(/\n/g, " ") + "..." : "No text content";

                            const text = `📩 **New Email Alert!**\n\n` +
                                `📥 **To Inbox:** ${email}\n` +
                                `👤 **From:** ${parsed.from.text}\n` +
                                `📝 **Subject:** ${parsed.subject}\n\n` +
                                `📖 **Summary:** ${summary}`;

                            bot.telegram.sendMessage(CHAT_ID, text, { parse_mode: "Markdown" });
                        });
                    });
                });
            });
        });
    });

    imap.on("error", (err) => {
        console.log(`❌ Error [${email}]:`, err.message);
        activeConnections.delete(email);
    });

    imap.on("close", () => {
        console.log(`🔌 Connection closed [${email}]. Reconnecting in 30s...`);
        activeConnections.delete(email);
        setTimeout(() => imap.connect(), 30000); // Auto-reconnect script
    });

    imap.connect();
}

// Initialize all accounts (Add EMAIL2, EMAIL3 etc. in Railway)
const emailList = [
    { user: process.env.EMAIL, pass: process.env.APP_PASSWORD },
    { user: process.env.EMAIL2, pass: process.env.PASS2 },
    { user: process.env.EMAIL3, pass: process.env.PASS3 },
    { user: process.env.EMAIL4, pass: process.env.PASS4 },
    { user: process.env.EMAIL5, pass: process.env.PASS5 }
];

emailList.forEach(acc => connectEmail(acc.user, acc.pass));

// Reset counter at midnight
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) dailyCount = 0;
}, 60000);

// Global Error Handling to prevent crashing
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled Rejection:", err));