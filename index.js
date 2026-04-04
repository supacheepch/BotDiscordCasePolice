
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
let stats = {};
const memberMap = new Map();



client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (message.content === '!countCase') {
      memberMap.clear();
      await preloadMembers(message.guild);
      countCase(message);
    }
    if (message.content === '!getM') {
      var reply = await message.reply('⏳ กำลังโหลดรายชื่อ...');

      let output = ''
      memberMap.clear();
      await preloadMembers(message.guild); // 👈 โหลดเฉพาะ server นี้
      memberMap.forEach((data, id) => {
        output += `${data.displayName} (${data.username})\n`;
      });

      var sendMsg = message.channel.send(output.slice(0, 2000)); // 👈 กันเกิน limit Discord
      setTimeout(() => {
        sendMsg.delete().catch(() => { });
        reply.delete().catch(() => { });
      }, 10000);

    }
    if (message.content === "!countSelf") {
      memberMap.clear();
      await preloadMembers(message.guild);
      countSelf(message);
    }
  } catch (error) {
    console.error('❌ Error in messageCreate:', error);
    var sendMsg = message.channel.send('❌ เกิดข้อผิดพลาดในระบบ (messageCreate)');
    setTimeout(() => {
      sendMsg.delete().catch(() => { });
    }, 10000);
  }
});

async function countCase(message) {
  try {
    var reply = await message.reply('⏳ กำลังนับข้อมูล...');

    const guild = message.guild;
    const channel = message.channel
    if (!channel) {
      var reply_error = await message.reply('❌ Channel not found');
      setTimeout(() => {
        reply_error.delete().catch(() => { });
      }, 10000);
      return;
    }

    const stats = await loadStats(channel);

    // 🔹 สร้างข้อความ
    let text = '📊 **Case Summary**\n';

    for (const [id, data] of Object.entries(stats)) {
      text += `${data.displayName} | Posts: ${data.posts} | Tagged: ${data.tagged} | Sum: ${data.posts + data.tagged} \n`;
    }

    var sendMsg = await message.channel.send(text);
    setTimeout(() => {
      sendMsg.delete().catch(() => { });
    }, 10000);

    // 🔹 export excel (optional)
    const filePath = await exportExcel(stats);
    var sendMsg = await message.channel.send({
      content: '📁 Export Excel',
      files: [filePath],
    });
    setTimeout(() => {
      sendMsg.delete().catch(() => { });

    }, 10000);
  } catch (error) {
    console.error('❌ Error in countCase:', error);
    var sendMsg = message.channel.send('❌ เกิดข้อผิดพลาดในการนับเคส (countCase)');
    setTimeout(() => {
      sendMsg.delete().catch(() => { });
      reply.delete().catch(() => { });
    }, 10000);
  }
}



// 🔥 main function
async function loadStats(channel) {
  try {
    let stats = {};
    let lastId;
    let fetched;

    do {
      fetched = await channel.messages.fetch({
        limit: 100,
        before: lastId,
      });

      for (const message of fetched.values()) {
        if (message.author.bot) continue;

        const content = message.content;

        if (isCommand(content)) continue;

        const authorId = message.author.id;

        const displayName = getDisplayName(
          authorId,
          message.author.username
        );

        // ✅ init author
        if (!stats[authorId]) {
          stats[authorId] = {
            username: message.author.username,
            displayName: displayName,
            posts: 0,
            tagged: 0
          };
        }

        // ✅ ตรวจ post
        const mentionTags = content.match(/<@!?(\d+)>/g);
        const hasAttachment = message.attachments.size > 0;

        if (mentionTags || hasAttachment) {
          stats[authorId].posts++;
        }

        // ✅ นับคนโดนแท็ก
        if (mentionTags) {
          for (const match of mentionTags) {
            const id = match.replace(/<@!?/, '').replace('>', '');
            const user = message.mentions.users.get(id);

            if (!user) continue;

            const targetDisplayName = getDisplayName(
              id,
              user.username
            );

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
        }
      }

      lastId = fetched.last()?.id;

    } while (fetched.size === 100);

    return stats;
  } catch (error) {
    console.error('❌ Error in loadStats:', error);
    throw error; // throw data to handler
  }
}


async function exportExcel(stats) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Posts', key: 'posts', width: 10 },
      { header: 'Tagged', key: 'tagged', width: 10 },
      { header: 'Total', key: 'total', width: 10 },
    ];

    for (const id in stats) {
      const data = stats[id];

      sheet.addRow({
        name: data.displayName, // ✅ ใช้ชื่อแสดงผล
        posts: data.posts,
        tagged: data.tagged,
        total: data.posts + data.tagged,
      });
    }

    const filePath = './report.xlsx';
    await workbook.xlsx.writeFile(filePath);

    return filePath;
  } catch (error) {
    console.error('❌ Error in exportExcel:', error);
    throw error;
  }
}

async function preloadMembers(guild) {
  const members = await guild.members.fetch(); // 👈 โหลดทั้ง server

  members.forEach(member => {
    memberMap.set(member.id, {
      displayName: member.displayName,
      username: member.user.username
    });
  });

  console.log(`✅ Loaded members: ${memberMap.size}`);
}

async function countSelf(message) {
  try {
    var reply = await message.reply('⏳ กำลังนับข้อมูล...');
    const userId = message.author.id;

    const displayName = getDisplayName(
      userId,
      message.author.username
    );
    let stats = {
      displayName: displayName,
      posts: 0,
      tagged: 0,
      selfMention: 0
    };

    let lastId;
    let fetched;

    do {
      fetched = await message.channel.messages.fetch({
        limit: 100,
        before: lastId,
      });

      for (const msg of fetched.values()) {

        // 🔥 นับเฉพาะข้อความของ "เรา" (self post)
        if (msg.author.id === userId) {
          const hasAttachment = msg.attachments.size > 0;
          const mentionTags = msg.content.match(/<@!?(\d+)>/g);

          // ✅ เราโพสต์ + มีรูป
          if (hasAttachment) {
            stats.posts++;
          }

          // (optional) ถ้าจะนับโพสต์ที่มี mention ด้วย
          // if (mentionTags) { ... }
        }

        // 🔥 นับคนอื่นที่ tag เรา
        const mentionTags = msg.content.match(/<@!?(\d+)>/g);

        if (mentionTags) {
          for (const tag of mentionTags) {
            const id = tag.replace(/<@!?/, "").replace(">", "");

            if (id === userId) {
              stats.tagged++;
            }
          }
        }
      }

      lastId = fetched.last()?.id;

    } while (fetched.size === 100);

    var sendMsg = await message.channel.send(
      `📊 Case Self Report ${displayName}\n` +
      `Posts: ${stats.posts}\n` +
      `Tagged: ${stats.tagged}\n` +
      `Self Mention: ${stats.selfMention}`
    );
    setTimeout(() => {
      sendMsg.delete().catch(() => { });

    }, 10000);
  } catch (error) {
    console.error('❌ Error in countSelf:', error);
    var sendMsg = message.channel.send('❌ เกิดข้อผิดพลาดในการนับ (countqSelf)');
    setTimeout(() => {
      sendMsg.delete().catch(() => { });
    }, 10000);
  }
  finally {
    reply.delete().catch(() => { });
  }
}

// 🔥 helper ดึงชื่อ
function getDisplayName(userId, fallbackUsername = "Unknown User") {
  const userData = memberMap.get(userId);
  return userData ? userData.displayName : fallbackUsername;
}
function isCommand(content) {
  return content.startsWith('!');
}
// ===== ERROR HANDLING =====
client.on('error', console.error);
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// ===== LOGIN =====
client.login(TOKEN);