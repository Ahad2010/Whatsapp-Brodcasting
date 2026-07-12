# WaBlast — WhatsApp Bulk Broadcasting SaaS

A full-stack SaaS application that lets businesses send automated, bulk WhatsApp messages to selected contacts or groups — built on Meta's official WhatsApp Cloud API for reliable, compliant delivery (no bans, no unofficial automation).

Compose a message, select a group or contacts, hit send — the backend handles the rest: fetching recipients, calling the WhatsApp Cloud API, and tracking delivery status.

---

## Live Demo

- **Frontend:** _add your deployed frontend URL here_
- **Backend API:** _add your Railway backend URL here_
- **API Docs (Swagger):** `<backend-url>/docs`

---

## Features

- **Contact management** — add, import, and organize contacts with status tracking
- **Groups/segments** — organize contacts into broadcast groups
- **Compose & broadcast** — write a message, select recipients, send instantly or schedule for later
- **Live recipient counter** — see exactly how many contacts a broadcast will reach before sending
- **Campaign history** — track delivered, read, and failed messages per campaign
- **AI Assistant** — manage contacts and groups using natural-language commands (e.g. "Add Ahmed 923001234567 to VIP")
- **Official Meta WhatsApp Cloud API integration** — no unofficial/browser-automation tools, so no risk of number bans
- **Templates** — save and reuse frequently sent messages

---

## Tech Stack

**Frontend**
- HTML5, Tailwind CSS
- Vanilla JavaScript
- Lucide Icons

**Backend**
- Python 3
- FastAPI
- MongoDB (via PyMongo / Motor)
- httpx (async HTTP calls to Meta's Graph API)

**Third-Party / Infrastructure**
- Meta WhatsApp Business Cloud API
- Railway (backend deployment & hosting)

---

## Architecture

```
Frontend (HTML/Tailwind/JS)
        │
        │  REST API calls (fetch)
        ▼
Backend (Python + FastAPI)
        │
        │  MongoDB — contacts, groups, campaigns
        │  httpx  — outbound requests
        ▼
Meta WhatsApp Cloud API
        │
        ▼
   Recipient's WhatsApp
```

Delivery status (sent / delivered / read / failed) flows back via a Meta webhook into the backend, and is reflected in the Campaign History page.

---

## Project Structure

```
whatsapp-broadcast-saas/
│
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── contacts.html
│   ├── groups.html
│   ├── compose.html
│   ├── history.html
│   └── ...
│
└── backend/
    ├── main.py                 → FastAPI entry point
    ├── routers/
    │   ├── contacts.py
    │   ├── groups.py
    │   └── broadcast.py         → send logic, calls Meta Cloud API
    ├── services/
    │   └── meta_api.py           → isolated Meta API request logic
    ├── models/                   → Pydantic schemas
    ├── database.py                → MongoDB connection
    ├── config.py                   → loads .env values
    ├── webhook.py                   → Meta webhook (verification + delivery status)
    ├── requirements.txt
    └── .env.example
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- MongoDB instance (local or MongoDB Atlas free tier)
- A Meta Developer account with a WhatsApp Business app set up ([developers.facebook.com](https://developers.facebook.com))

### 1. Clone the repo
```bash
git clone https://github.com/<your-username>/whatsapp-broadcast-saas.git
cd whatsapp-broadcast-saas
```

### 2. Backend setup
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/` (see `.env.example`):
```
META_ACCESS_TOKEN=your_meta_access_token
META_PHONE_NUMBER_ID=your_phone_number_id
META_WABA_ID=your_whatsapp_business_account_id
META_WEBHOOK_VERIFY_TOKEN=your_custom_verify_string
MONGODB_URI=your_mongodb_connection_string
```

Run the server:
```bash
uvicorn main:app --reload
```

API will be live at `http://127.0.0.1:8000`, with interactive docs at `http://127.0.0.1:8000/docs`.

### 3. Frontend setup
Simply open `frontend/index.html` in a browser, or serve it with any static file server. Update the `BACKEND_URL` constant in the JS to point to your running backend:
```js
const BACKEND_URL = "http://127.0.0.1:8000"; // or your deployed Railway URL
```

---

## Deployment

The backend is deployment-ready for **Railway**:
1. Push the `backend/` folder to a GitHub repo
2. Create a new Railway project → **Deploy from GitHub repo**
3. Add the environment variables from `.env` in Railway's **Variables** tab
4. Railway auto-detects the Python app and deploys using the `Procfile`:
   ```
   web: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. Update the Meta webhook URL and the frontend's `BACKEND_URL` with the live Railway URL

---

## API Overview

| Method | Endpoint                       | Description                  |
|--------|---------------------------------|-------------------------------|
| GET    | `/api/contacts`                | List all contacts             |
| POST   | `/api/contacts`                | Add a new contact              |
| DELETE | `/api/contacts/{contact_id}`   | Delete a contact                |
| GET    | `/api/groups`                  | List all groups                  |
| POST   | `/api/groups`                  | Create a new group                |
| POST   | `/api/groups/{group_id}/members` | Add members to a group           |
| POST   | `/api/broadcast/send`          | Send a broadcast message to a group/contacts |
| GET    | `/api/campaigns`               | List campaign/broadcast history    |
| GET/POST | `/webhook`                   | Meta webhook (verification & delivery status) |

Full interactive documentation available at `/docs` once the backend is running.

---

## Known Limitations

- Running in **Meta's test mode** by default — messages can only be sent to manually verified recipient numbers (max 5) until Business Verification is completed
- Free-form text messages only work within WhatsApp's 24-hour customer service window; outside that window, only pre-approved message templates can be sent
- Business Verification (for full-scale sending) requires submitting business documents to Meta and is a manual review process

---

## Roadmap

- [ ] Multi-tenant support (Embedded Signup for multiple client WhatsApp numbers)
- [ ] Smart contact segmentation (tags, activity-based filters)
- [ ] Team approval workflow for campaigns
- [ ] Analytics dashboard with delivery/read trends

---

## Author

**Ahad Noor**
Full-stack SaaS project — WhatsApp bulk broadcasting built on Meta's official WhatsApp Business Cloud API.