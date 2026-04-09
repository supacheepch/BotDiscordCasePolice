
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection, StreamType } = require('@discordjs/voice');
const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
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
    GatewayIntentBits.GuildVoiceStates,
  ],
});
let stats = {};
const memberMap = new Map();
const queue = new Map(); // Music queue map: guildId -> { textChannel, voiceChannel, connection, songs, player, playing }

// Disable yt-dlp in play-dl to avoid path issues on Windows if needed
// (Removed as it caused a crash, fallback logic is already implemented)



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
      // setTimeout(() => {
      //   sendMsg.delete().catch(() => { });
      //   reply.delete().catch(() => { });
      // }, 10000);

    }
    if (message.content === "!countSelf") {
      memberMap.clear();
      await preloadMembers(message.guild);
      countSelf(message);
    }

    // ===== MUSIC COMMANDS =====
    const args = message.content.split(' ');
    const command = args[0];

    if (command === '!play') {
      handlePlay(message, args);
    } else if (command === '!skip') {
      handleSkip(message);
    } else if (command === '!leave') {
      handleLeave(message);
    }
  } catch (error) {
    console.error('❌ Error in messageCreate:', error);
    var sendMsg = message.channel.send('❌ เกิดข้อผิดพลาดในระบบ (messageCreate)');
    // setTimeout(() => {
    //   sendMsg.delete().catch(() => { });
    // }, 10000);
  }
});

async function countCase(message) {
  try {
    var reply = await message.reply('⏳ กำลังนับข้อมูล...');

    const guild = message.guild;
    const channel = message.channel
    if (!channel) {
      var reply_error = await message.reply('❌ Channel not found');
      // setTimeout(() => {
      //   reply_error.delete().catch(() => { });
      // }, 10000);
      return;
    }

    const stats = await loadStats(channel);

    // 🔹 สร้างข้อความ
    let text = '📊 **Case Summary**\n';

    for (const [id, data] of Object.entries(stats)) {
      text += `${data.displayName} | Posts: ${data.posts} | Tagged: ${data.tagged} | Sum: ${data.posts + data.tagged} \n`;
    }

    var sendMsg_1 = await message.channel.send(text);
    // setTimeout(() => {
    //   sendMsg_1.delete().catch(() => { });
    // }, 10000);

    // 🔹 export excel (optional)
    const filePath = await exportExcel(stats);
    var sendMsg = await message.channel.send({
      content: '📁 Export Excel',
      files: [filePath],
    });
    // setTimeout(() => {
    //   sendMsg.delete().catch(() => { });

    // }, 10000);
  } catch (error) {
    console.error('❌ Error in countCase:', error);
    var sendMsg = message.channel.send('❌ เกิดข้อผิดพลาดในการนับเคส (countCase)');
    // setTimeout(() => {
    //   sendMsg.delete().catch(() => { });
    //   reply.delete().catch(() => { });
    // }, 10000);
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
    // setTimeout(() => {
    //   sendMsg.delete().catch(() => { });

    // }, 10000);
  } catch (error) {
    console.error('❌ Error in countSelf:', error);
    var sendMsg = message.channel.send('❌ เกิดข้อผิดพลาดในการนับ (countqSelf)');
    // setTimeout(() => {
    //   sendMsg.delete().catch(() => { });
    // }, 10000);
  }
  finally {
    // reply.delete().catch(() => { });
  }
}

// ===== MUSIC LOGIC =====

async function handlePlay(message, args) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply('❌ คุณต้องอยู่ในห้องพูดคุยก่อน!');

  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has('Connect') || !permissions.has('Speak')) {
    return message.reply('❌ ฉันไม่มีสิทธิ์ในการเข้าหรือพูดในห้องนี้!');
  }

  const query = args.slice(1).join(' ');
  if (!query) return message.reply('❌ โปรดใส่ชื่อเพลงหรือลิงก์!');

  let serverQueue = queue.get(message.guild.id);

  let song = null;
  try {
    const validation = await play.yt_validate(query);
    console.log(`🔍 Validation result: ${validation}`);

    if (validation === 'video') {
      const info = await play.video_info(query);
      song = {
        title: info.video_details.title,
        url: info.video_details.url || info.video_details.link
      };
    } else {
      const res = await play.search(query, { limit: 1 });
      if (!res || res.length === 0) return message.reply('❌ ไม่พบเพลงที่ต้องการ');
      song = {
        title: res[0].title,
        url: res[0].url || res[0].link
      };
    }
  } catch (err) {
    console.error('❌ Error fetching song info:', err);
    return message.reply('❌ เกิดข้อผิดพลาดในการหาเพลง');
  }

  if (!song || !song.url) {
    console.error('❌ Song URL is undefined:', song);
    return message.reply('❌ ไม่พบ URL สำหรับเพลงนี้');
  }

  console.log('✅ Found song:', song);

  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      player: createAudioPlayer(),
      playing: true,
    };

    queue.set(message.guild.id, queueContruct);
    queueContruct.songs.push(song);

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      queueContruct.connection = connection;

      connection.on(VoiceConnectionStatus.Ready, () => {
        console.log('✅ Voice connection is ready!');
        playStream(message.guild.id, queueContruct.songs[0]);
      });

      connection.on('error', (err) => {
        console.error('❌ Voice connection error:', err);
      });

      message.channel.send(`🎶 เริ่มเล่นเพลง: **${song.title}**`);
    } catch (err) {
      console.error(err);
      queue.delete(message.guild.id);
      return message.channel.send(`❌ ไม่สามารถเข้าห้องเพลงได้: ${err.message}`);
    }
  } else {
    serverQueue.songs.push(song);
    return message.channel.send(`✅ เพิ่มเพลง **${song.title}** เข้าคิวแล้ว!`);
  }
}

async function playStream(guildId, song) {
  const serverQueue = queue.get(guildId);
  if (!song || !song.url) {
    console.log('🏁 No more songs or invalid song object.');
    // wait a bit before leaving if no more songs
    setTimeout(() => {
      const q = queue.get(guildId);
      if (q && q.songs.length === 0) {
        if (q.connection) q.connection.destroy();
        queue.delete(guildId);
      }
    }, 30000); // 30 seconds idle
    return;
  }

  try {
    console.log(`🔍 Playing stream: ${song.title} (${song.url})`);

    let resource;
    try {
      // Try play-dl with discordPlayer optimization
      const stream = await play.stream(song.url, {
        quality: 2,
        discordPlayer: true,
        extractorArgs: {
          youtube: {
            player_client: ["IOS", "ANDROID", "WEB"]
          }
        }
      });
      resource = createAudioResource(stream.stream, {
        inputType: stream.type,
      });
    } catch (playDlError) {
      console.error('⚠️ play-dl failed, trying ytdl-core fallback...', playDlError.message);

      // 🔥 fallback ยังใช้ได้ (บางเคส)
      const info = await ytdl.getInfo(song.url);
      const format = ytdl.chooseFormat(info.formats, {
        quality: 'highestaudio',
        filter: 'audioonly'
      });

      if (!format || !format.url) {
        throw new Error('Failed to find any playable audio formats');
      }

      resource = createAudioResource(format.url, {
        inputType: StreamType.Arbitrary,
      });
    }

    serverQueue.player.play(resource);
    serverQueue.connection.subscribe(serverQueue.player);

    console.log('▶️ Audio player started.');

    // Remove old listeners to avoid memory leaks and skipped songs
    serverQueue.player.removeAllListeners(AudioPlayerStatus.Idle);
    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
      console.log('🏁 Song finished.');
      serverQueue.songs.shift();
      playStream(guildId, serverQueue.songs[0]);
    });

    serverQueue.player.removeAllListeners('error');
    serverQueue.player.on('error', error => {
      console.error(`❌ Audio Player Error: ${error.message}`);
      serverQueue.songs.shift();
      playStream(guildId, serverQueue.songs[0]);
    });

  } catch (err) {
    console.error('❌ Final Error playing stream:', err.message);
    serverQueue.songs.shift();
    playStream(guildId, serverQueue.songs[0]);
  }
}

function handleSkip(message) {
  const serverQueue = queue.get(message.guild.id);
  if (!message.member.voice.channel) return message.reply('❌ คุณต้องอยู่ในห้องพูดคุยเพื่อข้ามเพลง!');
  if (!serverQueue) return message.reply('❌ ไม่มีเพลงที่จะข้าม!');

  serverQueue.player.stop();
  message.channel.send('⏭ ข้ามเพลงแล้ว!');
}

function handleLeave(message) {
  const serverQueue = queue.get(message.guild.id);
  if (!message.member.voice.channel) return message.reply('❌ คุณต้องอยู่ในห้องพูดคุยเพื่อให้ฉันออก!');

  if (serverQueue) {
    serverQueue.songs = [];
    serverQueue.player.stop();
    if (serverQueue.connection) serverQueue.connection.destroy();
    queue.delete(message.guild.id);
  } else {
    const connection = getVoiceConnection(message.guild.id);
    if (connection) connection.destroy();
  }

  message.channel.send('👋 บ๊ายบาย! ออกจากห้องแล้ว');
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