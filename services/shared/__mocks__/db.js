const mockDb = {
  query: jest.fn()
    // Default empty response
    .mockResolvedValue({ rows: [] }),
    
  end: jest.fn().mockResolvedValue(true)
};

// Common mock responses
mockDb.mockUserResponse = (users) => {
  mockDb.query.mockResolvedValueOnce({ rows: users });
};

mockDb.mockAuthResponse = (tokens) => {
  mockDb.query.mockResolvedValueOnce({ rows: tokens });
};

module.exports = mockDb;
