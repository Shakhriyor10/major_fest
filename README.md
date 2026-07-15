# Major Fest

Mobile application and Django API for an automotive festival. Participants create a profile, add one or more cars, submit selected cars to a festival, and then track application status. Organizers approve or reject applications through Django admin.

## Stack

- Backend: Django, Django REST Framework, SQLite for local development
- Mobile: Expo + React Native, TypeScript

## Project Structure

```text
backend/      Django API and admin panel
mobile/       iOS/Android Expo application
requirements.txt
```

## Backend Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd backend
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Admin panel:

```text
http://127.0.0.1:8000/admin/
```

API:

```text
GET  http://127.0.0.1:8000/api/festivals/
POST http://127.0.0.1:8000/api/applications/
POST http://127.0.0.1:8000/api/profiles/
GET  http://127.0.0.1:8000/api/profiles/<id>/
POST http://127.0.0.1:8000/api/cars/
GET  http://127.0.0.1:8000/api/applications/?participant=<id>
```

Create a festival in the admin panel and set status to `Прием заявок` so the mobile app can show it.

## Mobile Setup

```bash
cd mobile
npm install
npm start
```

For a physical phone, replace `API_BASE_URL` in `mobile/src/api.ts` with your computer's local network IP, for example:

```ts
export const API_BASE_URL = "http://192.168.1.25:8000/api";
```

## Telegram bot for approved applicants

Telegram Bot API cannot find people by phone number or force-add them to a group. This bot asks an applicant to share their own contact, matches it with an approved application, and creates a one-use invite link.

Make the bot an administrator of the target group with permission to invite users, then run:

```powershell
pip install -r requirements.txt
cd backend
python manage.py migrate
$env:TELEGRAM_BOT_TOKEN="token from BotFather"
$env:TELEGRAM_GROUP_ID="-1001234567890"
python manage.py run_telegram_bot
```

`TELEGRAM_GROUP_ID` is the numeric supergroup ID, normally beginning with `-100`.

## First Product Flow

1. Organizer creates a festival with title, cover image, dates, prize fund, prize places, and car slots.
2. Participant opens the Profile tab, registers with name and phone, and adds one or more cars.
3. Participant opens the Home tab, selects an open festival, chooses one or more cars from the profile, and submits an application.
4. Backend stores the application with status `Новая`.
5. Organizer reviews the application in Django admin and changes status to `Одобрена` or `Отказ`.
6. Participant sees application statuses in the Profile tab.
