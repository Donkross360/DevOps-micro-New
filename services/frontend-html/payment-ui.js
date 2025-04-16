document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is authenticated
    const isAuthenticated = await AuthService.validateToken();
    if (!isAuthenticated) {
        window.location.href = 'index.html';
        return;
    }

    const stripe = Stripe('pk_test_your_publishable_key'); // Replace with your Stripe publishable key
    const elements = stripe.elements();
    
    // Create card element
    const cardElement = elements.create('card');
    cardElement.mount('#card-element');
    
    // Handle form submission
    const form = document.getElementById('payment-form');
    const submitButton = document.getElementById('submit-button');
    const paymentStatus = document.getElementById('payment-status');
    
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // Disable the submit button to prevent multiple clicks
        submitButton.disabled = true;
        
        try {
            const amount = document.getElementById('amount').value;
            const currency = document.getElementById('currency').value;
            
            // Create payment intent on the server
            const { clientSecret } = await PaymentService.createPaymentIntent(amount, currency);
            
            // Confirm the payment with Stripe
            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: 'Customer Name', // You could get this from a form field
                    },
                },
            });
            
            if (result.error) {
                // Show error to customer
                showStatus(result.error.message, 'error');
            } else {
                // The payment succeeded!
                if (result.paymentIntent.status === 'succeeded') {
                    showStatus('Payment successful!', 'success');
                    document.getElementById('payment-id').textContent = result.paymentIntent.id;
                    document.getElementById('payment-success').classList.remove('hidden');
                    form.classList.add('hidden');
                    
                    // Load payment history
                    loadPaymentHistory();
                }
            }
        } catch (error) {
            showStatus(error.message, 'error');
        } finally {
            submitButton.disabled = false;
        }
    });
    
    // Load payment history on page load
    loadPaymentHistory();
    
    function showStatus(message, type) {
        paymentStatus.textContent = message;
        paymentStatus.className = `status ${type}`;
    }
    
    async function loadPaymentHistory() {
        try {
            const payments = await PaymentService.getUserPayments();
            
            if (payments.length > 0) {
                const tableBody = document.querySelector('#payments-table tbody');
                tableBody.innerHTML = '';
                
                payments.forEach(payment => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${payment.id}</td>
                        <td>${(payment.amount / 100).toFixed(2)}</td>
                        <td>${payment.currency.toUpperCase()}</td>
                        <td>${payment.status}</td>
                        <td>${new Date(payment.created_at).toLocaleString()}</td>
                    `;
                    tableBody.appendChild(row);
                });
                
                document.getElementById('payment-history').classList.remove('hidden');
            }
        } catch (error) {
            console.error('Failed to load payment history:', error);
        }
    }
});
