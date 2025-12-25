# BidMaster Backend

An online bidding platform backend built with Node.js, Express, TypeScript, PostgreSQL, and Redis.

## 🚀 Features

- **User Authentication** - JWT-based auth with role-based access control
- **Auction Management** - Create, manage, and participate in auctions
- **Real-time Bidding** - WebSocket-based real-time bid updates
- **Payment Integration** - Razorpay and Stripe payment gateways
- **Redis Caching** - High-performance caching for frequent operations
- **WebSocket Support** - Real-time notifications and bid updates
- **File Upload** - Profile pictures and document uploads
- **Admin Dashboard** - Comprehensive admin interface
- **Analytics** - Detailed platform analytics and reporting

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/bidmaster-backend.git
   cd bidmaster-backend
```

1. Install dependencies
   ```bash
   npm install
   ```
2. Set up environment variables
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```
3. Database setup
   ```bash
   # Create database
   npm run migrate
   
   # Seed data (optional)
   npm run seed
   ```
4. Start development server
   ```bash
   npm run dev
   ```

🏗️ Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Request handlers
├── database/         # Database models and migrations
├── middleware/       # Express middleware
├── routes/          # API routes
├── services/        # Business logic
├── sockets/         # WebSocket handlers
├── utils/           # Utility functions
└── server.ts        # Application entry point
```

🔧 Configuration

Environment Variables

Create a .env file in the root directory:

```env
# Server
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bidmaster
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Payment Gateways
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
```

Database Setup

1. Install PostgreSQL
2. Create database:
   ```sql
   CREATE DATABASE bidmaster;
   CREATE USER bidmaster_user WITH PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE bidmaster TO bidmaster_user;
   ```

🚀 Deployment

Using Docker

1. Build the Docker image:
   ```bash
   npm run docker:build
   ```
2. Run the container:
   ```bash
   npm run docker:run
   ```

Using Docker Compose

```bash
docker-compose up --build
```

Manual Deployment

1. Build the application:
   ```bash
   npm run build
   ```
2. Set production environment variables:
   ```bash
   export NODE_ENV=production
   export DATABASE_URL=postgresql://...
   # ... other variables
   ```
3. Start the application:
   ```bash
   npm start
   ```

📚 API Documentation

After starting the server, visit:

· API Docs: http://localhost:5000/api-docs
· Health Check: http://localhost:5000/health

🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Check coverage
npm test -- --coverage
```

🔒 Security

· Helmet.js for security headers
· Rate limiting on all endpoints
· SQL injection prevention
· XSS protection
· JWT token-based authentication
· Input validation and sanitization

📊 Monitoring

· Winston logging
· Request logging with Morgan
· Health check endpoints
· Performance monitoring

🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

🆘 Support

For support, email support@bidmaster.com or open an issue in the GitHub repository.
