import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe('pk_test_your_publishable_key');

// Payment form component
const PaymentForm = () => {
  const [amount, setAmount] = useState(1000);
  const [currency, setCurrency] = useState('usd');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const { token } = useContext(AuthContext);
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }
    
    setProcessing(true);
    setError(null);
    
    try {
      // Create payment intent on the server
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token
        },
        body: JSON.stringify({ amount, currency })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }
      
      const data = await response.json();
      setClientSecret(data.clientSecret);
      
      // Confirm the payment with Stripe
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: 'Customer Name',
          },
        },
      });
      
      if (result.error) {
        throw new Error(result.error.message);
      } else {
        if (result.paymentIntent.status === 'succeeded') {
          setSuccess(true);
          setPaymentId(result.paymentIntent.id);
        } else {
          throw new Error(`Payment status: ${result.paymentIntent.status}`);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };
  
  return (
    <div className="payment-form-container">
      {!success ? (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="amount">Amount (in cents)</label>
            <input
              type="number"
              id="amount"
              min="50"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value))}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="usd">USD</option>
              <option value="eur">EUR</option>
              <option value="gbp">GBP</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Card Details</label>
            <div className="card-element-container">
              <CardElement options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#9e2146',
                  },
                },
              }} />
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            type="submit" 
            disabled={!stripe || processing}
            className="payment-button"
          >
            {processing ? 'Processing...' : 'Pay Now'}
          </button>
        </form>
      ) : (
        <div className="payment-success">
          <h2>Payment Successful!</h2>
          <p>Your payment has been processed successfully.</p>
          <p>Payment ID: {paymentId}</p>
          <button onClick={() => navigate('/')}>Return to Dashboard</button>
        </div>
      )}
    </div>
  );
};

// Payment history component
const PaymentHistory = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useContext(AuthContext);
  
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments`, {
          headers: {
            'x-access-token': token
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch payments');
        }
        
        const data = await response.json();
        setPayments(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPayments();
  }, [token]);
  
  const getStatusClass = (status) => {
    switch(status) {
      case 'completed': return 'status-success';
      case 'pending': return 'status-warning';
      case 'failed': return 'status-error';
      default: return '';
    }
  };
  
  if (loading) return <div>Loading payment history...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;
  
  return (
    <div className="payment-history">
      <h2>Payment History</h2>
      {payments.length === 0 ? (
        <p>No payment history found.</p>
      ) : (
        <table className="payments-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Amount</th>
              <th>Currency</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(payment => (
              <tr key={payment.id}>
                <td>{payment.id}</td>
                <td>${(payment.amount / 100).toFixed(2)}</td>
                <td>{payment.currency.toUpperCase()}</td>
                <td>
                  <span className={`status-badge ${getStatusClass(payment.status)}`}>
                    {payment.status}
                  </span>
                </td>
                <td>{new Date(payment.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// Main payment page component
const PaymentPage = () => {
  const navigate = useNavigate();
  
  return (
    <div className="payment-page">
      <div className="header-nav">
        <h1>Payments</h1>
        <button onClick={() => navigate('/')} className="back-button">
          ← Back to Dashboard
        </button>
      </div>
      
      <Elements stripe={stripePromise}>
        <PaymentForm />
      </Elements>
      
      <PaymentHistory />
    </div>
  );
};

export default PaymentPage;
