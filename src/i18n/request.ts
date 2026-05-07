import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  const locale: Locale = raw && (locales as readonly string[]).includes(raw)
    ? (raw as Locale)
    : defaultLocale;

  const common = (await import(`../../content/messages/ui/${locale}/common.json`)).default;
  const auth = (await import(`../../content/messages/ui/${locale}/auth.json`)).default;
  const bookings = (await import(`../../content/messages/ui/${locale}/bookings.json`)).default;
  const maintenance = (await import(`../../content/messages/ui/${locale}/maintenance.json`)).default;
  const events = (await import(`../../content/messages/ui/${locale}/events.json`)).default;
  const messaging = (await import(`../../content/messages/ui/${locale}/messaging.json`)).default;

  return { locale, messages: { common, auth, bookings, maintenance, events, messaging } };
});
