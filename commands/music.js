const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  StreamType,
} = require('@discordjs/voice');
const play = require('play-dl');
const ytSearch = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, '../cookies.txt');
const hasCookies = fs.existsSync(COOKIES_PATH);

const queue = new Map();

// ===== PLAY =====
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
    const isUrl = query.startsWith('http://') || query.startsWith('https://');
    if (isUrl) {
      const r = await ytSearch(query);
      song =
        r && r.videos && r.videos.length > 0
          ? { title: r.videos[0].title, url: r.videos[0].url }
          : { title: 'Unknown Track', url: query };
    } else {
      const r = await ytSearch(query);
      if (!r || !r.videos || r.videos.length === 0)
        return message.reply('❌ ไม่พบเพลงที่ต้องการ');
      song = { title: r.videos[0].title, url: r.videos[0].url };
    }
  } catch (err) {
    console.error('❌ Error fetching song info:', err);
    return message.reply('❌ เกิดข้อผิดพลาดในการหาเพลง');
  }

  if (!song || !song.url) {
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
        selfDeaf: false,
        selfMute: false,
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

// ===== STREAM =====
async function playStream(guildId, song) {
  const serverQueue = queue.get(guildId);

  if (!song || !song.url) {
    console.log('🏁 No more songs in queue.');
    setTimeout(() => {
      const q = queue.get(guildId);
      if (q && q.songs.length === 0) {
        if (q.connection) q.connection.destroy();
        queue.delete(guildId);
      }
    }, 30000);
    return;
  }

  try {
    console.log(`🔍 Playing stream: ${song.title} (${song.url})`);

    let resource;

    // Primary: youtube-dl-exec (yt-dlp)
    try {
      if (hasCookies) {
        console.log('🍪 Using cookies.txt for authentication');
      } else {
        console.warn('⚠️  cookies.txt ไม่พบ - อาจถูก YouTube บล็อก');
      }
      console.log('⏳ Trying youtube-dl-exec (yt-dlp)...');

      // ใช้ system yt-dlp ถ้ามี ไม่งั้นใช้ bundle ของ package
      const { create: createYoutubeDl } = require('youtube-dl-exec');
      let ytdlx;
      try {
        // ลองใช้ system yt-dlp ก่อน (ติดตั้งโดย `apt install yt-dlp` หรือ pip)
        const { execSync } = require('child_process');
        execSync('yt-dlp --version', { stdio: 'ignore' });
        ytdlx = createYoutubeDl('yt-dlp'); // ใช้ system binary
        console.log('🔧 Using system yt-dlp binary');
      } catch {
        ytdlx = require('youtube-dl-exec'); // fallback to bundled
        console.log('🔧 Using bundled yt-dlp binary');
      }

      const ytdlxOptions = {
        dumpJson: true,
        format: 'bestaudio',
        noWarnings: true,
        callHome: false,
        noCheckCertificate: true,
        // ลด rate limit โดย add delay ระหว่าง requests
        sleepRequests: 1,
      };

      // ถ้ามี cookies.txt ให้แนบไปด้วยเพื่อแก้ปัญหา YouTube Block
      if (hasCookies) {
        ytdlxOptions.cookies = COOKIES_PATH;
      }

      const output = await ytdlx(song.url, ytdlxOptions);

      if (!output || !output.url) throw new Error('yt-dlp could not find extracted URL');

      console.log('✅ URL extracted via youtube-dl-exec. Starting playback...');
      resource = createAudioResource(output.url, { inputType: StreamType.Arbitrary });

    } catch (ytdlxError) {
      console.error('⚠️ youtube-dl-exec failed:', ytdlxError.message);

      // Fallback 1: ytdl-core
      try {
        console.log('⏳ Trying ytdl-core with custom agent...');
        const agent = ytdl.createAgent();
        const info = await ytdl.getInfo(song.url, { agent });
        let format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        if (!format) throw new Error('No formats found in ytdl-core');

        const stream = ytdl.downloadFromInfo(info, { format, highWaterMark: 1 << 25, agent });
        resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
        console.log('✅ Using ytdl-core');

      } catch (ytdlError) {
        console.error('⚠️ ytdl-core failed:', ytdlError.message);

        // Fallback 2: play-dl
        console.log('⏳ Falling back to play-dl...');
        try {
          const stream = await play.stream(song.url, {
            quality: 2,
            discordPlayer: true,
            extractorArgs: { youtube: { player_client: ['IOS', 'WEB_CREATOR', 'ANDROID'] } },
          });
          resource = createAudioResource(stream.stream, { inputType: stream.type });
          console.log('✅ Using play-dl');
        } catch (playDlError) {
          console.error('❌ play-dl failed:', playDlError.message);
          throw new Error('ระบบถูก YouTube ป้องกัน (Bypass ล้มเหลวทั้งหมด)');
        }
      }
    }

    serverQueue.player.play(resource);

    if (!serverQueue.connection.state.subscription) {
      serverQueue.connection.subscribe(serverQueue.player);
    }

    console.log('▶️ Audio player started.');

    serverQueue.player.removeAllListeners();

    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
      console.log('🏁 Song finished.');
      serverQueue.songs.shift();
      playStream(guildId, serverQueue.songs[0]);
    });

    serverQueue.player.on('error', (error) => {
      console.error(`❌ Audio Player Error: ${error.message}`);
      serverQueue.textChannel.send(`❌ เพลงมีปัญหา ข้ามเพลง: **${song.title}**`);
      serverQueue.songs.shift();
      playStream(guildId, serverQueue.songs[0]);
    });

  } catch (err) {
    console.error('❌ Final Error:', err.message);
    serverQueue.textChannel.send(`❌ เล่นไม่ได้: **${song.title}**\nเหตุผล: ${err.message}`);
    serverQueue.songs.shift();
    playStream(guildId, serverQueue.songs[0]);
  }
}

// ===== SKIP =====
function handleSkip(message) {
  const serverQueue = queue.get(message.guild.id);
  if (!message.member.voice.channel) return message.reply('❌ คุณต้องอยู่ในห้องพูดคุยเพื่อข้ามเพลง!');
  if (!serverQueue) return message.reply('❌ ไม่มีเพลงที่จะข้าม!');

  serverQueue.player.stop();
  message.channel.send('⏭ ข้ามเพลงแล้ว!');
}

// ===== LEAVE =====
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

module.exports = { handlePlay, handleSkip, handleLeave };
