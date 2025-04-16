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
                document.getElementById('card-errors').textContent = result.error.message;
            } else {
                // The payment succeeded!
                if (result.paymentIntent.status === 'succeeded') {
                    showStatus('Payment successful!', 'success');
                    document.getElementById('payment-id').textContent = result.paymentIntent.id;
                    document.getElementById('payment-success').classList.remove('hidden');
                    form.classList.add('hidden');
                    document.getElementById('card-errors').textContent = '';
                    
                    // Load payment history
                    loadPaymentHistory();
                } else {
                    // Payment requires additional action
                    showStatus(`Payment status: ${result.paymentIntent.status}. Additional action may be required.`, 'warning');
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
                    
                    // Format status with appropriate styling
                    let statusClass = '';
                    switch(payment.status) {
                        case 'completed':
                            statusClass = 'success';
                            break;
                        case 'pending':
                            statusClass = 'warning';
                            break;
                        case 'failed':
                            statusClass = 'error';
                            break;
                        default:
                            statusClass = '';
                    }
                    
                    row.innerHTML = `
                        <td>${payment.id}</td>
                        <td>${(payment.amount / 100).toFixed(2)}</td>
                        <td>${payment.currency.toUpperCase()}</td>
                        <td><span class="status-badge ${statusClass}">${payment.status}</span></td>
                        <td>${new Date(payment.created_at).toLocaleString()}</td>
                        <td>
                            <button class="details-btn" data-id="${payment.id}">Details</button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
                
                // Add event listeners to details buttons
                document.querySelectorAll('.details-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const paymentId = btn.getAttribute('data-id');
                        try {
                            const paymentDetails = await PaymentService.getPaymentDetails(paymentId);
                            alert(`Payment ID: ${paymentDetails.id}\nAmount: ${(paymentDetails.amount / 100).toFixed(2)} ${paymentDetails.currency.toUpperCase()}\nStatus: ${paymentDetails.status}\nDate: ${new Date(paymentDetails.created_at).toLocaleString()}`);
                        } catch (error) {
                            console.error('Error fetching payment details:', error);
                            alert('Failed to load payment details');
                        }
                    });
                });
                
                document.getElementById('payment-history').classList.remove('hidden');
            }
        } catch (error) {
            console.error('Failed to load payment history:', error);
        }
    }
});
