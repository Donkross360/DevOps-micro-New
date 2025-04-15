const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Placeholder endpoint for payment processing
const crypto = require('crypto');

app.post('/process-payment', (req, res) => {
  // Verify webhook signature
  const signature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== req.headers['x-signature']) {
    return res.status(401).send('Invalid signature');
  }

  // Process payment
  res.status(200).send({ 
    message: 'Payment processed successfully',
    paymentId: crypto.randomUUID()
  });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
});
