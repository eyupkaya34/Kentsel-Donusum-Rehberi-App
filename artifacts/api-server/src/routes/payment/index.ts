import { Router, type IRouter, type Request, type Response } from "express";
// @ts-ignore — iyzipay has no bundled types
import Iyzipay from "iyzipay";

const router: IRouter = Router();

const AMOUNT = "49.99";
const CURRENCY = "TRY";

function getIyzipay() {
  const apiKey = process.env["IYZICO_API_KEY"];
  const secretKey = process.env["IYZICO_SECRET_KEY"];
  if (!apiKey || !secretKey) return null;
  return new Iyzipay({
    apiKey,
    secretKey,
    uri: "https://sandbox-api.iyzipay.com",
  });
}

router.post("/create-payment", async (req: Request, res: Response) => {
  const iyzipay = getIyzipay();

  if (!iyzipay) {
    res.json({ testMode: true, message: "İyzico credentials not configured — test mode active." });
    return;
  }

  const { buyerEmail = "musteri@example.com", buyerName = "Misafir", buyerSurname = "Kullanici" } = req.body ?? {};

  const host = req.headers["origin"] ?? `https://${req.headers["host"]}`;
  const callbackUrl = `${host}/odeme/callback`;

  const request = {
    locale: "tr",
    conversationId: `kd-${Date.now()}`,
    price: AMOUNT,
    paidPrice: AMOUNT,
    currency: CURRENCY,
    basketId: `rapor-${Date.now()}`,
    paymentGroup: "PRODUCT",
    callbackUrl,
    enabledInstallments: ["1"],
    buyer: {
      id: `buyer-${Date.now()}`,
      name: buyerName,
      surname: buyerSurname,
      gsmNumber: "+905350000000",
      email: buyerEmail,
      identityNumber: "74300864791",
      registrationAddress: "Türkiye",
      ip: req.ip ?? "127.0.0.1",
      city: "Istanbul",
      country: "Turkey",
      zipCode: "34000",
    },
    shippingAddress: {
      contactName: `${buyerName} ${buyerSurname}`,
      city: "Istanbul",
      country: "Turkey",
      address: "Türkiye",
      zipCode: "34000",
    },
    billingAddress: {
      contactName: `${buyerName} ${buyerSurname}`,
      city: "Istanbul",
      country: "Turkey",
      address: "Türkiye",
      zipCode: "34000",
    },
    basketItems: [
      {
        id: "analiz-raporu",
        name: "Kentsel Dönüşüm Analiz Raporu",
        category1: "Dijital Hizmet",
        itemType: "VIRTUAL",
        price: AMOUNT,
      },
    ],
  };

  iyzipay.checkoutFormInitialize.create(request, (err: unknown, result: Record<string, unknown>) => {
    if (err) {
      console.error("[payment] İyzico error:", err);
      res.status(500).json({ error: "Ödeme başlatılamadı. Lütfen tekrar deneyin." });
      return;
    }
    if (result.status !== "success") {
      console.error("[payment] İyzico failure:", result);
      res.status(400).json({ error: result.errorMessage ?? "Ödeme formu oluşturulamadı." });
      return;
    }
    res.json({
      token: result.token,
      checkoutFormContent: result.checkoutFormContent,
      paymentPageUrl: result.paymentPageUrl,
    });
  });
});

router.post("/verify", async (req: Request, res: Response) => {
  const iyzipay = getIyzipay();
  if (!iyzipay) { res.json({ testMode: true }); return; }

  const { token } = req.body ?? {};
  if (!token) { res.status(400).json({ error: "Token eksik." }); return; }

  iyzipay.checkoutForm.retrieve({ locale: "tr", conversationId: `verify-${Date.now()}`, token }, (err: unknown, result: Record<string, unknown>) => {
    if (err || result.status !== "success" || result.paymentStatus !== "SUCCESS") {
      res.status(400).json({ error: "Ödeme doğrulanamadı." });
      return;
    }
    res.json({ success: true });
  });
});

export default router;
