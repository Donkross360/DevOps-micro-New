# Setup Guide

Welcome to the DevOps Tooling Setup Guide. This document will guide you through setting up the development environment for our project.

## Prerequisites

- Docker and Docker Compose installed on your machine.
- Basic understanding of Docker and command-line operations.

## Step 1: Clone the Repository

First, clone the repository to your local machine:

```bash
git clone <repository-url>
cd <repository-name>
```

## Step 2: Environment Configuration

Ensure you have a `.env` file in the root directory with the following content:

```env
NODE_ENV=development
FLASK_ENV=development
JWT_SECRET=your_jwt_secret_key
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

## Step 3: Choose Your Frontend

You can choose between `frontend-react` and `frontend-html`. To run the desired frontend, use Docker Compose profiles:

- For React frontend:
  ```bash
  docker-compose --profile react up
  ```

- For HTML frontend:
  ```bash
  docker-compose --profile html up
  ```

## Step 4: Running the Backend and Other Services

To start the backend and other services, ensure they are defined in your `docker-compose.yml` and run:

```bash
docker-compose up
```

## Step 5: Accessing the Application

- React frontend: Open your browser and go to `http://localhost:3000`
- HTML frontend: Open your browser and go to `http://localhost:8080`
- Backend API: Access the API at `http://localhost:5000`

## Troubleshooting

- Ensure Docker is running and you have the necessary permissions.
- Check the logs for any errors using `docker-compose logs`.

For further assistance, please refer to the project documentation or contact support.
