const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const { memberMap, preloadMembers } = require('./utils/helpers');
const { countCase, countSelf } = require('./commands/caseStats');
const { handlePlay, handleSkip, handleLeave } = require('./commands/music_sc');

// ===== CONFIG =====
const TOKEN = process.env.DISCORD_TOKEN;

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

// ===== EVENTS =====
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0];

    // ===== CASE COMMANDS =====
    if (message.content === '!countCase') {
      memberMap.clear();
      await preloadMembers(message.guild);
      countCase(message);
    }

    if (message.content === '!getM') {
      await message.reply('⏳ กำลังโหลดรายชื่อ...');
      let output = '';
      memberMap.clear();
      await preloadMembers(message.guild);
      memberMap.forEach((data) => {
        output += `${data.displayName} (${data.username})\n`;
      });
      message.channel.send(output.slice(0, 2000));
    }

    if (message.content === '!countSelf') {
      memberMap.clear();
      await preloadMembers(message.guild);
      countSelf(message);
    }

    // ===== HELP =====
    if (command === '!help') {
      const helpEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 รายการคำสั่งของบอท')
        .setDescription('นี่คือคำสั่งทั้งหมดที่คุณสามารถใช้งานได้:')
        .addFields(
          { name: '📊 การจัดการเคส', value: '`!countCase` - สรุปเคสทั้งหมดในห้องนี้\n`!countSelf` - ดูสรุปเคสของตัวเอง\n`!getM` - รายชื่อสมาชิกในเซิร์ฟเวอร์' },
          { name: '🎶 เพลง', value: '`!play <ชื่อเพลง/ลิงก์>` - เล่นเพลงจาก YouTube\n`!skip` - ข้ามเพลงปัจจุบัน\n`!leave` - ให้บอทออกจากห้องและล้างคิว' },
          { name: '❓ ทั่วไป', value: '`!help` - แสดงรายการคำสั่งทั้งหมด' }
        )
        .setFooter({ text: 'Bot Case Police' })
        .setTimestamp();
      message.channel.send({ embeds: [helpEmbed] });
    }

    // ===== MUSIC COMMANDS =====
    if (command === '!play') {
      handlePlay(message, args);
    } else if (command === '!skip') {
      handleSkip(message);
    } else if (command === '!leave') {
      handleLeave(message);
    }

  } catch (error) {
    console.error('❌ Error in messageCreate:', error);
    message.channel.send('❌ เกิดข้อผิดพลาดในระบบ (messageCreate)');
  }
});

// ===== ERROR HANDLING =====
client.on('error', console.error);
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// ===== LOGIN =====
client.login(TOKEN);