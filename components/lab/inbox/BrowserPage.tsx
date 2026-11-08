"use client";

import { ArrowLeft, ArrowRight, Check, Ellipsis, Globe, Info, KeyRound, Landmark, Lock, Mail, MessageCircle, Package, RotateCw, ShoppingBag, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { ClientMission } from "@/lib/lab/client";
import type { LinkPage, ShopSms } from "@/lib/lab/story";
import { domainOf } from "@/lib/lab/content";
import { format, getMessages, rich } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { cardIconMap } from "../training/card-icons";
import { MissionSms } from "../mission/MissionSms";

/**
 * Görevli odada sayfaların eylemleri: ödeme (SMS döner), onay kararı (alışta SMS'teki kod, satışta
 * bankanın ödeme isteği) ve satışta siparişi kargoya verme.
 */
export type ShopActions = {
  mission: ClientMission;
  onPay: () => Promise<ShopSms | null>;
  /** null: işlem olmadı ya da hacklendi (oynatıcı alarmı açar). */
  onCode: (enter: boolean) => Promise<{ reply: string; done: boolean } | null>;
  onShip: (prepared: boolean) => Promise<{ reply: string; done: boolean } | null>;
};

// Adres çubuğunda gösterilen önek. Sahte sayfa "Güvenli değil" ile http, gerçek bağlantı https.
const plainScheme = "http://";
const secureScheme = "https://";
// Sahte sayfadaki geri sayım (acele ettirme taktiği): 23:41:08'den başlar.
const countdownStart = 23 * 3600 + 41 * 60 + 8;

/**
 * Mail içindeki bağlantıyla açılan sekme (Sahte-Sayfa-Masaustu, Sahte-Sayfa-Mobil). Ne açılacağını
 * sunucu söyler: sahte maildeki bağlantı sahte giriş sayfası, diğerleri yalnızca "Bağlantı açıldı"
 * sayfası. Gerçek bir siteye gidilmez. Sahte forma yazılan metin bu bileşenden çıkmaz: gönderince
 * sunucuya yalnızca "bilgi girildi" gider ve kutu hemen boşaltılır.
 */
export function BrowserPage({
  app,
  page,
  linkText,
  busy,
  onClose,
  onSubmit,
  shop,
}: {
  app: "INBOX" | "MESSAGING";
  page: LinkPage;
  linkText: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
  shop?: ShopActions;
}) {
  const t = getMessages().lab.browser;
  const trap = page.kind === "trap" ? page : null;
  const store = page.kind === "shop" ? page : null;
  const request = page.kind === "request" ? page : null;
  const order = page.kind === "order" ? page : null;
  const site = trap ? trap.site : store ? store.shop.name : request ? request.bank : order ? order.sale.platform : domainOf(page.url);
  const tabTitle = trap
    ? [trap.site, trap.title || linkText].filter(Boolean).join(" · ")
    : store
      ? [store.shop.name, store.shop.product].join(" · ")
      : request
        ? [request.bank, t.requestTab].join(" · ")
        : order
          ? [order.sale.platform, order.sale.product].join(" · ")
          : domainOf(page.url);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-scene-white font-sans text-scene-ink [animation:fade-in_.15s_ease-out_both]">
      {/* Sekmeler (masaüstü) */}
      <div className="hidden flex-none items-end gap-1 bg-scene-line px-2.5 pt-2 desk:flex">
        <button type="button" onClick={onClose} className="flex h-9 max-w-[220px] cursor-pointer items-center gap-2 rounded-t-lg px-3.5 text-[13px] text-scene-ink-2">
          {app === "INBOX" ? (
            <Mail className="size-3.5 flex-none text-scene-orange" strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <MessageCircle className="size-3.5 flex-none text-scene-green" strokeWidth={2.2} aria-hidden="true" />
          )}
          <span className="truncate">{app === "INBOX" ? t.tabInbox : t.tabMessaging}</span>
        </button>
        <span className="flex h-9 max-w-[320px] items-center gap-2 rounded-t-lg bg-scene-white px-3.5 text-[13px] font-bold">
          <Globe className="size-3.5 flex-none text-scene-ink-muted" strokeWidth={2.2} aria-hidden="true" />
          <span className="truncate">{tabTitle}</span>
          <button type="button" onClick={onClose} aria-label={t.closeTab} className="ml-1 flex size-6 cursor-pointer items-center justify-center rounded-md text-scene-ink-muted hover:bg-scene-paper">
            <X className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </span>
      </div>

      {/* Adres çubuğu (masaüstü) */}
      <div className="hidden flex-none items-center gap-2 border-b border-scene-line px-3 py-2 desk:flex">
        <button type="button" onClick={onClose} aria-label={t.back} className="flex size-8 cursor-pointer items-center justify-center rounded-md text-scene-ink-muted hover:bg-scene-paper">
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
        <span aria-hidden="true" className="flex size-8 items-center justify-center text-scene-ink-faint">
          <ArrowRight className="size-4" strokeWidth={2} />
        </span>
        <span aria-hidden="true" className="flex size-8 items-center justify-center text-scene-ink-muted">
          <RotateCw className="size-4" strokeWidth={2} />
        </span>
        <AddressBar url={page.url} trap={!!trap} />
      </div>

      {/* Telefon üst çubuğu */}
      <div className="flex flex-none items-center gap-3 border-b border-scene-line px-3 py-2 desk:hidden">
        <button type="button" onClick={onClose} aria-label={t.closeTab} className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-scene-ink">
          <X className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </button>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-[15px]">{site}</b>
          <span className={cn("flex items-center gap-1 truncate text-[13px]", trap ? "text-scene-ink-2" : "text-scene-ink-muted")}>
            {trap ? (
              <TriangleAlert className="size-3.5 flex-none text-scene-red" strokeWidth={2.2} aria-label={t.notSecure} />
            ) : (
              <Lock className="size-3.5 flex-none" strokeWidth={2.2} aria-label={t.secure} />
            )}
            <span className="truncate">{domainOf(page.url)}</span>
          </span>
        </span>
        <span aria-hidden="true" className="flex size-10 items-center justify-center text-scene-ink-2">
          <Ellipsis className="size-5" strokeWidth={2.2} />
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-scene-paper">
        {trap ? (
          <TrapSite page={trap} busy={busy} onSubmit={onSubmit} />
        ) : store && shop ? (
          <ShopSite page={store} actions={shop} onClose={onClose} />
        ) : request && shop ? (
          <RequestSite page={request} actions={shop} onClose={onClose} />
        ) : order && shop ? (
          <OrderSite page={order} actions={shop} onClose={onClose} />
        ) : (
          <PlainSite url={page.url} onClose={onClose} />
        )}
      </div>

      {/* Lab uyarısı: sayfanın dışında, pencerenin altında */}
      {trap ? (
        <p className="flex flex-none items-start gap-2 border-t border-scene-amber-line bg-scene-amber-soft px-4 py-2 text-xs leading-normal text-scene-amber-ink">
          <Info className="mt-px size-3.5 flex-none" strokeWidth={2.2} aria-hidden="true" />
          {t.warning}
        </p>
      ) : null}
    </div>
  );
}

function AddressBar({ url, trap }: { url: string; trap: boolean }) {
  const t = getMessages().lab.browser;
  const domain = domainOf(url);
  const rest = url.slice(url.indexOf(domain) + domain.length);
  return (
    <span className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-scene-paper px-3.5 text-[13px]">
      {trap ? (
        <span className="flex flex-none items-center gap-1 border-r border-scene-line-strong pr-2 font-bold text-scene-red">
          <TriangleAlert className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
          {t.notSecure}
        </span>
      ) : (
        <Lock className="size-3.5 flex-none text-scene-ink-muted" strokeWidth={2.2} aria-label={t.secure} />
      )}
      <span className="truncate text-scene-ink-muted">
        {trap ? plainScheme : secureScheme}
        <span className="text-scene-ink">{domain}</span>
        {rest}
      </span>
    </span>
  );
}

function Countdown() {
  const [left, setLeft] = useState(countdownStart);
  useEffect(() => {
    const timer = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60].map(pad).join(":");
  return <span className="font-mono">{clock}</span>;
}

function TrapSite({ page, busy, onSubmit }: { page: Extract<LinkPage, { kind: "trap" }>; busy: boolean; onSubmit: () => void }) {
  const t = getMessages().lab.browser;
  const inbox = getMessages().lab.inbox;
  const [value, setValue] = useState("");
  const fieldId = useId();
  const account = page.compromise === "account";

  function submit() {
    if (!value.trim() || busy) return;
    // Yazılan metin hiçbir yere gitmez; kutu hemen boşaltılır.
    setValue("");
    onSubmit();
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 bg-scene-site px-4 py-3 text-scene-site-ink desk:px-7">
        <span className="flex items-center gap-2 text-base font-bold tracking-[0.5px] desk:text-lg">
          <Globe className="size-5" strokeWidth={2.2} aria-hidden="true" />
          {page.site.toLocaleUpperCase("tr")}
        </span>
        <span aria-hidden="true" className="hidden gap-6 text-sm font-bold desk:flex">
          {t.siteNav.map((link) => (
            <span key={link}>{link}</span>
          ))}
        </span>
      </div>
      <div className="mx-auto flex max-w-[440px] flex-col gap-4 px-4 py-6 desk:py-8">
        {page.title ? <h1 className="text-[22px] leading-tight font-bold desk:text-[26px]">{page.title}</h1> : null}
        {page.text ? <p className="text-[15px] leading-normal text-scene-ink-2">{page.text}</p> : null}
        <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-scene-red/40 bg-scene-red-soft px-2.5 py-1.5 text-[13px] font-bold text-scene-red">
          {t.timer}
          <Countdown />
        </span>
        <div className="flex flex-col gap-3 rounded-2xl border border-scene-line bg-scene-white p-5 shadow-[0_8px_24px_var(--scene-shadow)]">
          {account ? (
            <>
              <span className="flex items-center gap-2 text-[15px]">
                {/* Postam hesabıysa Postam girişi, değilse lab yazarının yazdığı hesap (sabah soruları 25d). */}
                <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-md bg-scene-orange text-scene-white">
                  {page.account.mail ? <Mail className="size-4" strokeWidth={2.2} /> : <KeyRound className="size-4" strokeWidth={2.2} />}
                </span>
                <b>{page.account.mail ? inbox.app : page.account.name}</b>
                <span className="text-scene-ink-3">{t.continueWith}</span>
              </span>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                {t.email}
                <input
                  readOnly
                  value={inbox.account}
                  className="h-12 rounded-[10px] border border-scene-line-strong bg-scene-paper px-3 text-base font-normal text-scene-ink"
                />
              </label>
            </>
          ) : null}
          <label htmlFor={fieldId} className="text-[13px] font-bold">
            {page.ask}
          </label>
          <input
            id={fieldId}
            type={account ? "password" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore=""
            data-lpignore="true"
            placeholder={t.placeholder}
            className="-mt-1.5 h-12 rounded-[10px] border border-scene-line-strong bg-scene-white px-3 text-base text-scene-ink outline-none focus:border-scene-orange"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || busy}
            className="h-12 cursor-pointer rounded-xl bg-scene-orange font-bold text-scene-white disabled:cursor-default disabled:opacity-50"
          >
            {account ? t.submit : t.submitOther}
          </button>
          {account ? (
            <span className="flex items-center gap-1.5 text-xs text-scene-ink-muted">
              <Lock className="size-3 text-scene-green" strokeWidth={2.4} aria-hidden="true" />
              {format(t.secureFooter, { account: page.account.name })}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

/**
 * Görevli odanın mağaza sayfası (Para Çarşısı): gerçek ve sahte bağlantıda aynı sayfa, fark yalnızca
 * adres çubuğunda; "Güvenli değil" uyarısı yok. Kart bilgisi "Annenin kartını kullan" ile dolar,
 * öğrenci hiçbir şey yazmaz ve kart bilgisi hiçbir yere gitmez: "Öde" yalnızca "bilgi girildi"
 * olayını yazar ve veliye gelen SMS'i getirir. SMS ortaya gelen velinin telefonunda açılır
 * (MissionSms): "Kodu yaz" ya da "Yazma, anneme anlat".
 */
function ShopSite({ page, actions, onClose }: { page: Extract<LinkPage, { kind: "shop" }>; actions: ShopActions; onClose: () => void }) {
  const t = getMessages().lab.shop;
  const { mission } = actions;
  const [step, setStep] = useState<"card" | "filled" | "sms" | "after">("card");
  const [sms, setSms] = useState<ShopSms | null>(null);
  const [after, setAfter] = useState<{ reply: string; done: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // Ödeyince velinin telefonu ortaya gelir (MissionSms); karar ve cevap orada.
  const [phone, setPhone] = useState(false);
  const Icon = cardIconMap[page.shop.icon];

  async function pay() {
    if (busy) return;
    setBusy(true);
    const result = await actions.onPay();
    setBusy(false);
    if (!result) return;
    setSms(result);
    setStep("sms");
    setPhone(true);
  }

  async function code(enter: boolean) {
    if (busy) return;
    setBusy(true);
    const result = await actions.onCode(enter);
    setBusy(false);
    if (!result) return;
    setAfter(result);
    setStep("after");
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 bg-scene-shop px-4 py-2.5 text-scene-shop-ink desk:px-5">
        <span className="text-[15px] font-extrabold tracking-[0.3px]">{page.shop.name.toLocaleUpperCase("tr")}</span>
        <span aria-hidden="true" className="hidden gap-4 text-[13px] opacity-80 wide:flex">
          {t.nav.map((link) => (
            <span key={link}>{link}</span>
          ))}
        </span>
      </div>
      <div className="m-3 grid gap-4 rounded-[14px] border border-scene-line bg-scene-white p-4 wide:m-[18px] wide:grid-cols-[110px_minmax(0,1fr)]">
        <span aria-hidden="true" className="flex aspect-square max-w-[110px] items-center justify-center rounded-xl bg-scene-product text-scene-ink-2">
          <Icon className="size-12" strokeWidth={1.6} />
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="text-base font-bold text-scene-ink">{page.shop.product}</h1>
          <span className="my-1.5 text-2xl font-extrabold text-scene-ink">{page.shop.price}</span>
          {page.shop.note ? <span className="text-xs text-scene-ink-muted">{page.shop.note}</span> : null}
          <div className="mt-2.5 flex flex-col gap-2">
            {step === "card" ? (
              <button type="button" onClick={() => setStep("filled")} className="h-11 cursor-pointer rounded-[10px] bg-scene-orange font-bold text-scene-white hover:bg-scene-orange-strong">
                {format(t.useCard, { owner: mission.owner })}
              </button>
            ) : (
              <span className="rounded-lg border border-scene-line bg-scene-paper px-2.5 py-1.5 font-mono text-xs text-scene-ink-2" data-testid="shop-card">
                {format(t.cardFilled, { number: mission.card?.number ?? "", expiry: mission.card?.expiry ?? "" })}
              </span>
            )}
            {step === "filled" ? (
              <button type="button" onClick={pay} disabled={busy} className="h-11 cursor-pointer rounded-[10px] bg-scene-orange font-bold text-scene-white hover:bg-scene-orange-strong disabled:cursor-default disabled:opacity-60">
                {busy ? t.paying : format(t.pay, { price: page.shop.price })}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {sms && phone ? (
        <MissionSms
          caller={mission.caller}
          message={rich(format(t.sms, { shop: sms.shop, amount: sms.amount, code: sms.code, note: sms.note }), { b: (chunk) => <b>{chunk}</b> })}
          enter={t.enter}
          refuse={mission.refuse}
          busy={busy}
          reply={after?.reply || null}
          decided={after !== null}
          onDecide={code}
          onClose={() => setPhone(false)}
        />
      ) : null}

      {sms ? (
        <div className="mx-3 mb-4 grid gap-2.5 rounded-[14px] border border-scene-line bg-scene-white px-4 py-3.5 wide:mx-[18px]" aria-live="polite">
          {after ? (
            <div className="flex flex-col items-start gap-2">
              {after.done ? (
                <span className="flex items-center gap-2 text-sm font-bold text-scene-green">
                  <Check className="size-4" strokeWidth={2.6} aria-hidden="true" />
                  {t.ordered}
                </span>
              ) : null}
              <span className="text-[13px] text-scene-ink-muted">{after.done ? format(t.orderedText, { product: page.shop.product }) : t.stoppedText}</span>
              <button type="button" onClick={onClose} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-scene-blue px-3.5 text-[13.5px] font-bold text-scene-white">
                <ShoppingBag className="size-4" strokeWidth={2.2} aria-hidden="true" />
                {t.close}
              </button>
            </div>
          ) : (
            // Telefon kapatıldıysa (Esc yok, ama sekme değişirse) yeniden açılır.
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[13px] text-scene-ink-muted">{format(t.waiting, { caller: mission.caller })}</span>
              <button type="button" onClick={() => setPhone(true)} className="min-h-10 cursor-pointer rounded-[10px] bg-scene-ink px-3.5 text-[13.5px] font-bold text-scene-white">
                {t.openPhone}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

/**
 * Satış görevli odada bankanın ödeme isteği (Para Çarşısı "Eski telefonunu sat"): bankanın kendi
 * ekranı, sahte site değil. Dolandırıcı alıcı "parayı almak için onayla" der; ekranda ise isteyenin
 * senden para istediği yazar. "Onayla" sahte istekte ele geçirilmedir (oynatıcı kötü bitişi açar),
 * "Reddet" bankanın ya da velinin cevabını getirir.
 */
function RequestSite({ page, actions, onClose }: { page: Extract<LinkPage, { kind: "request" }>; actions: ShopActions; onClose: () => void }) {
  const t = getMessages().lab.bank;
  const [busy, setBusy] = useState(false);
  const [after, setAfter] = useState<{ reply: string } | null>(null);

  async function decide(approve: boolean) {
    if (busy) return;
    setBusy(true);
    const result = await actions.onCode(approve);
    setBusy(false);
    if (result) setAfter({ reply: result.reply });
  }

  const rows = [
    [t.from, page.from],
    [t.amount, page.amount],
    [t.account, t.yourAccount],
  ] as const;

  return (
    <>
      <div className="flex items-center gap-2 bg-scene-blue px-4 py-3 text-scene-white desk:px-5">
        <Landmark className="size-5" strokeWidth={2.2} aria-hidden="true" />
        <span className="text-[15px] font-extrabold tracking-[0.3px]">{page.bank.toLocaleUpperCase("tr")}</span>
      </div>
      <div className="mx-auto flex max-w-[420px] flex-col gap-4 px-4 py-6" data-testid="bank-request">
        <div className="flex flex-col gap-3 rounded-2xl border border-scene-line bg-scene-white p-5 shadow-[0_8px_24px_var(--scene-shadow)]">
          <h1 className="text-xl font-bold">{t.title}</h1>
          <p className="text-[15px] leading-normal text-scene-ink-2">
            {rich(format(t.text, { from: page.from, amount: page.amount }), { b: (chunk) => <b className="text-scene-ink">{chunk}</b> })}
          </p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl bg-scene-paper px-3.5 py-3 text-[13.5px]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-scene-ink-muted">{label}</dt>
                <dd className="text-right font-bold text-scene-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-scene-ink-muted">{t.note}</p>
          {after ? (
            <div className="flex flex-col items-start gap-2.5" aria-live="polite">
              <span className="flex items-center gap-2 text-sm font-bold text-scene-green">
                <Check className="size-4" strokeWidth={2.6} aria-hidden="true" />
                {t.rejected}
              </span>
              {after.reply ? <p className="rounded-[16px_16px_16px_4px] bg-scene-bubble px-3 py-2 text-[14px] leading-snug">{after.reply}</p> : null}
              <button type="button" onClick={onClose} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-scene-blue px-3.5 text-[13.5px] font-bold text-scene-white">
                {t.back}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" disabled={busy} onClick={() => void decide(false)} className="min-h-12 cursor-pointer rounded-xl border border-scene-line-strong bg-scene-white font-bold text-scene-ink hover:border-scene-ink-2 disabled:opacity-60">
                {t.reject}
              </button>
              <button type="button" disabled={busy} onClick={() => void decide(true)} className="min-h-12 cursor-pointer rounded-xl bg-scene-blue font-bold text-scene-white disabled:opacity-60">
                {busy ? t.approving : t.approve}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Satış görevli odada pazar yerindeki sipariş: ilan, alıcı, "ödeme güvende" notu, kargodan önceki
 * hazırlık maddeleri (işaretler yalnızca bu ekranda kalır; sunucuya hepsinin işaretli olup olmadığı
 * gider) ve "Kargoya ver". Hazırlamadan gönderince alıcının mesajı gelir.
 */
function OrderSite({ page, actions, onClose }: { page: Extract<LinkPage, { kind: "order" }>; actions: ShopActions; onClose: () => void }) {
  const t = getMessages().lab.order;
  const [checked, setChecked] = useState<boolean[]>(() => page.sale.prep.map(() => false));
  const [busy, setBusy] = useState(false);
  const [after, setAfter] = useState<{ reply: string; done: boolean } | null>(null);
  const Icon = cardIconMap[page.sale.icon];
  const prepared = checked.length > 0 && checked.every(Boolean);

  async function ship() {
    if (busy || after) return;
    setBusy(true);
    const result = await actions.onShip(prepared);
    setBusy(false);
    if (result) setAfter(result);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 bg-scene-shop px-4 py-2.5 text-scene-shop-ink desk:px-5">
        <span className="text-[15px] font-extrabold tracking-[0.3px]">{page.sale.platform.toLocaleUpperCase("tr")}</span>
        <span aria-hidden="true" className="hidden gap-4 text-[13px] opacity-80 wide:flex">
          {t.nav.map((link) => (
            <span key={link}>{link}</span>
          ))}
        </span>
      </div>
      <div className="m-3 flex flex-col gap-4 wide:m-[18px]" data-testid="sale-order">
        <div className="grid gap-4 rounded-[14px] border border-scene-line bg-scene-white p-4 wide:grid-cols-[96px_minmax(0,1fr)]">
          <span aria-hidden="true" className="flex aspect-square max-w-[96px] items-center justify-center rounded-xl bg-scene-product text-scene-ink-2">
            <Icon className="size-10" strokeWidth={1.6} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-bold tracking-[0.6px] text-scene-ink-muted">{t.title.toLocaleUpperCase("tr")}</span>
            <h1 className="text-base font-bold text-scene-ink">{page.sale.product}</h1>
            <span className="text-2xl font-extrabold text-scene-ink">{page.sale.price}</span>
            <span className="text-[13px] text-scene-ink-2">{format(t.buyer, { buyer: page.buyer })}</span>
            <span className="mt-1 flex items-start gap-1.5 text-xs text-scene-green">
              <Lock className="mt-px size-3.5 flex-none" strokeWidth={2.2} aria-hidden="true" />
              {format(t.safe, { platform: page.sale.platform })}
            </span>
          </div>
        </div>

        {page.sale.prep.length > 0 ? (
          <fieldset className="flex flex-col gap-1 rounded-[14px] border border-scene-line bg-scene-white p-4 [color-scheme:light]" disabled={!!after}>
            <legend className="px-1 text-[13px] font-bold text-scene-ink">{t.prepTitle}</legend>
            {page.sale.prep.map((step, i) => (
              <label key={step} className="flex min-h-10 cursor-pointer items-center gap-3 text-[14px] text-scene-ink-2">
                <input
                  type="checkbox"
                  checked={checked[i] ?? false}
                  onChange={(e) => setChecked((all) => all.map((v, j) => (j === i ? e.target.checked : v)))}
                  className="size-5 flex-none cursor-pointer accent-[var(--scene-green)]"
                />
                {step}
              </label>
            ))}
          </fieldset>
        ) : null}

        {after ? (
          <div className="flex flex-col items-start gap-2 rounded-[14px] border border-scene-line bg-scene-white px-4 py-3.5" aria-live="polite">
            {after.reply ? (
              <>
                <span className="flex items-center gap-2 text-sm font-bold text-scene-orange-strong">
                  <TriangleAlert className="size-4" strokeWidth={2.4} aria-hidden="true" />
                  {t.unpreparedTitle}
                </span>
                <p className="rounded-[16px_16px_16px_4px] bg-scene-bubble px-3 py-2 text-[14px] leading-snug">{after.reply}</p>
              </>
            ) : (
              <>
                <span className="flex items-center gap-2 text-sm font-bold text-scene-green">
                  <Check className="size-4" strokeWidth={2.6} aria-hidden="true" />
                  {t.shipped}
                </span>
                <span className="text-[13px] text-scene-ink-muted">{format(t.shippedText, { price: page.sale.price })}</span>
              </>
            )}
            <button type="button" onClick={onClose} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-scene-blue px-3.5 text-[13.5px] font-bold text-scene-white">
              <Package className="size-4" strokeWidth={2.2} aria-hidden="true" />
              {t.back}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => void ship()} disabled={busy} className="h-12 cursor-pointer rounded-xl bg-scene-orange font-bold text-scene-white hover:bg-scene-orange-strong disabled:cursor-default disabled:opacity-60">
            {busy ? t.shipping : t.ship}
          </button>
        )}
      </div>
    </>
  );
}

function PlainSite({ url, onClose }: { url: string; onClose: () => void }) {
  const t = getMessages().lab.browser;
  return (
    <div className="mx-auto flex max-w-[460px] flex-col items-center gap-3 px-5 py-12 text-center">
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-scene-white text-scene-blue shadow-[0_8px_24px_var(--scene-shadow)]">
        <Globe className="size-7" strokeWidth={2} />
      </span>
      <h1 className="text-xl font-bold">{t.siteTitle}</h1>
      <p className="text-[15px] leading-normal text-scene-ink-2">{t.siteText}</p>
      <code className="rounded-md border border-scene-line-strong bg-scene-white px-2 py-1 font-mono text-[13px] break-all text-scene-ink-2">{url}</code>
      <p className="text-sm text-scene-ink-muted">{t.siteNote}</p>
      <button type="button" onClick={onClose} className="mt-2 h-11 cursor-pointer rounded-xl bg-scene-blue px-5 font-bold text-scene-white">
        {t.back}
      </button>
    </div>
  );
}
