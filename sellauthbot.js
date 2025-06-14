// Required packages
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_KEY = process.env.SELLAUTH_API_KEY;
const API = 'https://api.sellauth.com/v1';
const HEADERS = { Authorization: `Bearer ${API_KEY}` };

// In-memory wallet config storage (should be replaced with DB in production)
const walletsToMonitor = new Map(); // Map<shopId, { currency, address }>

// Register Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName('shops')
    .setDescription('Manage SellAuth shops')
    .addSubcommand(cmd =>
      cmd.setName('list').setDescription('List your shops')
    )
    .addSubcommand(cmd =>
      cmd.setName('stats')
        .setDescription('Get stats for a shop')
        .addStringOption(opt =>
          opt.setName('shopid').setDescription('Shop ID').setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Manage your crypto wallet')
    .addSubcommand(cmd =>
      cmd.setName('view').setDescription('View linked wallet')
    )
    .addSubcommand(cmd =>
      cmd.setName('link')
        .setDescription('Link or update your wallet address')
        .addStringOption(opt =>
          opt.setName('address').setDescription('Wallet address').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('network').setDescription('btc or ltc').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('shopid').setDescription('Shop ID').setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('Manage shop crypto payouts')
    .addSubcommand(cmd =>
      cmd.setName('balances')
        .setDescription('View wallet balances')
        .addStringOption(opt =>
          opt.setName('shopid').setDescription('Shop ID').setRequired(true)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName('payouts')
        .setDescription('View payout history')
        .addStringOption(opt =>
          opt.setName('shopid').setDescription('Shop ID').setRequired(true)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName('transactions')
        .setDescription('View wallet transactions')
        .addStringOption(opt =>
          opt.setName('shopid').setDescription('Shop ID').setRequired(true)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName('payout')
        .setDescription('Send crypto payout')
        .addStringOption(opt =>
          opt.setName('shopid').setDescription('Shop ID').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('currency').setDescription('btc or ltc').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('address').setDescription('Recipient wallet address').setRequired(true)
        )
        .addNumberOption(opt =>
          opt.setName('amount').setDescription('Amount to send').setRequired(true)
        )
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
console.log('✅ Slash commands registered.');

// Create Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  startAutoPayouts();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  if (commandName === 'wallet') {
    const sub = options.getSubcommand();
    if (sub === 'link') {
      const address = options.getString('address');
      const network = options.getString('network');
      const shopId = options.getString('shopid');
      walletsToMonitor.set(shopId, { address, currency: network.toLowerCase() });
      return interaction.reply(`🔗 Wallet for shop ${shopId} set to ${address} (${network})`);
    }
    if (sub === 'view') {
      const entries = Array.from(walletsToMonitor.entries()).map(([id, data]) => `• Shop ${id}: ${data.address} (${data.currency})`).join('\n');
      return interaction.reply(entries || 'No wallets linked yet.');
    }
  }

  if (commandName === 'shops') {
    const sub = options.getSubcommand();
    if (sub === 'list') {
      const res = await fetch(`${API}/shops`, { headers: HEADERS });
      const data = await res.json();
      const content = Array.isArray(data) ? data.map(s => `• ${s.name} (${s.$id})`).join('\n') : data.message;
      return interaction.reply(content);
    }
    if (sub === 'stats') {
      const id = options.getString('shopid');
      const res = await fetch(`${API}/shops/${id}/stats`, { headers: HEADERS });
      const stats = await res.json();
      return interaction.reply(`📊 Stats:\nOrders: ${stats.orders}\nRevenue: $${stats.revenue}`);
    }
  }

  if (commandName === 'crypto') {
    const sub = options.getSubcommand();
    const shopId = options.getString('shopid');

    if (sub === 'balances') {
      const res = await fetch(`${API}/shops/${shopId}/payouts/balances`, { headers: HEADERS });
      const data = await res.json();
      return interaction.reply(`💰 Balances:\n${JSON.stringify(data, null, 2)}`);
    }
    if (sub === 'payouts') {
      const res = await fetch(`${API}/shops/${shopId}/payouts`, { headers: HEADERS });
      const data = await res.json();
      const lines = Array.isArray(data) ? data.map(p => `• ${p.currency} to ${p.address}: ${p.amount}`).slice(0, 5).join('\n') : data.message;
      return interaction.reply(`📄 Payouts:\n${lines}`);
    }
    if (sub === 'transactions') {
      const res = await fetch(`${API}/shops/${shopId}/payouts/transactions`, { headers: HEADERS });
      const data = await res.json();
      const lines = Array.isArray(data) ? data.map(t => `• ${t.txid} | ${t.amount} ${t.currency}`).slice(0, 5).join('\n') : data.message;
      return interaction.reply(`📜 Transactions:\n${lines}`);
    }
    if (sub === 'payout') {
      const currency = options.getString('currency');
      const address = options.getString('address');
      const amount = options.getNumber('amount');
      const res = await fetch(`${API}/shops/${shopId}/payouts/payout`, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, address, amount }),
      });
      const data = await res.json();
      return interaction.reply(data.message || '✅ Payout initiated.');
    }
  }
});

function startAutoPayouts() {
  setInterval(async () => {
    for (const [shopId, { currency, address }] of walletsToMonitor.entries()) {
      try {
        const res = await fetch(`${API}/shops/${shopId}/payouts/balances`, { headers: HEADERS });
        const data = await res.json();
        const balance = parseFloat(data[currency]);
        if (balance > 0) {
          const payout = await fetch(`${API}/shops/${shopId}/payouts/payout`, {
            method: 'POST',
            headers: { ...HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ currency, address, amount: balance }),
          });
          const result = await payout.json();
          console.log(`✅ Auto payout for shop ${shopId}:`, result);
        }
      } catch (err) {
        console.error(`❌ Auto payout failed for shop ${shopId}:`, err);
      }
    }
  }, 60000); // every 60 seconds
}

client.login(DISCORD_TOKEN);
