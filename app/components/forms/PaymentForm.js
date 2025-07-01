"use client";
import { useState, useEffect } from "react";
import { Elements, useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Use environment variable for publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function PaymentForm({ userId, amount = 10, onSuccess }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'},
          body: JSON.stringify({
            userId,
            amount})});

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create payment intent');
        }
        
        setClientSecret(data.clientSecret);
      } catch (err) {
        setError(err.message);
        console.error('Error creating payment intent:', err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      createPaymentIntent();
    }
  }, [userId, amount]);

  const options = {
    clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#0057FF',
        colorBackground: '#1a1a1a',
        colorText: '#ffffff',
        colorDanger: '#ff4444',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
        // Responsive font sizes
        fontSizeBase: '16px',
        fontSizeSm: '14px',
        fontSizeLg: '18px'},
      rules: {
        '.Input': {
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'none',
          fontSize: '16px',
          padding: '10px 14px',
          '@media (max-width: 768px)': {
            fontSize: '14px',
            padding: '8px 12px'}},
        '.Input:focus': {
          border: '1px solid hsl(var(--primary))',
          boxShadow: '0 0 0 1px #0057FF'},
        '.Label': {
          fontSize: '14px',
          marginBottom: '8px',
          color: 'rgba(255, 255, 255, 0.7)',
          '@media (max-width: 768px)': {
            fontSize: '12px',
            marginBottom: '6px'}},
        '.Error': {
          color: '#ff4444',
          fontSize: '14px',
          marginTop: '8px',
          '@media (max-width: 768px)': {
            fontSize: '12px',
            marginTop: '6px'}}}}};

  if (loading && !clientSecret) {
    return (
      <div className="p-4 border border-[rgba(255,255,255,0.1)] rounded-lg bg-background/60">
        <div className="space-y-4">
          <div className="animate-pulse h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="animate-pulse h-12 bg-gray-700 rounded"></div>
          <div className="animate-pulse h-12 bg-gray-700 rounded"></div>
          <div className="animate-pulse h-12 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-500 rounded-lg bg-red-950 bg-opacity-20">
        <p className="text-red-500 text-sm md:text-base">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm md:text-base rounded transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {clientSecret && (
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm onSuccess={onSuccess} />
        </Elements>
      )}
    </div>
  );
}

const CheckoutForm = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
        payment_method_data: {
          billing_details: {}}},
      redirect: 'if_required'});

    if (error) {
      setError(`Payment failed: ${error.message}`);
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setSucceeded(true);
      setProcessing(false);
      if (onSuccess) {
        onSuccess(paymentIntent);
      }
    } else {
      setError('An unexpected error occurred');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg md:text-xl font-medium">Enter Payment Details</h3>
        <div className="min-h-[250px]">
          <PaymentElement />
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/50 rounded text-destructive text-sm md:text-base">
          {error}
        </div>
      )}
      
      <button
        type="submit"
        disabled={!stripe || processing || succeeded}
        className="w-full bg-[#0057FF] hover:bg-[#0046CC] text-white px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base font-medium"
      >
        {processing ? 'Processing...' : succeeded ? 'Payment Successful' : 'Pay Now'}
      </button>
      
      {succeeded && (
        <div className="p-3 bg-success/10 border border-success/20 rounded text-success text-sm md:text-base">
          Payment successful! Your card is now on file.
        </div>
      )}
    </form>
  );
};