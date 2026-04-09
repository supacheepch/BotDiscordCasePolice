const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
} = require('@discordjs/voice');
const play = require('play-dl');

const queue = new Map();

// ===== INITIALIZE SOUNDCLOUD CLIENT ID =====
async function initSoundCloud() {
  try {
    const clientId = await play.getFreeClientID();
    await play.setToken({
      soundcloud: {
        client_id: clientId
      }
    });
    console.log('✅ SoundCloud Client ID initialized successfully');
  } catch (err) {
    console.error('❌ Failed to initialize SoundCloud token:', err);
  }
}

// เรียกตอนเริ่มโหลด module
initSoundCloud();

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
    let searchResult;
    
    if (isUrl) {
      if (!query.includes('soundcloud.com')) {
         return message.reply('❌ ตอนนี้บอทรองรับเฉพาะ SoundCloud เท่านั้น โปรดส่งลิงก์จาก SoundCloud หรือพิมพ์ชื่อเพลงเพื่อค้นหา');
      }
      searchResult = await play.search(query);
    } else {
      // ค้นหาเพลงใน SoundCloud
      searchResult = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
    }

    if (!searchResult || searchResult.length === 0) {
      return message.reply('❌ ไม่พบเพลงที่ต้องการบน SoundCloud');
    }

    song = { 
      title: searchResult[0].name || searchResult[0].title, 
      url: searchResult[0].url 
    };

  } catch (err) {
    console.error('❌ Error fetching song info:', err);
    return message.reply('❌ เกิดข้อผิดพลาดในการหาเพลงบน SoundCloud');
  }

  if (!song || !song.url) {
    return message.reply('❌ ไม่พบ URL สำหรับเพลงนี้');
  }

  console.log('✅ Found song on SoundCloud:', song);

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

      message.channel.send(`🎶 เริ่มเล่นเพลง: **${song.title}** (SoundCloud)`);
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
    console.log(`🔍 Playing SoundCloud stream: ${song.title} (${song.url})`);

    // ดึง stream จาก SoundCloud ผ่าน play-dl
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });

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
    console.error('❌ Stream Error:', err.message);
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
