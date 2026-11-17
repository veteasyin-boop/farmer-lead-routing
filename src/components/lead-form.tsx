"use client";

import { FormEvent, useMemo, useState } from "react";

const products = [
  "गेहूँ बीज", "धान बीज", "मक्का बीज", "सरसों बीज", "चना / दलहन बीज",
  "सब्ज़ी बीज", "खाद / उर्वरक", "कीटनाशक", "फसल सुरक्षा उत्पाद", "अन्य",
];

type Props = { adSource: string };

export function LeadForm({ adSource }: Props) {
  const [form, setForm] = useState({ farmerName: "", phone: "", product: "", quantity: "", village: "", pincode: "" });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationText, setLocationText] = useState("लोकेशन वैकल्पिक है; पिनकोड से भी लोकेशन खोजी जाएगी।");
  const [locationBusy, setLocationBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const canSubmit = useMemo(() => form.farmerName.trim().length >= 2
    && /^\d{10}$/.test(form.phone)
    && form.product.length > 0
    && form.quantity.trim().length > 0
    && form.village.trim().length >= 2
    && /^\d{6}$/.test(form.pincode), [form]);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function sendLocation() {
    setError("");
    if (!navigator.geolocation) {
      setLocationText("इस ब्राउज़र में GPS उपलब्ध नहीं है। पिनकोड से लोकेशन खोजी जाएगी।");
      return;
    }

    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationText("आपकी लोकेशन मिल गई है।");
        setLocationBusy(false);
      },
      () => {
        setLocation(null);
        setLocationText("लोकेशन की अनुमति नहीं मिली। पिनकोड से लोकेशन खोजी जाएगी।");
        setLocationBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          adSource,
        }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error || "अभी अनुरोध दर्ज नहीं हो पाया। कृपया दोबारा प्रयास करें।");
        return;
      }
      setSuccess(true);
    } catch {
      setError("इंटरनेट कनेक्शन जाँचकर दोबारा प्रयास करें।");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center px-5">
        <div className="w-full max-w-md rounded-2xl bg-white border border-[#e0e8df] px-6 py-12 text-center shadow-sm">
          <p className="text-xl sm:text-2xl font-bold leading-relaxed text-[#173126]">आपका ऑर्डर मिल गया, जल्द संपर्क किया जाएगा</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[100svh] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-lg">
        <header className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#237348] text-2xl text-white" aria-hidden="true">🌾</div>
          <div>
            <p className="text-lg font-extrabold tracking-tight text-[#173126]">किसान संपर्क</p>
            <p className="text-xs muted">आपकी जरूरत, सही स्थानीय संपर्क</p>
          </div>
        </header>

        <section className="panel overflow-hidden">
          <div className="bg-[#edf5ed] px-5 py-5 sm:px-6">
            <p className="text-sm font-semibold text-[#237348]">कृषि उत्पाद के लिए अनुरोध</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-snug text-[#173126]">अपनी जानकारी भरें</h1>
            <p className="mt-1 text-sm text-[#62766a]">जानकारी मिलने पर हमारी टीम आपसे संपर्क करेगी।</p>
          </div>

          <form className="space-y-4 p-5 sm:p-6" onSubmit={submit}>
            <div>
              <label className="label" htmlFor="farmerName">किसान का नाम</label>
              <input id="farmerName" className="field" autoComplete="name" maxLength={100} placeholder="अपना नाम लिखें" value={form.farmerName} onChange={(e) => update("farmerName", e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="phone">मोबाइल नंबर</label>
              <input id="phone" className="field" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10 अंकों का मोबाइल नंबर" value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} required />
            </div>
            <div>
              <label className="label" htmlFor="product">उत्पाद चुनें</label>
              <select id="product" className="field" value={form.product} onChange={(e) => update("product", e.target.value)} required>
                <option value="">उत्पाद चुनें</option>
                {products.map((product) => <option key={product} value={product}>{product}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="quantity">कितनी मात्रा चाहिए?</label>
              <input id="quantity" className="field" maxLength={50} placeholder="जैसे 2 पैकेट / 5 किलो" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="village">गाँव / पंचायत</label>
              <input id="village" className="field" maxLength={120} autoComplete="address-level2" placeholder="अपने गाँव का नाम लिखें" value={form.village} onChange={(e) => update("village", e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="pincode">पिनकोड</label>
              <input id="pincode" className="field" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="6 अंकों का पिनकोड" value={form.pincode} onChange={(e) => update("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} required />
            </div>

            <div className="rounded-xl border border-[#e2ebe1] bg-[#f8faf7] p-3">
              <button type="button" onClick={sendLocation} disabled={locationBusy} className="btn-secondary w-full min-h-11">
                <span aria-hidden="true">📍</span>{locationBusy ? "लोकेशन ली जा रही है…" : "मेरी लोकेशन भेजें"}
              </button>
              <p className="mt-2 text-xs leading-relaxed text-[#6c7b72]" aria-live="polite">{locationText}</p>
            </div>

            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button type="submit" disabled={!canSubmit || submitting} className="btn-primary min-h-12 w-full text-base">
              {submitting ? "भेजा जा रहा है…" : "अनुरोध भेजें"}
            </button>
            <p className="text-center text-[11px] leading-relaxed text-[#809087]">आपकी जानकारी का उपयोग केवल आपके अनुरोध पर संपर्क करने के लिए किया जाएगा।</p>
          </form>
        </section>
        <p className="mt-4 text-center text-xs text-[#839188]">कम इंटरनेट स्पीड में भी उपयोग के लिए बनाया गया</p>
      </div>
    </main>
  );
}
