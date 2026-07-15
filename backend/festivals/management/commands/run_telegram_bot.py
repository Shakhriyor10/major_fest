import asyncio
import os
import re

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import KeyboardButton, Message, ReplyKeyboardMarkup
from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections

from festivals.models import FestivalApplication, TelegramGroupAccess


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) == 9:
        digits = "998" + digits
    elif len(digits) == 10 and digits.startswith("0"):
        digits = "998" + digits[1:]
    return digits


def find_approved_applications(phone: str):
    close_old_connections()
    normalized = normalize_phone(phone)
    return [
        app
        for app in FestivalApplication.objects.filter(status=FestivalApplication.Status.APPROVED)
        if normalize_phone(app.phone) == normalized
    ]


class Command(BaseCommand):
    help = "Verify approved applicants and invite them to the Telegram group"

    def handle(self, *args, **options):
        token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        chat_id = os.getenv("TELEGRAM_GROUP_ID", "").strip()
        if not token or not chat_id:
            raise CommandError("Set TELEGRAM_BOT_TOKEN and TELEGRAM_GROUP_ID")
        try:
            chat_id = int(chat_id)
        except ValueError as exc:
            raise CommandError("TELEGRAM_GROUP_ID must be an integer") from exc
        asyncio.run(self.run_bot(token, chat_id))

    async def run_bot(self, token: str, chat_id: int):
        bot = Bot(token=token)
        dp = Dispatcher()

        @dp.message(CommandStart())
        async def start(message: Message):
            keyboard = ReplyKeyboardMarkup(
                keyboard=[[KeyboardButton(text="Подтвердить номер телефона", request_contact=True)]],
                resize_keyboard=True,
                one_time_keyboard=True,
            )
            await message.answer(
                "Отправьте свой номер кнопкой ниже. Бот проверит одобренную заявку.",
                reply_markup=keyboard,
            )

        @dp.message(F.contact)
        async def verify_contact(message: Message):
            contact = message.contact
            if contact.user_id != message.from_user.id:
                await message.answer("Можно отправить только свой контакт через кнопку бота.")
                return

            applications = await asyncio.to_thread(find_approved_applications, contact.phone_number)
            if not applications:
                await message.answer("Одобренная заявка с этим номером не найдена.")
                return

            links = []
            for application in applications:
                access = await asyncio.to_thread(
                    TelegramGroupAccess.objects.filter(application=application).first
                )
                if access and access.telegram_user_id != message.from_user.id:
                    await message.answer(
                        f"Заявка #{application.id} уже привязана к другому Telegram-аккаунту."
                    )
                    continue

                invite = await bot.create_chat_invite_link(
                    chat_id=chat_id,
                    name=f"application-{application.id}-user-{message.from_user.id}",
                    member_limit=1,
                )
                await asyncio.to_thread(
                    TelegramGroupAccess.objects.update_or_create,
                    application=application,
                    defaults={
                        "telegram_user_id": message.from_user.id,
                        "verified_phone": normalize_phone(contact.phone_number),
                        "invite_link": invite.invite_link,
                    },
                )
                links.append(invite.invite_link)

            if links:
                await message.answer(
                    "Номер подтверждён. Одноразовая ссылка для вступления:\n" + "\n".join(links)
                )

        @dp.message()
        async def fallback(message: Message):
            await message.answer("Нажмите /start и отправьте свой контакт кнопкой бота.")

        self.stdout.write(self.style.SUCCESS("Telegram bot started"))
        try:
            await dp.start_polling(bot)
        finally:
            await bot.session.close()
