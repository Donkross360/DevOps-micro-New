const API_BASE_URL = 'http://localhost:4000';
const BACKEND_URL = 'http://localhost:5000';

class AuthService {
    static async login(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) throw new Error('Login failed');
            
            const data = await response.json();
            localStorage.setItem('jwtToken', data.token);
            return data;
        } catch (error) {
            console.error('Auth error:', error);
            throw error;
        }
    }

    static async validateToken() {
        const token = localStorage.getItem('jwtToken');
        if (!token) return false;

        try {
            const response = await fetch(`${API_BASE_URL}/validate`, {
                headers: {
                    'x-access-token': token
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    static logout() {
        localStorage.removeItem('jwtToken');
    }

    static getToken() {
        return localStorage.getItem('jwtToken');
    }
}
