require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior
} = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const LOFI_STREAM = 'https://streams.ilovemusic.de/iloveradio17.mp3';
let connection = null;
let player = null;

function startStream() {
  try {
    const resource = createAudioResource(LOFI_STREAM, {
      inlineVolume: true
    });
    resource.volume?.setVolume(0.5);
    player.play(resource);
    console.log('🎵 Lo-Fi stream started!');
  } catch (err) {
    console.error('Stream error:', err.message);
    setTimeout(startStream, 5000);
  }
}

async function connectToChannel() {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const channel = await guild.channels.fetch(process.env.CHANNEL_ID);

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  console.log('✅ Connected to voice channel!');

  player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play
    }
  });

  connection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    console.log('Stream ended, restarting in 3s...');
    setTimeout(startStream, 3000);
  });

  player.on('error', (err) => {
    console.error('Player error:', err.message);
    setTimeout(startStream, 3000);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      console.log('Disconnected! Rejoining in 5s...');
      connection.destroy();
      setTimeout(connectToChannel, 5000);
    }
  });

  startStream();
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await connectToChannel();
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled error:', err);
});

client.login(process.env.TOKEN);
