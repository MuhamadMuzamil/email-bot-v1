const Imap = require("imap");
const { simpleParser } = require("mailparser");
const { Telegraf } = require("telegraf");

// ====== CONFIGURATION ======
const TOKEN = process.env.TOKEN;
const CHAT_ID = process.env.CHAT_ID;

let dailyCount = 0;
const startTime = Date.now();
const activeConnections = new Set();
const bot = new Telegraf(TOKEN);

// ====== TELEGRAM COMMANDS ======
bot.command("status", (ctx) => {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    ctx.replyWithMarkdown(
        `🚀 **Bot Status Report**\n\n` +
        `✅ **Status:** Active\n` +
        `📧 **Active Inboxes:** ${activeConnections.size}\n` +
        `📬 **Emails Today:** ${dailyCount}\n` +
        `⏳ **Uptime:** ${hours}h ${minutes}m`
    );
});

bot.launch();

// ====== EMAIL LOGIC ======
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

                            const summary = parsed.text ? parsed.text.substring(0, 200).replace(/\n/g, " ") + "..." : "No text content";
                            const text = `📩 **New Email!**\n\n` +
                                `📥 **To:** ${email}\n` +
                                `👤 **From:** ${parsed.from.text}\n` +
                                `📝 **Subject:** ${parsed.subject}\n\n` +
                                `📖 **Summary:** ${summary}`;

                            // 1. Send the text notification
                            await bot.telegram.sendMessage(CHAT_ID, text, { parse_mode: "Markdown" });

                            // 2. NEW: Attachment Handler
                            if (parsed.attachments && parsed.attachments.length > 0) {
                                for (const att of parsed.attachments) {
                                    console.log(`📎 Sending attachment: ${att.filename}`);
                                    await bot.telegram.sendDocument(CHAT_ID, {
                                        source: att.content, // The file data
                                        filename: att.filename // The original name
                                    }, {
                                        caption: `📎 Attachment from: ${parsed.subject}`
                                    }).catch(e => console.log("Telegram Attach Error:", e.message));
                                }
                            }
                        });
                    });
                });
            });
        });
    });

    imap.on("error", (err) => activeConnections.delete(email));
    imap.on("close", () => {
        activeConnections.delete(email);
        setTimeout(() => imap.connect(), 30000);
    });

    imap.connect();
}

const emailList = [
    { user: process.env.EMAIL, pass: process.env.APP_PASSWORD },
    { user: process.env.EMAIL2, pass: process.env.PASS2 },
    { user: process.env.EMAIL3, pass: process.env.PASS3 },
    { user: process.env.EMAIL4, pass: process.env.PASS4 },
    { user: process.env.EMAIL5, pass: process.env.PASS5 }
];

emailList.forEach(acc => connectEmail(acc.user, acc.pass));

setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) dailyCount = 0;
}, 60000);