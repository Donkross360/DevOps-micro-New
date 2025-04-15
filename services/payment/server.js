const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Placeholder endpoint for payment processing
app.post('/process-payment', (req, res) => {
  // Simulate payment processing logic
  res.status(200).send({ message: 'Payment processed successfully' });
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Payment service running on port ${PORT}`);
});
