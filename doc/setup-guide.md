# Application Setup Guide

## System Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM (8GB recommended)
- Node.js 18+ (for development only)

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/yourorg/yourproject.git
cd yourproject
```

### 2. Initial Setup
```bash
# Copy example environment file
cp .env.example .env

# Generate secure secrets (Linux/MacOS)
make secrets
# Windows alternative:
# python -c "import secrets; print(f'JWT_SECRET={secrets.token_hex(32)}')" >> .env
```

### 3. Start Services
Choose your frontend:
```bash
# For React frontend (default):
docker-compose --profile react up -d

# For HTML frontend:
docker-compose --profile html up -d
```

## Accessing the Application

| Service          | URL                     | Default Credentials           |
|------------------|-------------------------|-------------------------------|
| React Frontend   | http://localhost:3000   | admin@example.com / admin123  |
| HTML Frontend    | http://localhost:8080   | admin@example.com / admin123  |
| Backend API      | http://localhost:5000   | -                             |
| Auth Service     | http://localhost:4000   | -                             |

## First-Time Setup

1. Open the React (3000) or HTML (8080) frontend
2. Login with default credentials
3. Change the admin password immediately

## Common Operations

**Restart services:**
```bash
docker-compose restart
```

**View logs:**
```bash
docker-compose logs -f
```

**Reset database:**
```bash
docker-compose down -v
docker-compose up -d
```

## Troubleshooting

**Port conflicts?**
- Check running containers: `docker ps`
- Stop conflicting services

**Login issues?**
- Verify auth service is running: `curl -I http://localhost:4000/health`
- Check JWT_SECRET in .env matches across services

**Database problems?**
- Check connection: `docker-compose exec db psql -U app_user -d app_db`

## Step 3: Build and Run Services

Build the Docker images for each service:

```bash
docker-compose build
```

## Step 4: Choose Your Frontend

You can choose between `frontend-react` and `frontend-html`. To run the desired frontend, use Docker Compose profiles:

- For React frontend:
  ```bash
  docker-compose --profile react up
  ```

- For HTML frontend:
  ```bash
  docker-compose --profile html up
  ```

## Step 5: Running the Backend and Other Services

To start the backend and other services, ensure they are defined in your `docker-compose.yml` and run:

```bash
docker-compose up --build
```

This command will build the images for each service and start them. You can verify that each service is running by accessing their respective endpoints:

- Backend: `http://localhost:5000`
- Auth: `http://localhost:4000`
- User: `http://localhost:6000`
- Payment: `http://localhost:7000`

## Step 5: Accessing the Application

- React frontend: Open your browser and go to `http://localhost:3000`
- HTML frontend: Open your browser and go to `http://localhost:8080`
- Backend API: Access the API at `http://localhost:5000`

## Troubleshooting

- Ensure Docker is running and you have the necessary permissions.
- Check the logs for any errors using `docker-compose logs`.

For further assistance, please refer to the project documentation or contact support.
