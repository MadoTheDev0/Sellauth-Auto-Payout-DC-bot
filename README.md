# SellAuth Discord Bot

A modern Discord bot for managing SellAuth shops and automatic crypto payouts with 2FA support.

---

## Features

- **Shop Management:** List shops and fetch statistics  
- **Wallet Management:** Link and view wallets  
- **Crypto Operations:** View wallet balances, payouts, transactions  
- **Payout with Modal:** Secure payouts via modal with password and 2FA code  
- **Automatic Payouts:** Periodic automatic payouts when balance is available  
- **Set 2FA Code:** Allows setting and updating the 2FA code for secure actions  

---

## Commands

### /shops list  
Lists all your SellAuth shops.

### /shops stats `<shopid>`  
Displays statistics for a specific shop.

### /wallet view  
Shows your linked wallets.

### /wallet link `<address>` `<network>` `<shopid>`  
Links or updates the wallet address for a shop.

### /crypto balances `<shopid>`  
Displays the wallet balances.

### /crypto payouts `<shopid>`  
Shows recent payouts.

### /crypto transactions `<shopid>`  
Shows recent transactions.

### /crypto payout  
Starts a modal to input payout details with the following fields:  
- Shop ID  
- Currency (btc or ltc)  
- Wallet address  
- Amount  
- SellAuth password  
- 2FA code  

---

## Set 2FA Command

### /set2fa `<shopid>` `<tfa_code>`  

This command lets you set or update the 2FA code for your shop. This is required so that automatic or manual payouts use the correct 2FA code.

**Example:**  
/set2fa 157322 123456

---

## Installation & Setup

1. Clone the repository  
2. Install dependencies:  

```bash
npm install
```

3. Create a `.env` file and fill in the variables:  
```
DISCORD_TOKEN=YourDiscordBotToken
CLIENT_ID=YourDiscordClientID
SELLAUTH_API_KEY=YourSellAuthApiKey
```

4. Start the bot:  
```bash
node sellauthbot.js
```

---

## Automatic Payouts

The bot checks linked wallet balances every 60 seconds and executes a payout if balance is available. A valid 2FA code must be set (see `/set2fa`).

---

## Security Notice

- The SellAuth password and 2FA code are requested only through secure modals and are not stored in plain text.  
- Please keep your credentials safe.

---

## Contributors

- Mado

---

## License

MIT License

---

## Auto Payouts

The bot can automatically send payouts from linked wallets every 60 seconds if a balance is detected.

---

## Dependencies

- discord.js  
- node-fetch  
- dotenv  
- otplib (for 2FA code generation)

---

## Contributing

Feel free to open issues or submit pull requests for improvements!

---

## License

MIT License © 2025 Mado
