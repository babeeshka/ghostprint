# ghost-profile

Fires randomized Google searches through your real signed-in Chrome profile to build up interest signals across ad categories. Logs every action to MongoDB and is controllable via an Express API and Commander CLI.

---

> **WARNING — Terms of Service**
>
> This tool automates browser interactions with Google using your personal account.
> Automating a Google account may violate [Google's Terms of Service](https://policies.google.com/terms).
> Use only on accounts you own, with full understanding of the risk. This is provided for
> educational and research purposes only. You assume all responsibility for how you use it.

---

## Prerequisites

- Node.js 20+
- Google Chrome (not Chromium) installed at the default Mac path
- MongoDB Atlas cluster **or** local MongoDB (`brew install mongodb-community`)
- A **dedicated** Chrome profile signed into the Google account you want to influence

## Mac Setup

### 1. Install dependencies

```bash
npm install
npx playwright install chrome
```

### 2. Create a dedicated Chrome profile (strongly recommended)

Using a dedicated profile prevents the tool from touching your main Chrome session and keeps
the ad signal on a single account.

1. Open Chrome → click the profile icon (top right) → **Add**
2. Sign in with the Google account you want to target
3. Go to `chrome://version` in that profile — look for **Profile Path**
4. The folder name at the end (e.g. `Profile 2`) is your `CHROME_PROFILE_NAME`

> Playwright **cannot** attach to an already-running Chrome window. You must fully quit Chrome
> before running ghost-profile, **or** use a profile that is not currently open anywhere.

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `CHROME_USER_DATA_DIR` | Full path to Chrome's user data directory |
| `CHROME_PROFILE_NAME` | Profile folder name from `chrome://version` |
| `API_PORT` | Port for the Express API (default: 3737) |
| `HEADLESS` | `false` is strongly recommended — Google detects headless |
| `MIN_DWELL_MS` | Minimum time to spend on each page (ms) |
| `MAX_DWELL_MS` | Maximum time to spend on each page (ms) |

### 4. Seed categories

```bash
npm run seed
```

## CLI Usage

```bash
# Seed categories into MongoDB
npm run cli -- seed

# Start a recurring session (5 queries every 8 minutes, farm + luxury categories)
npm run cli -- start --interval 8 --batch 5 --categories farm,luxury

# Start a session across all categories
npm run cli -- start --interval 10 --batch 5

# Fire 5 queries immediately (no schedule)
npm run cli -- fire --count 5

# Fire 3 queries from specific categories
npm run cli -- fire --count 3 --categories auto,pet

# Show session status
npm run cli -- status

# Stop the most recent running session
npm run cli -- stop

# View stats (all time)
npm run cli -- stats

# View stats for last 7 days
npm run cli -- stats --since 7d

# Export query log as JSON
npm run cli -- export --format json --out queries.json

# Export as CSV to stdout
npm run cli -- export --format csv
```

## API Usage

Start the API server:

```bash
npm run api
```

The server runs on `http://localhost:3737` by default.

### Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/sessions` | Start a new session |
| `GET` | `/sessions` | List all sessions |
| `GET` | `/sessions/:id` | Get session + its queries |
| `POST` | `/sessions/:id/stop` | Stop a running session |
| `POST` | `/fire` | Fire queries immediately |
| `GET` | `/stats` | Aggregated stats |
| `GET` | `/categories` | List seeded categories |

**POST /sessions**
```json
{ "intervalMin": 10, "batchSize": 5, "categories": ["farm", "luxury"] }
```

**POST /fire**
```json
{ "count": 5, "categories": ["auto", "pet"] }
```

## Available Categories

| Name | Icon | Description |
|---|---|---|
| `farm` | 🌾 | Agricultural / farming |
| `baby` | 🍼 | Baby / parenting |
| `luxury` | 💎 | High-end lifestyle |
| `b2b` | 🏢 | Business-to-business |
| `diy` | 🔨 | Home improvement / DIY |
| `niche_hobbies` | 🎯 | Niche hobbies |
| `medical` | 🏥 | Health / medical |
| `auto` | 🚗 | Automotive |
| `real_estate` | 🏡 | Property / real estate |
| `pet` | 🐾 | Pet care |

## Development

```bash
# Run tests
npm test

# Type-check without emitting
npm run typecheck

# Build to dist/
npm run build
```

## How It Works

1. Each session opens your dedicated Chrome profile via Playwright's `launchPersistentContext`
2. For each query, it navigates to `google.com/search?q=...`, waits for network idle, scrolls 1–3 times
3. With 30% probability it clicks an organic (non-Google) result and dwells on it
4. Dwell time is randomized between `MIN_DWELL_MS` and `MAX_DWELL_MS`
5. Between queries a random 4–15 second gap is inserted
6. Categories are rotated so no two consecutive queries come from the same category
7. Every action is logged to MongoDB with timing and title data
