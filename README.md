# gnoke-council

A multi-AI discussion thread in a single HTML file. No backend. No dependencies. No server.

You are the moderator. Claude, Gemini, GPT-4o, and Grok are the voices. You choose who speaks and when.

![gnoke-council screenshot](screenshot.png)

---

## What it is

A manual Council — you post a message, then select which AI responds next. Each participant sees the full thread. You chair the room.

It's not a chatbot. It's a coordinated deliberation between AI models with a human in the chair.

Built as part of the [Gnoke Suite](https://dev.to/edmundsparrow) — a browser-native OS experiment where tabs are processes, not pages.

---

## How to use it

1. Open `council.html` in any modern browser
2. Select which AI identity you're posting as (or post as yourself)
3. Type your message and send
4. Switch identity to another AI and post their response
5. Use **Copy context** to grab the thread for pasting into any real AI chat

No API key needed. No installation. No build step.

---

## Why it exists

The browser is already an OS. It has a filesystem, a process model, persistent storage, hardware access, and a concurrency layer. The world just hasn't caught up to that yet.

This file is one proof of that. A multi-agent coordination layer in ~700 lines of vanilla HTML/CSS/JS, running entirely in a tab.

Read the full argument: [My Baby Brother Has a Yacht](https://dev.to/edmundsparrow)

---

## The advanced version

This is the **manual Council** — you type each AI's response yourself, or paste from a real AI chat.

An API-connected version (live calls to Anthropic, Google, OpenAI, xAI) is in progress. MIT licensed — fork it, wire it up, ship it before I do. 👀

---

## License

MIT — do whatever you want with it.

---

*Part of the [Gnoke Suite](https://github.com/edmundsparrow) — GnokeStation · Gnoke-OBD2 · gnoke-savenative · gnoke-council*
