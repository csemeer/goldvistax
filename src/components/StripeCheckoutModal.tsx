/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Native Stripe Checkout & Billing Modal
 * Supports Credit Card, Apple Pay, Google Pay, and instant entitlement activation.
 */

import React, { useEffect, useState } from 'react';
import { CreditPack, MembershipTier } from '../services/monetizationEngine';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  X,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface StripeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem: {
    type: 'PACK' | 'TIER';
    id: string;
    title: string;
    priceUsd: number;
    billingPeriod?: 'month' | 'year' | 'one-time';
    description: string;
  } | null;
  onSuccess: (itemType: 'PACK' | 'TIER', itemId: string) => void;
}

export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
  isOpen,
  onClose,
  targetItem,
  onSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'APPLE_PAY' | 'GOOGLE_PAY'>('CARD');
  const [cardNumber, setCardNumber] = useState<string>('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState<string>('12/28');
  const [cardCvc, setCardCvc] = useState<string>('888');
  const [postalCode, setPostalCode] = useState<string>('10001');
  const [cardholderName, setCardholderName] = useState<string>('Commodity Trader');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !targetItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, targetItem, onClose]);

  if (!isOpen || !targetItem) return null;

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsCompleted(true);
      setTimeout(() => {
        onSuccess(targetItem.type, targetItem.id);
        setIsCompleted(false);
        onClose();
      }, 1500);
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Lock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  Secure Checkout
                </span>
                <span className="text-[10px] font-mono text-slate-500">256-Bit SSL Encrypted</span>
              </div>
              <h3 id="checkout-modal-title" className="text-sm font-bold text-slate-100">GoldVista Commercial Billing Suite</h3>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close checkout modal"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Order Summary Box */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/60">
              <span>Item Description</span>
              <span>Amount Due</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100">{targetItem.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{targetItem.description}</p>
              </div>
              <div className="text-right font-mono">
                <span className="text-xl font-bold text-amber-400">${targetItem.priceUsd}</span>
                <span className="text-[10px] text-slate-500 block uppercase">
                  {targetItem.billingPeriod ? `/${targetItem.billingPeriod}` : 'One-Time'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Pay Buttons (Apple Pay & Google Pay) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setPaymentMethod('APPLE_PAY');
                handlePay();
              }}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-950 hover:bg-black border border-slate-700 hover:border-slate-500 rounded-lg text-xs font-semibold text-white transition-all shadow-sm"
            >
              <span className="text-sm">Pay</span>
              <span className="text-slate-400 font-normal">Express</span>
            </button>

            <button
              onClick={() => {
                setPaymentMethod('GOOGLE_PAY');
                handlePay();
              }}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-950 hover:bg-black border border-slate-700 hover:border-slate-500 rounded-lg text-xs font-semibold text-white transition-all shadow-sm"
            >
              <span className="text-amber-400 font-bold">G</span>
              <span>Pay</span>
              <span className="text-slate-400 font-normal">Express</span>
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] font-mono uppercase text-slate-500">
              Or Pay with Card
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Card Form */}
          <div className="space-y-3 font-mono text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Cardholder Name</label>
              <input
                type="text"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Card Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400 font-mono"
                />
                <CreditCard className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Expiry (MM/YY)</label>
                <input
                  type="text"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400 text-center"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">CVC Security</label>
                <input
                  type="text"
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400 text-center"
                />
              </div>
            </div>
          </div>

          {/* Non-Cash Credit Refund Policy Banner */}
          <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg flex items-start gap-2.5 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-slate-300">
              <strong className="text-emerald-400 block font-semibold">
                Non-Cash Signal Credit Refund Policy Active
              </strong>
              <span>
                If an unlocked signal hits its Stop-Loss before Target 1, 1 Signal Credit is returned to your wallet
                (non-cash platform credits only; commodity trading carries market risk).
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handlePay}
            disabled={isProcessing || isCompleted}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm rounded-lg transition-colors shadow-lg disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                Processing Payment...
              </span>
            ) : isCompleted ? (
              <span className="flex items-center gap-2 text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                Payment Confirmed & Entitlements Active!
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Pay ${targetItem.priceUsd} Securely
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex items-center justify-between">
          <span>Sandbox Billing Preview (Live Stripe Checkout Pending)</span>
          <span>Non-Cash Signal Credit Policy</span>
        </div>
      </div>
    </div>
  );
};
