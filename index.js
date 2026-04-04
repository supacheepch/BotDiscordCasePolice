const { Client, GatewayIntentBits } = require('discord.js');
const ExcelJS = require('exceljs');
require('dotenv').config();
// ===== CONFIG =====


const TOKEN = process.env.DISCORD_TOKEN;

const allowedNames = ['BaeJu', 'CasePolice', 'Boss'];
// ===== CREATE CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});
let stats = {}; // ✅ ต้องมีตัวนี้


client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!countCase') {
    // const name = message.member?.displayName || message.author.username;

    // if (!allowedNames.includes(name)) {
    //   return message.reply('❌ ทำรัยวัยรุ่นรีบหรอ');
    // }

    countCase(message);
  }

});

async function countCase(message) {
  await message.reply('⏳ กำลังนับข้อมูล...');

  const guild = message.guild;
  // const channel = guild.channels.cache.get('1485010954981867710');
  const channel = message.channel
  if (!channel) {
    return message.reply('❌ Channel not found');
  }

  const stats = await loadStats(channel);

  // 🔹 สร้างข้อความ
  let text = '📊 **Case Summary**\n';

  for (const [id, data] of Object.entries(stats)) {
    text += `- ${data.displayName} | Posts: ${data.posts} | Tagged: ${data.tagged}\n | Sum: ${data.posts + data.tagged} \n`;
  }

  await message.channel.send(text);

  // 🔹 export excel (optional)
  const filePath = await exportExcel(stats);
  await message.channel.send({
    content: '📁 Export Excel',
    files: [filePath],
  });
}

async function loadStats(channel) {
  let stats = {};
  let lastId;
  let fetched;

  do {
    fetched = await channel.messages.fetch({
      limit: 100,
      before: lastId,
    });

    fetched.forEach((message) => {
      if (message.author.bot) return;

      const content = message.content;

      // ❌ ข้าม command
      if (isCommand(content)) return;

      const authorId = message.author.id;

      // ดึง member (เพื่อใช้ displayName)
      // const member = message.guild.members.cache.get(authorId);
      const member = message.guild.members.cache.get(authorId);
      const displayName = member?.displayName || message.author.username;

      // ✅ init author
      if (!stats[authorId]) {
        stats[authorId] = {
          username: message.author.username,
          displayName: displayName,
          posts: 0,
          tagged: 0
        };
      }

      // ✅ ตรวจ mention / attachment
      const mentionTags = content.match(/<@!?(\d+)>/g);
      const hasAttachment = message.attachments.size > 0;

      if (mentionTags || hasAttachment) {
        stats[authorId].posts++;
      }

      // ✅ นับคนโดนแท็ก
      if (mentionTags) {
        mentionTags.forEach((match) => {
          const id = match.replace(/<@!?/, '').replace('>', '');
          const user = message.mentions.users.get(id);

          if (user) {
            const targetMember = message.guild.members.cache.get(id);
            const targetDisplayName =
              targetMember?.displayName || user.username;

            // init target
            if (!stats[id]) {
              stats[id] = {
                username: user.username,
                displayName: targetDisplayName,
                posts: 0,
                tagged: 0
              };
            }

            stats[id].tagged++;
          }
        });
      }
    });

    lastId = fetched.last()?.id;

  } while (fetched.size === 100);

  return stats;
}

function isCommand(content) {
  return content.startsWith('!');
}

async function exportExcel(stats) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');

  sheet.columns = [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Posts', key: 'posts', width: 10 },
    { header: 'Tagged', key: 'tagged', width: 10 },
  ];

  for (const id in stats) {
    const data = stats[id];

    sheet.addRow({
      name: data.displayName, // ✅ ใช้ชื่อแสดงผล
      posts: data.posts,
      tagged: data.tagged,
    });
  }

  const filePath = './report.xlsx';
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

// ===== LOGIN =====
client.login(TOKEN);