# SellAuth Discord Bot

Ein moderner Discord-Bot zur Verwaltung von SellAuth Shops und automatischen Krypto-Auszahlungen mit 2FA-Unterstützung.

---

## Features

- **Shop-Management:** Shops auflisten und Statistiken abrufen  
- **Wallet-Verwaltung:** Wallets verknüpfen und anzeigen  
- **Krypto-Operationen:** Wallet-Balances, Auszahlungen, Transaktionen ansehen  
- **Payout mit Modal:** Sichere Auszahlungen per Modal mit Passwort und 2FA-Code  
- **Automatische Auszahlungen:** Periodische automatische Auszahlungen bei Guthaben  
- **Set 2FA Code:** Ermöglicht das Setzen und Aktualisieren des 2FA-Codes für sichere Aktionen  

---

## Commands

### /shops list  
Listet alle deine SellAuth Shops auf.

### /shops stats `<shopid>`  
Zeigt Statistiken eines Shops an.

### /wallet view  
Zeigt deine verknüpften Wallets an.

### /wallet link `<address>` `<network>` `<shopid>`  
Verknüpft oder aktualisiert die Wallet-Adresse für einen Shop.

### /crypto balances `<shopid>`  
Zeigt die Guthaben der Wallet an.

### /crypto payouts `<shopid>`  
Zeigt die letzten Auszahlungen.

### /crypto transactions `<shopid>`  
Zeigt die letzten Transaktionen.

### /crypto payout  
Startet ein Modal zur Eingabe der Auszahlung mit folgenden Feldern:  
- Shop ID  
- Currency (btc oder ltc)  
- Wallet-Adresse  
- Betrag  
- SellAuth Passwort  
- 2FA Code  

---

## Set 2FA Command

### /set2fa `<shopid>` `<tfa_code>`  

Mit diesem Command kannst du den 2FA-Code für deinen Shop setzen oder aktualisieren. Dies ist notwendig, damit automatische oder manuelle Auszahlungen den korrekten 2FA-Code verwenden können.

**Beispiel:**  
/set2fa 157322 123456


---

## Installation & Setup

1. Klone das Repository  
2. Installiere die Abhängigkeiten:  

npm install

3. Lege eine `.env` Datei an und fülle die Variablen aus:  
DISCORD_TOKEN=DeinDiscordBotToken
CLIENT_ID=DeineDiscordClientID
SELLAUTH_API_KEY=DeinSellAuthApiKey

4. Starte den Bot:  
node sellauthbot.js

yaml
Kopieren
Bearbeiten

---

## Automatische Auszahlungen

Der Bot prüft alle 60 Sekunden die Guthaben verknüpfter Wallets und führt bei vorhandenem Guthaben eine Auszahlung aus. Dafür muss ein gültiger 2FA-Code gesetzt sein (siehe `/set2fa`).

---

## Sicherheitshinweis

- Das SellAuth Passwort und der 2FA-Code werden nur über sichere Modals abgefragt und nicht im Klartext gespeichert.  
- Bitte verwalte deine Zugangsdaten sicher.  

---

## Mitwirkende

- Mado

---

## Lizenz

MIT License






## Auto Payouts

The bot can automatically send payouts from linked wallets every 60 seconds if a balance is detected.

---

## Dependencies

- discord.js  
- node-fetch  
- dotenv

---

## Contributing

Feel free to open issues or submit pull requests for improvements!

---

## License

MIT License © 2025 Mado
