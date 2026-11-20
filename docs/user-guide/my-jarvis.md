# My Jarvis: voice assistant for email and invoices

The `my-jarvis` preset turns OpenJarvis into a personal assistant that:

- speaks in an English voice from ElevenLabs ("Daniel", a formal British male voice);
- sends emails from your Gmail account;
- creates Stripe invoices and has Stripe email them to your customers with a payment link;
- runs on your own computer, and you can open its dashboard from your phone.

**Nothing is sent without your say-so.** When you ask Jarvis to send an email or an
invoice, he prepares it and it appears under the **bell icon** at the top right of
the dashboard. It goes out only when you tap **Approve**. Tap **Deny** and it is
discarded. Requests you don't act on expire after 24 hours. Jarvis has no way to
approve on your behalf.

## 1. Install

You need macOS, Linux, or Windows with WSL2, plus:

- [Git](https://git-scm.com/downloads) and [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [Ollama](https://ollama.com/download), which runs Jarvis's AI model on your computer
- [Node.js 22](https://nodejs.org/), used to build the dashboard

```bash
git clone https://github.com/<your-account>/openjarvis.git
cd openjarvis
git checkout claude/jarvis-elevenlabs-voice-o3je9s   # or main, once merged
uv sync --extra server --extra speech
ollama pull qwen3.5:9b

uv run jarvis init --preset my-jarvis --force
```

The preset is written to `~/.openjarvis/config.toml`. Run the commands below
from the `openjarvis` folder, prefixed with `uv run`, or activate the
environment once with `source .venv/bin/activate`.

## 2. Give Jarvis his voice (ElevenLabs)

Create an API key at **elevenlabs.io → your profile → API Keys**, then:

```bash
export ELEVENLABS_API_KEY="your-elevenlabs-key"
```

To change the voice, edit `voice_id` under `[speech]` in
`~/.openjarvis/config.toml`. The file lists some alternative English voices.

## 3. Connect Gmail

```bash
jarvis connect gdrive
```

The first time, this asks for a Google OAuth **Client ID** and **Client
Secret**:

1. Go to <https://console.cloud.google.com/apis/credentials> and create a project.
2. Under **APIs & Services → Library**, enable the **Gmail API**.
3. Under **OAuth consent screen**, choose *External*, fill in the app name and
   your email, and add your own Gmail address as a **test user**.
4. Under **Credentials**, choose **Create credentials → OAuth client ID →
   Desktop app**, then copy the ID and secret into the prompt.
5. A browser window opens. Sign in and allow access.

One sign-in covers Gmail, Calendar, Contacts, Drive and Tasks. Jarvis only uses
Gmail to send the emails you approve.

!!! note "Testing-mode apps"
    While your Google app is in *Testing* mode, Google expires the sign-in after
    seven days. If an approval says Gmail refused to send, run
    `jarvis connect gdrive` again.

## 4. Connect Stripe (invoices)

In the Stripe dashboard, go to **Developers → API keys → Create restricted
key** and give it **Write** access to **Customers** and **Invoices**. Then:

```bash
export STRIPE_API_KEY="rk_live_..."      # use an rk_test_ key to try it safely first
export JARVIS_INVOICE_CURRENCY="gbp"     # optional; the default is gbp
```

When you approve an invoice, Jarvis looks up the customer by email (creating
them if they're new), adds the line items, finalises the invoice, and Stripe
emails it to the customer with a link to pay online. The approval panel shows
the invoice number and payment link.

!!! tip
    Put the `export` lines in `~/.zshrc` or `~/.bashrc` so they're set every
    time you open a terminal.

## 5. Open the dashboard on this computer

```bash
jarvis gui
```

In **Settings**, turn on **Text-to-Speech** and **Speak replies
automatically** so Jarvis answers out loud. Use the microphone button in the
chat box to talk to him.

Try:

- *"Email sam@example.com and ask if we're still on for Thursday."*
- *"Invoice accounts@acme.co.uk, Acme Ltd, for website design at £750 and
  three months of hosting at £19.99 each, due in 30 days."*

Jarvis reads back what he's prepared. Open the bell, tap **View details** to
check the full email or the invoice lines, then tap **Approve**.

## 6. Use it from your phone

Your computer runs Jarvis. A private Cloudflare link lets your phone reach it
while the computer is on.

1. **Create an access key**, so only you can use the link:

    ```bash
    jarvis auth create-key        # prints a key starting oj_sk_ — keep it safe
    ```

2. **Build the dashboard** so the server can serve it (once, and again after updates):

    ```bash
    cd frontend && npm install && npm run build && cd ..
    ```

3. **Start Jarvis** (keep this terminal open):

    ```bash
    jarvis serve
    ```

4. **Start the link** in a second terminal. Install
   [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
   first (on a Mac: `brew install cloudflared`):

    ```bash
    jarvis tunnel
    ```

    It prints an address like `https://something-random.trycloudflare.com`.
    `jarvis tunnel` refuses to start until an access key exists.

5. **On your phone**, open that address. Go to **Settings → API key** and paste
   the `oj_sk_…` key. Turn on **Text-to-Speech** and **Speak replies
   automatically**.

6. Optional: use your browser's **Share → Add to Home Screen** so the dashboard
   opens like an app.

The quick-tunnel address changes each time you run `jarvis tunnel`. For a
permanent address, set up a named Cloudflare tunnel.

## Troubleshooting

| Problem | Fix |
|---|---|
| Jarvis says Gmail is not connected | Run `jarvis connect gdrive` |
| Approval says Gmail refused to send (403) | Run `jarvis connect gdrive` again to renew permission |
| Jarvis says Stripe is not set up | Set `STRIPE_API_KEY` in the terminal running `jarvis serve`, then restart it |
| Stripe rejected the request | The approval panel shows Stripe's reason, e.g. a key without Invoices access |
| No voice | Check `ELEVENLABS_API_KEY`, and turn on Text-to-Speech in Settings |
| Phone shows "Invalid API key" | Re-paste the key from `jarvis auth create-key` into Settings → API key |
| Jarvis says he sent something | He can't: only approvals send. Check the bell |
