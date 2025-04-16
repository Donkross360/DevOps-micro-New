// Payment handling for the HTML frontend
class PaymentService {
    static async createPaymentIntent(amount, currency = 'usd') {
        try {
            const token = AuthService.getToken();
            if (!token) {
                throw new Error('Authentication required');
            }

            // Validate amount before sending to server
            const parsedAmount = parseInt(amount);
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                throw new Error('Invalid amount. Must be a positive number.');
            }

            // Validate currency
            const validCurrencies = ['usd', 'eur', 'gbp', 'cad', 'aud'];
            if (!validCurrencies.includes(currency.toLowerCase())) {
                throw new Error(`Invalid currency. Supported currencies: ${validCurrencies.join(', ').toUpperCase()}`);
            }

            console.log(`Creating payment intent: amount=${parsedAmount}, currency=${currency}`);

            const response = await fetch(`${window.BACKEND_URL}/api/payments/create-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify({ amount: parsedAmount, currency })
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error('Payment intent creation failed:', data);
                throw new Error(data.error || 'Failed to create payment intent');
            }
            
            console.log('Payment intent created successfully');
            return data;
        } catch (error) {
            console.error('Payment error:', error);
            throw error;
        }
    }

    static async getPaymentDetails(paymentId) {
        try {
            const token = AuthService.getToken();
            if (!token) {
                throw new Error('Authentication required');
            }

            const response = await fetch(`${window.BACKEND_URL}/api/payments/${paymentId}`, {
                headers: {
                    'x-access-token': token
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch payment details');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Payment fetch error:', error);
            throw error;
        }
    }

    static async getUserPayments() {
        try {
            const token = AuthService.getToken();
            if (!token) {
                throw new Error('Authentication required');
            }

            const response = await fetch(`${window.BACKEND_URL}/api/payments`, {
                headers: {
                    'x-access-token': token
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch user payments');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Payments fetch error:', error);
            throw error;
        }
    }
}
