const memberMap = new Map();

async function preloadMembers(guild) {
  const members = await guild.members.fetch();

  members.forEach(member => {
    memberMap.set(member.id, {
      displayName: member.displayName,
      username: member.user.username,
    });
  });

  console.log(`✅ Loaded members: ${memberMap.size}`);
}

function getDisplayName(userId, fallbackUsername = 'Unknown User') {
  const userData = memberMap.get(userId);
  return userData ? userData.displayName : fallbackUsername;
}

function isCommand(content) {
  return content.startsWith('!');
}

module.exports = { memberMap, preloadMembers, getDisplayName, isCommand };
