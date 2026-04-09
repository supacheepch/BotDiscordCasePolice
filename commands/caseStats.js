const ExcelJS = require('exceljs');
const { memberMap, preloadMembers, getDisplayName, isCommand } = require('../utils/helpers');

// ===== CASE COMMANDS =====

async function countCase(message) {
  try {
    var reply = await message.reply('⏳ กำลังนับข้อมูล...');

    const channel = message.channel;
    if (!channel) {
      await message.reply('❌ Channel not found');
      return;
    }

    const stats = await loadStats(channel);

    let text = '📊 **Case Summary**\n';
    for (const [id, data] of Object.entries(stats)) {
      text += `${data.displayName} | Posts: ${data.posts} | Tagged: ${data.tagged} | Sum: ${data.posts + data.tagged} \n`;
    }

    await message.channel.send(text);

    const filePath = await exportExcel(stats);
    await message.channel.send({
      content: '📁 Export Excel',
      files: [filePath],
    });
  } catch (error) {
    console.error('❌ Error in countCase:', error);
    message.channel.send('❌ เกิดข้อผิดพลาดในการนับเคส (countCase)');
  }
}

async function loadStats(channel) {
  try {
    let stats = {};
    let lastId;
    let fetched;

    do {
      fetched = await channel.messages.fetch({ limit: 100, before: lastId });

      for (const message of fetched.values()) {
        if (message.author.bot) continue;

        const content = message.content;
        if (isCommand(content)) continue;

        const authorId = message.author.id;
        const displayName = getDisplayName(authorId, message.author.username);

        if (!stats[authorId]) {
          stats[authorId] = {
            username: message.author.username,
            displayName: displayName,
            posts: 0,
            tagged: 0,
          };
        }

        const mentionTags = content.match(/<@!?(\d+)>/g);
        const hasAttachment = message.attachments.size > 0;

        if (mentionTags || hasAttachment) {
          stats[authorId].posts++;
        }

        if (mentionTags) {
          for (const match of mentionTags) {
            const id = match.replace(/<@!?/, '').replace('>', '');
            const user = message.mentions.users.get(id);
            if (!user) continue;

            const targetDisplayName = getDisplayName(id, user.username);

            if (!stats[id]) {
              stats[id] = {
                username: user.username,
                displayName: targetDisplayName,
                posts: 0,
                tagged: 0,
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
    throw error;
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
        name: data.displayName,
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

async function countSelf(message) {
  try {
    await message.reply('⏳ กำลังนับข้อมูล...');
    const userId = message.author.id;
    const displayName = getDisplayName(userId, message.author.username);

    let stats = { displayName, posts: 0, tagged: 0, selfMention: 0 };
    let lastId;
    let fetched;

    do {
      fetched = await message.channel.messages.fetch({ limit: 100, before: lastId });

      for (const msg of fetched.values()) {
        if (msg.author.id === userId) {
          if (msg.attachments.size > 0) stats.posts++;
        }

        const mentionTags = msg.content.match(/<@!?(\d+)>/g);
        if (mentionTags) {
          for (const tag of mentionTags) {
            const id = tag.replace(/<@!?/, '').replace('>', '');
            if (id === userId) stats.tagged++;
          }
        }
      }

      lastId = fetched.last()?.id;
    } while (fetched.size === 100);

    await message.channel.send(
      `📊 Case Self Report ${displayName}\n` +
      `Posts: ${stats.posts}\n` +
      `Tagged: ${stats.tagged}\n` +
      `Self Mention: ${stats.selfMention}`
    );
  } catch (error) {
    console.error('❌ Error in countSelf:', error);
    message.channel.send('❌ เกิดข้อผิดพลาดในการนับ (countSelf)');
  }
}

module.exports = { countCase, countSelf };
