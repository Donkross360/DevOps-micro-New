# DevOps Template for Startups

A comprehensive DevOps template that allows startups to focus on development while getting production-ready infrastructure out of the box.

## Features

- **Microservices Architecture**: Separate services for authentication, user management, payments, and core backend functionality
- **Multiple Frontend Options**: React SPA and lightweight HTML/JS implementations
- **Docker Compose for Development**: Easy local development with profiles for different frontend options
- **Kubernetes for Production**: Production-ready Kubernetes manifests
- **Comprehensive Testing**: Unit and integration tests for all services
- **Secure by Default**: JWT authentication, HTTPS, proper token handling
- **Payment Processing**: Stripe integration with webhook support
- **Database Integration**: PostgreSQL with migrations

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Make (optional, for convenience scripts)

### Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/devops-template.git
cd devops-template
```

2. Set up environment variables
```bash
cp .env.example .env
# Generate secrets
make secrets
```

3. Start the services
```bash
# For React frontend (default)
docker-compose --profile react up -d

# For HTML frontend
docker-compose --profile html up -d
```

4. Access the application
- React frontend: http://localhost:3000
- HTML frontend: http://localhost:8080
- Backend API: http://localhost:5000
- Auth service: http://localhost:4000

### Running Tests

```bash
# Run tests for all services
make test

# Run tests for a specific service
cd services/payment
npm test
```

## Architecture

The application is structured as follows:

- **Frontend Services**:
  - `frontend-react`: React-based SPA with JWT authentication
  - `frontend-html`: Lightweight HTML/JS implementation

- **Backend Services**:
  - `auth`: Authentication service (JWT issuance and validation)
  - `user`: User management service
  - `payment`: Payment processing service with Stripe integration
  - `backend`: Core API service that proxies to other services

- **Infrastructure**:
  - `db`: PostgreSQL database
  - Docker Compose for development
  - Kubernetes manifests for production

## Development Workflow

1. Make changes to the code
2. Run tests to ensure functionality
3. Build and run the services locally
4. Commit changes with descriptive messages
5. Push to the repository
6. CI/CD pipeline will deploy to the appropriate environment

## Production Deployment

For production deployment, use the Kubernetes manifests in the `k8s` directory:

```bash
# Apply the manifests
kubectl apply -f k8s/

# Or use Kustomize for environment-specific configurations
kustomize build k8s/overlays/production | kubectl apply -f -
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
