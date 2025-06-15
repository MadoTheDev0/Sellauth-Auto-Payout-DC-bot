import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  InteractionType
} from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { authenticator } from 'otplib';  // NEW for 2FA TOTP generation
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const API_KEY = process.env.SELLAUTH_API_KEY;
const API = 'https://api.sellauth.com/v1';
const HEADERS = { Authorization: `Bearer ${API_KEY}` };

const walletsToMonitor = new Map(); // Map<shopId, { currency, address, password, twoFaSecret }>

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
        .addStringOption(opt =>
          opt.setName('password').setDescription('SellAuth password').setRequired(true)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName('set2fa')
        .setDescription('Set 2FA secret for auto payouts')
        .addStringOption(opt =>
          opt.setName('shopid').setDescription('Shop ID').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('secret').setDescription('2FA TOTP secret (Base32)').setRequired(true)
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
  // Modal submit handler
  if (interaction.type === InteractionType.ModalSubmit) {
    const [modalType, shopId, currency, address, amount] = interaction.customId.split('|');
    if (modalType === 'payout_modal') {
      try {
        const password = interaction.fields.getTextInputValue('password');
        const tfa_code = interaction.fields.getTextInputValue('tfa');

        const res = await fetch(`${API}/shops/${shopId}/payouts/payout`, {
          method: 'POST',
          headers: { ...HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ currency, address, amount, password, tfa_code }),
        });

        const data = await res.json();
        await interaction.reply({ content: data.message || '✅ Payout sent!', ephemeral: true });
      } catch (err) {
        console.error('❌ Payout error:', err);
        await interaction.reply({ content: '❌ Failed to send payout.', ephemeral: true });
      }
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'wallet') {
    const sub = options.getSubcommand();

    if (sub === 'link') {
      const address = options.getString('address');
      const network = options.getString('network');
      const shopId = options.getString('shopid');
      const password = options.getString('password');

      let existing = walletsToMonitor.get(shopId) || {};
      walletsToMonitor.set(shopId, {
        ...existing,
        address,
        currency: network.toLowerCase(),
        password,
      });
      return interaction.reply(`🔗 Wallet for shop ${shopId} set to ${address} (${network}) with password saved.`);
    }

    if (sub === 'view') {
      const entries = Array.from(walletsToMonitor.entries()).map(([id, data]) =>
        `• Shop ${id}: ${data.address} (${data.currency})`
      ).join('\n');
      return interaction.reply(entries || 'No wallets linked yet.');
    }

    if (sub === 'set2fa') {
      const shopId = options.getString('shopid');
      const secret = options.getString('secret');

      let existing = walletsToMonitor.get(shopId) || {};
      walletsToMonitor.set(shopId, {
        ...existing,
        twoFaSecret: secret,
      });
      return interaction.reply(`🔑 2FA secret set for shop ${shopId}. Auto payouts will now use this secret.`);
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

      const modal = new ModalBuilder()
        .setCustomId(`payout_modal|${shopId}|${currency}|${address}|${amount}`)
        .setTitle('Enter Password and 2FA');

      const passwordInput = new TextInputBuilder()
        .setCustomId('password')
        .setLabel('SellAuth Password')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const tfaInput = new TextInputBuilder()
        .setCustomId('tfa')
        .setLabel('2FA Code')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(passwordInput),
        new ActionRowBuilder().addComponents(tfaInput),
      );

      await interaction.showModal(modal);
    }
  }
});

async function startAutoPayouts() {
  setInterval(async () => {
    for (const [shopId, { currency, address, password, twoFaSecret }] of walletsToMonitor.entries()) {
      try {
        if (!password) {
          console.warn(`No password set for shop ${shopId}, skipping auto payout.`);
          continue;
        }

        const res = await fetch(`${API}/shops/${shopId}/payouts/balances`, { headers: HEADERS });
        const data = await res.json();
        const balance = parseFloat(data[currency]);

        if (balance > 0) {
          const tfa_code = twoFaSecret ? authenticator.generate(twoFaSecret) : null;

          if (!tfa_code) {
            console.warn(`No 2FA secret for shop ${shopId}, auto payout skipped.`);
            continue;
          }

          const payoutRes = await fetch(`${API}/shops/${shopId}/payouts/payout`, {
            method: 'POST',
            headers: { ...HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ currency, address, amount: balance, password, tfa_code }),
          });

          const result = await payoutRes.json();

          if (result.success) {
            console.log(`✅ Auto payout for shop ${shopId} (${currency}):`, result.message);
          } else {
            console.error(`❌ Auto payout failed for shop ${shopId}:`, result.message);
          }
        }
      } catch (err) {
        console.error(`❌ Auto payout error for shop ${shopId}:`, err);
      }
    }
  }, 60000); 
}

client.login(DISCORD_TOKEN);
