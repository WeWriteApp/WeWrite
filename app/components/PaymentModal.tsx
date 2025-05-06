import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Button } from './ui/button';
import Modal from './ui/modal';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentForm = ({ clientSecret, amount, onSuccess, onCancel }: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState({
    cardNumber: false,
    cardExpiry: false,
    cardCvc: false
  });
  const theme = useTheme();
  const isSmallMobile = useMediaQuery('(max-width:380px)'); // iPhone SE and similar

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const cardElement = elements.getElement(CardNumberElement);

    if (!cardElement) {
      setError('Card element not found');
      setProcessing(false);
      return;
    }

    try {
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (paymentMethodError) {
        throw new Error(paymentMethodError.message || 'An error occurred');
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethod.id,
      });

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment failed');
      }

      if (paymentIntent.status === 'succeeded') {
        onSuccess();
      } else {
        throw new Error('Payment processing failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleCardElementChange = (event: any, field: string) => {
    setCardComplete({
      ...cardComplete,
      [field]: event.complete
    });

    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  };

  const isFormComplete = cardComplete.cardNumber && cardComplete.cardExpiry && cardComplete.cardCvc;

  // Enhanced styling for the card elements with better visibility
  const cardElementStyle = {
    style: {
      base: {
        color: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '16px',
        fontWeight: '500',
        '::placeholder': {
          color: 'rgba(255, 255, 255, 0.7)',
        },
        iconColor: '#FFFFFF',
        letterSpacing: '0.025em'
      },
      invalid: {
        color: '#ff5252',
        iconColor: '#ff5252'
      },
      focus: {
        color: '#FFFFFF'
      }
    }
  };

  const containerStyle = {
    padding: '12px 15px',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)'
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Subscribe to WeWrite</h2>
        <p className="text-sm text-white/70">Complete your ${amount.toFixed(2)}/month subscription</p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-base font-semibold mb-2 text-white">Card number</label>
          <div style={containerStyle} className="w-full focus-within:border-[#0057FF] focus-within:ring-2 focus-within:ring-[#0057FF]/30">
            <CardNumberElement
              options={cardElementStyle}
              onChange={(e) => handleCardElementChange(e, 'cardNumber')}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-base font-semibold mb-2 text-white">Expiry date</label>
            <div style={containerStyle} className="w-full focus-within:border-[#0057FF] focus-within:ring-2 focus-within:ring-[#0057FF]/30">
              <CardExpiryElement
                options={cardElementStyle}
                onChange={(e) => handleCardElementChange(e, 'cardExpiry')}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-base font-semibold mb-2 text-white">CVC</label>
            <div style={containerStyle} className="w-full focus-within:border-[#0057FF] focus-within:ring-2 focus-within:ring-[#0057FF]/30">
              <CardCvcElement
                options={cardElementStyle}
                onChange={(e) => handleCardElementChange(e, 'cardCvc')}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="py-2 px-3 text-red-300 text-sm bg-red-500/20 border border-red-500/30 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button
          onClick={onCancel}
          disabled={processing}
          variant="outline"
          type="button"
        >
          Cancel
        </Button>

        <Button
          disabled={!stripe || processing || !isFormComplete}
          type="submit"
        >
          {processing ? "Processing..." : `Pay $${amount.toFixed(2)}/mo`}
        </Button>
      </div>
    </form>
  );
};

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
}

export default function PaymentModal({ open, onClose, clientSecret, amount, onSuccess }: PaymentModalProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const handleCancel = () => {
    onClose();
  };

  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      className="max-w-[500px] bg-[#121212] text-white p-0"
      showCloseButton={false}
    >
      {clientSecret && (
        <Elements stripe={stripePromise} options={{
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#0057FF',
              colorBackground: '#121212',
              colorText: '#FFFFFF',
              colorDanger: '#FF5252',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSizeBase: '16px',
              borderRadius: '8px',
              fontWeightNormal: '500'
            },
            rules: {
              '.Input': {
                color: '#FFFFFF'
              }
            }
          }
        }}>
          <div className="p-6">
            <PaymentForm
              clientSecret={clientSecret}
              amount={amount}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </div>
        </Elements>
      )}
    </Modal>
  );
}