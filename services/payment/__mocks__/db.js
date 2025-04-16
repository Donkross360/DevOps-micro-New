const mockDb = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  end: jest.fn().mockResolvedValue(true)
};

// Helper to mock user responses
mockDb.mockPaymentResponse = (payments) => {
  mockDb.query.mockResolvedValueOnce({ rows: payments, rowCount: payments.length });
};

// Helper to mock single payment response
mockDb.mockSinglePayment = (payment) => {
  mockDb.query.mockResolvedValueOnce({ rows: [payment], rowCount: 1 });
};

// Helper to mock empty response
mockDb.mockEmptyResponse = () => {
  mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
};

// Helper to mock error
mockDb.mockError = (error) => {
  mockDb.query.mockRejectedValueOnce(error);
};

module.exports = mockDb;
