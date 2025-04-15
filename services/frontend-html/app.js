document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const authContainer = document.getElementById('auth-container');
    const contentContainer = document.getElementById('content-container');
    const authStatus = document.getElementById('authStatus');
    const usernameDisplay = document.getElementById('username-display');
    const protectedData = document.getElementById('protected-data');

    // Check if user is already logged in
    const isAuthenticated = await AuthService.validateToken();
    if (isAuthenticated) {
        showProtectedContent();
        fetchProtectedData();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await AuthService.login(username, password);
            showProtectedContent();
            fetchProtectedData();
            usernameDisplay.textContent = email.split('@')[0]; // Show name before @
            showStatus('Login successful!', 'success');
        } catch (error) {
            showStatus('Login failed. Please try again.', 'error');
        }
    });

    logoutBtn.addEventListener('click', () => {
        AuthService.logout();
        showLoginForm();
        showStatus('You have been logged out.', 'success');
    });

    function showProtectedContent() {
        authContainer.classList.add('hidden');
        contentContainer.classList.remove('hidden');
    }

    function showLoginForm() {
        authContainer.classList.remove('hidden');
        contentContainer.classList.add('hidden');
        loginForm.reset();
    }

    function showStatus(message, type) {
        authStatus.textContent = message;
        authStatus.className = type;
    }

    async function fetchProtectedData() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/data`, {
                headers: {
                    'x-access-token': AuthService.getToken()
                }
            });

            if (!response.ok) throw new Error('Failed to fetch data');
            
            const data = await response.json();
            protectedData.innerHTML = `
                <h3>Protected Data</h3>
                <p>${data.message}</p>
                <p>Your user ID: ${data.userId}</p>
            `;
        } catch (error) {
            protectedData.innerHTML = `<p class="error">Error loading protected data</p>`;
            console.error('Data fetch error:', error);
        }
    }
});
