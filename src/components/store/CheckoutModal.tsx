// ============================================================
// WMDM Desktop App — Checkout Modal
// In-app Stripe checkout for purchasing products
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StoreProduct } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { useProductStore } from "../../stores/productStore";
import * as api from "../../api/tauri";

// Stripe test publishable key
const STRIPE_PK = "pk_test_Fmm9Ff6ToBHLw6dCbhPvVo3M";
const stripePromise = loadStripe(STRIPE_PK);

interface OrderResponse {
  success: boolean;
  requires_action?: boolean;
  client_secret?: string;
  payment_intent_id?: string;
  quote_id?: number;
  order_id?: string;
  order_increment_id?: string;
  error?: string;
}

// ─── API helpers (direct Magento REST calls) ───────────────

// All API calls go through Rust commands (api.createCart, api.placeOrder, api.confirm3ds)

// ─── Checkout Step Indicator ───────────────────────────────

function StepIndicator({ step }: { step: "card" | "processing" | "success" | "error" }) {
  const steps = [
    { key: "card", label: "Payment" },
    { key: "processing", label: "Processing" },
    { key: "success", label: "Complete" },
  ] as const;

  const currentIndex =
    step === "error" ? 1 : steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${
              i < currentIndex
                ? "bg-wmdm-success text-white"
                : i === currentIndex
                ? step === "error"
                  ? "bg-wmdm-error text-white"
                  : "bg-wmdm-accent text-white"
                : "bg-wmdm-border text-wmdm-text-muted"
            }`}
          >
            {i < currentIndex ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 5.5l2 2 4-5" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-8 h-0.5 rounded ${
                i < currentIndex ? "bg-wmdm-success" : "bg-wmdm-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Spinner ───────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Card Input Form (inside Elements provider) ────────────

interface CheckoutFormProps {
  product: StoreProduct;
  onClose: () => void;
}

function CheckoutForm({ product, onClose }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const user = useAuthStore((s) => s.user);
  const syncAll = useProductStore((s) => s.syncAll);

  const [step, setStep] = useState<"card" | "processing" | "success" | "error">("card");
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Cart state
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [cartPrice, setCartPrice] = useState<number>(product.price);
  const [cartCurrency, setCartCurrency] = useState<string>("usd");
  const [isCreatingCart, setIsCreatingCart] = useState(true);
  const [cartError, setCartError] = useState<string | null>(null);

  // API creds

  // Initialize: get auth token + create cart
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const cart = await api.createCart(product.id);
        if (cancelled) return;

        if (!cart.success || !cart.quoteId) {
          setCartError(cart.error || "Failed to create cart.");
          setIsCreatingCart(false);
          return;
        }

        setQuoteId(cart.quoteId);
        setCartPrice(cart.price ?? product.price);
        setCartCurrency(cart.currency ?? "usd");
        setIsCreatingCart(false);
      } catch (e) {
        if (cancelled) return;
        setCartError(e instanceof Error ? e.message : "Failed to initialize checkout.");
        setIsCreatingCart(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [product.id, product.price]);

  const handleSubmit = useCallback(async () => {
    if (!stripe || !elements || !quoteId || !user) return;

    setIsSubmitting(true);
    setError(null);
    setStep("processing");

    try {
      // Create PaymentMethod from card
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message || "Card error");
      }

      if (!paymentMethod) {
        throw new Error("Failed to create payment method");
      }

      // Place order via Rust → Magento
      const orderResult = await api.placeOrder(user.email, paymentMethod.id, quoteId) as unknown as OrderResponse;

      // Handle 3DS
      if (orderResult.requires_action && orderResult.client_secret) {
        const { error: confirmError, paymentIntent } =
          await stripe.confirmCardPayment(orderResult.client_secret);

        if (confirmError) {
          throw new Error(confirmError.message || "3D Secure authentication failed");
        }

        if (paymentIntent?.status === "succeeded") {
          const confirmResult = await api.confirm3ds(paymentIntent.id, orderResult.quote_id || quoteId) as unknown as OrderResponse;

          if (!confirmResult.success) {
            throw new Error(confirmResult.error || "Order confirmation failed");
          }

          setOrderId(confirmResult.order_increment_id || null);
        } else {
          throw new Error("Payment was not completed");
        }
      } else if (orderResult.success) {
        setOrderId(orderResult.order_increment_id || null);
      } else {
        throw new Error(orderResult.error || "Order placement failed");
      }

      // Success
      setStep("success");

      // Sync library in background to pick up the new purchase
      syncAll().catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed. Please try again.";
      setError(msg);
      setStep("error");
      setIsSubmitting(false);
    }
  }, [stripe, elements, quoteId, user, syncAll]);

  const formatPrice = (price: number, currency: string) => {
    const symbol = currency === "usd" ? "$" : currency.toUpperCase() + " ";
    return `${symbol}${price.toFixed(2)}`;
  };

  // ─── Loading state (creating cart) ─────────────────────────

  if (isCreatingCart) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner size={28} />
        <p className="text-sm text-wmdm-text-muted mt-3">Preparing checkout...</p>
      </div>
    );
  }

  // ─── Cart error ────────────────────────────────────────────

  if (cartError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-12 h-12 rounded-full bg-wmdm-error/20 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6v5" />
            <circle cx="10" cy="14" r="0.5" fill="#ef4444" />
          </svg>
        </div>
        <p className="text-sm text-wmdm-error text-center mb-4">{cartError}</p>
        <button onClick={onClose} className="btn-secondary text-xs px-4 py-2">
          Close
        </button>
      </div>
    );
  }

  // ─── Success state ─────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <StepIndicator step="success" />
        <div className="w-16 h-16 rounded-full bg-wmdm-success/20 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round">
            <path d="M6 14.5l5.5 5.5L22 8" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-wmdm-text mb-1">Purchase Complete!</h3>
        {orderId && (
          <p className="text-xs text-wmdm-text-muted mb-1">Order #{orderId}</p>
        )}
        <p className="text-sm text-wmdm-text-muted text-center mb-6">
          {product.name} has been added to your library. It will appear in your library shortly.
        </p>
        <button
          onClick={onClose}
          className="bg-wmdm-accent hover:bg-wmdm-accent-hover text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  // ─── Payment form / Processing / Error ─────────────────────

  return (
    <div>
      <StepIndicator step={step} />

      {/* Product summary */}
      <div className="flex items-center gap-3 bg-wmdm-bg rounded-lg p-3 mb-5 border border-wmdm-border">
        {product.thumbnailUrl ? (
          <img
            src={product.thumbnailUrl}
            alt=""
            className="w-12 h-12 rounded-md object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-md bg-wmdm-border flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-wmdm-text-muted">
              <rect x="2" y="4" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-wmdm-text truncate">{product.name}</p>
          {product.creator && (
            <p className="text-xs text-wmdm-text-muted">by {product.creator.name}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-wmdm-text">
            {formatPrice(cartPrice, cartCurrency)}
          </p>
        </div>
      </div>

      {/* Card input */}
      <div className="mb-5">
        <label className="block text-xs text-wmdm-text-muted uppercase tracking-wider mb-2">
          Card Details
        </label>
        <div
          className={`bg-wmdm-bg border rounded-lg p-3.5 transition-colors ${
            step === "processing"
              ? "border-wmdm-border opacity-50 pointer-events-none"
              : "border-wmdm-border focus-within:border-wmdm-accent"
          }`}
        >
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "14px",
                  color: "#e2e8f0",
                  fontFamily: "Inter, system-ui, sans-serif",
                  "::placeholder": {
                    color: "#64748b",
                  },
                },
                invalid: {
                  color: "#ef4444",
                },
              },
              hidePostalCode: true,
            }}
            onChange={(e) => {
              setCardComplete(e.complete);
              if (e.error) {
                setError(e.error.message);
              } else {
                setError(null);
              }
            }}
          />
        </div>
      </div>

      {/* Error message */}
      {error && step === "error" && (
        <div className="bg-wmdm-error/10 border border-wmdm-error/20 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm text-wmdm-error">{error}</p>
        </div>
      )}

      {/* Processing state */}
      {step === "processing" && (
        <div className="flex items-center justify-center gap-2 text-wmdm-accent mb-4">
          <Spinner size={16} />
          <span className="text-sm">Processing payment...</span>
        </div>
      )}

      {/* Pay button */}
      <button
        onClick={handleSubmit}
        disabled={!cardComplete || isSubmitting || step === "processing" || !stripe}
        className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${
          !cardComplete || isSubmitting || step === "processing" || !stripe
            ? "bg-wmdm-accent/40 text-white/50 cursor-not-allowed"
            : "bg-wmdm-accent hover:bg-wmdm-accent-hover text-white shadow-lg shadow-wmdm-accent/20"
        }`}
      >
        {step === "processing" ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size={14} />
            Processing...
          </span>
        ) : step === "error" ? (
          `Retry Payment ${formatPrice(cartPrice, cartCurrency)}`
        ) : (
          `Pay ${formatPrice(cartPrice, cartCurrency)}`
        )}
      </button>

      {/* Security note */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-wmdm-text-muted">
          <path d="M3.5 5V3.5a2.5 2.5 0 015 0V5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <rect x="2" y="5" width="8" height="5.5" rx="1" stroke="currentColor" strokeWidth="1" />
          <circle cx="6" cy="8" r="0.75" fill="currentColor" />
        </svg>
        <span className="text-[10px] text-wmdm-text-muted">
          Secured by Stripe. Your card details are never stored.
        </span>
      </div>
    </div>
  );
}

// ─── Modal Wrapper ─────────────────────────────────────────

interface CheckoutModalProps {
  product: StoreProduct;
  onClose: () => void;
}

export default function CheckoutModal({ product, onClose }: CheckoutModalProps) {
  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-wmdm-surface rounded-2xl border border-wmdm-border shadow-2xl overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-base font-semibold text-wmdm-text">Checkout</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-wmdm-bg hover:bg-wmdm-border flex items-center justify-center transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-wmdm-text-muted">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <Elements
            stripe={stripePromise}
            options={{
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#6366f1",
                  colorBackground: "#0a0a0f",
                  colorText: "#e2e8f0",
                  colorDanger: "#ef4444",
                  fontFamily: "Inter, system-ui, sans-serif",
                  borderRadius: "8px",
                },
              },
            }}
          >
            <CheckoutForm product={product} onClose={onClose} />
          </Elements>
        </div>
      </div>
    </div>
  );
}
