import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

// Get API URLs from environment variables or use defaults
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('jwtToken'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check token validity on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/validate`, {
          headers: { 'x-access-token': token }
        });
        setUser(response.data);
      } catch (error) {
        console.error('Token validation failed:', error);
        // Token is invalid or expired, log out
        logout();
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  // Set up axios interceptor to handle token expiration
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          // Token expired or invalid
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/login`, credentials);
      const { token } = response.data;
      localStorage.setItem('jwtToken', token);
      setToken(token);
      
      // Fetch user info
      const userResponse = await axios.get(`${API_URL}/validate`, {
        headers: { 'x-access-token': token }
      });
      setUser(userResponse.data);
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('jwtToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
