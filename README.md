# Splitwise Clone - Free Expense Sharing App

A free and open-source expense sharing application similar to Splitwise, built with Node.js, MongoDB, and vanilla JavaScript. Split bills, track expenses, and manage group finances with ease.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-%3E%3D14.0.0-brightgreen.svg)
![MongoDB](https://img.shields.io/badge/mongodb-%3E%3D4.0-green.svg)

## 🌟 Features

### Core Features
- **User Authentication**: Secure signup/login with JWT tokens and email verification
- **Group Management**: Create, join, and manage expense groups with invite codes
- **Expense Tracking**: Add, edit, delete expenses with receipt upload support
- **Smart Splitting**: Split expenses equally, by exact amounts, or by percentages
- **Multiple Payers**: Support for multiple people paying for a single expense
- **Balance Calculation**: Real-time balance tracking with debt simplification
- **Multi-Currency**: Support for 25+ currencies with real-time exchange rates
- **Recurring Expenses**: Automated recurring expense creation (weekly, monthly, yearly)
- **Real-time Updates**: Live notifications using WebSocket connections
- **Email Notifications**: Configurable email alerts for expense activities
- **CSV Export**: Export expenses and balances for external analysis
- **Expense History**: View and restore deleted expenses and groups
- **Mobile Responsive**: Optimized for all device sizes

### Advanced Features
- **Debt Simplification**: Minimize number of transactions to settle all debts
- **Activity Feed**: Track all group activities and changes
- **Receipt Management**: Upload and store expense receipts
- **Smart Notifications**: Contextual in-app and email notifications
- **Currency Conversion**: Automatic currency conversion for international groups
- **Group Roles**: Admin and member roles with different permissions
- **Expense Categories**: Organize expenses by type (food, transport, etc.)
- **Search & Filter**: Find expenses by date, category, amount, or description
- **Expense Analytics**: Visual charts showing spending patterns
- **Dark Mode**: Toggle between light and dark themes

## 🚀 Quick Start

### Prerequisites
- Node.js 14.0.0 or higher
- MongoDB 4.0 or higher
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/splitwise-clone.git
   cd splitwise-clone
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/splitwise_clone

   # JWT Secret (generate a strong random string)
   JWT_SECRET=your_super_secret_jwt_key_here

   # Email Configuration (Gmail example)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password

   # Currency API (optional - uses fallback rates if not provided)
   CURRENCY_API_KEY=your_currency_api_key

   # Server Configuration
   PORT=3000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB service
   sudo systemctl start mongod

   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Run the application**
   ```bash
   # Development mode (with auto-restart)
   npm run dev

   # Production mode
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 🌐 GitHub Pages Deployment (Static Version)

For a simplified static version that runs entirely in the browser without requiring a backend server, you can deploy this app to GitHub Pages. This version uses localStorage for data persistence.

### Features in Static Version
- ✅ Create and manage expense groups
- ✅ Add and track expenses
- ✅ Calculate balances and settlements
- ✅ Data persistence using browser localStorage
- ✅ No backend server required
- ✅ Free hosting on GitHub Pages

### Deploy to GitHub Pages

1. **Fork this repository** to your GitHub account

2. **Enable GitHub Pages**:
   - Go to your fork's repository settings
   - Navigate to "Pages" in the left sidebar
   - Under "Source", select "GitHub Actions"

3. **Push to trigger deployment**:
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

4. **Access your deployed app**:
   Your app will be available at: `https://yourusername.github.io/splitwise-clone/`

### Manual Deployment
If you prefer manual deployment:

1. **Build the static files**:
   ```bash
   mkdir build
   cp index.html style.css script.js build/
   ```

2. **Deploy the `build` folder** to any static hosting service (Netlify, Vercel, GitHub Pages, etc.)

### Important Notes for Static Version
- **Data Storage**: All data is stored in your browser's localStorage
- **No Backend**: No server-side features (user authentication, email notifications, etc.)
- **Browser Specific**: Data won't sync across different browsers or devices
- **No Data Loss Protection**: Clear browser data = lose all expenses
- **Perfect for**: Personal use, demos, small groups sharing one device

## 📱 Usage

### Getting Started
1. **Sign Up**: Create your free account with email verification
2. **Create a Group**: Start a new group for your shared expenses
3. **Invite Members**: Share the invite code with friends to join
4. **Add Expenses**: Record expenses and choose how to split them
5. **Track Balances**: See who owes what and settle debts

### Adding Expenses
- Choose who paid and how much
- Select who should split the expense
- Pick splitting method: equal, exact amounts, or percentages
- Upload receipts for record keeping
- Add categories and notes for better organization

### Managing Groups
- Set group currency and description
- Invite members via email or invite code
- Assign admin roles for group management
- Configure group settings and permissions

### Settling Debts
- View simplified debts to minimize transactions
- Export balance reports to CSV
- Track payment history
- Get email reminders for outstanding balances

## 🛠️ Technical Architecture

### Backend (Node.js + Express)
- **Authentication**: JWT-based auth with bcrypt password hashing
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io for live updates
- **Email**: Nodemailer with template support
- **File Upload**: Multer for receipt management
- **Security**: Helmet, CORS, rate limiting
- **Validation**: Express-validator for input validation
- **Currency**: Real-time exchange rate API integration

### Frontend (Vanilla JavaScript)
- **Architecture**: Single Page Application (SPA) with client-side routing
- **UI Framework**: Custom CSS with responsive design
- **State Management**: Local storage with real-time sync
- **Charts**: Chart.js for expense analytics
- **Icons**: Font Awesome for consistent iconography
- **Progressive**: Service worker ready for offline functionality

### Database Schema
- **Users**: Authentication, preferences, notification settings
- **Groups**: Group information, members, roles, settings
- **Expenses**: Expense details, split information, payments
- **Balances**: Optimized balance calculations between users
- **Notifications**: In-app and email notification queue

## 🔧 Configuration

### Email Setup
Configure email settings in `.env` for notifications:

**Gmail Setup:**
1. Enable 2-factor authentication
2. Generate an app password
3. Use app password in `EMAIL_PASS`

**Other Providers:**
- Update `EMAIL_HOST` and `EMAIL_PORT`
- Adjust authentication method if needed

### Currency API
For real-time exchange rates, sign up for a free API key:
- [ExchangeRate-API](https://exchangerate-api.com/) (free tier available)
- [Fixer.io](https://fixer.io/) (alternative provider)

### Database Configuration
**Local MongoDB:**
```env
MONGODB_URI=mongodb://localhost:27017/splitwise_clone
```

**MongoDB Atlas (Cloud):**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/splitwise_clone
```

**Docker MongoDB:**
```bash
docker run -d -p 27017:27017 -v mongodb_data:/data/db --name mongodb mongo:latest
```

## 🚢 Deployment

### Production Setup

1. **Environment Configuration**
   ```bash
   NODE_ENV=production
   JWT_SECRET=generate_strong_random_secret
   MONGODB_URI=your_production_mongodb_uri
   FRONTEND_URL=https://yourdomain.com
   ```

2. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start server.js --name "splitwise-clone"
   pm2 startup
   pm2 save
   ```

3. **Reverse Proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Docker Deployment

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/splitwise_clone
    depends_on:
      - mongo
  
  mongo:
    image: mongo:latest
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"

volumes:
  mongodb_data:
```

### Cloud Deployment

**Heroku:**
```bash
heroku create your-app-name
heroku addons:create mongolab:sandbox
heroku config:set JWT_SECRET=your_secret
git push heroku main
```

**DigitalOcean App Platform:**
- Connect GitHub repository
- Set environment variables
- Choose MongoDB managed database

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e
```

### Test Structure
- **Unit Tests**: Individual function and component testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user workflow testing

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Style
- Use ESLint configuration provided
- Follow JavaScript Standard Style
- Add JSDoc comments for functions
- Write meaningful commit messages

## 📝 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password/:token` - Reset password

### Group Endpoints
- `GET /api/groups` - Get user's groups
- `POST /api/groups` - Create new group
- `GET /api/groups/:id` - Get group details
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `POST /api/groups/join` - Join group with invite code
- `POST /api/groups/:id/invite` - Invite user to group

### Expense Endpoints
- `GET /api/expenses` - Get expenses
- `POST /api/expenses` - Create expense
- `GET /api/expenses/:id` - Get expense details
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `POST /api/expenses/:id/restore` - Restore deleted expense

[View full API documentation](docs/API.md)

## 🔒 Security

### Security Features
- Password hashing with bcrypt
- JWT token authentication
- Input validation and sanitization
- Rate limiting on API endpoints
- CORS protection
- Helmet security headers
- SQL injection prevention
- XSS protection

### Security Best Practices
- Use environment variables for secrets
- Enable HTTPS in production
- Regularly update dependencies
- Implement proper error handling
- Use secure session management
- Validate all user inputs

## 📊 Performance

### Optimization Features
- Database indexing for fast queries
- Efficient balance calculation algorithms
- Connection pooling for database
- Gzip compression for responses
- Static file caching
- Lazy loading for frontend components

### Monitoring
- Application logging with Winston
- Error tracking and monitoring
- Performance metrics collection
- Database query optimization

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Find process using port 3000
lsof -i :3000
# Kill the process
kill -9 <PID>
```

**MongoDB Connection Issues:**
- Ensure MongoDB is running
- Check connection string format
- Verify network connectivity
- Check authentication credentials

**Email Not Sending:**
- Verify SMTP settings
- Check firewall restrictions
- Ensure email credentials are correct
- Test with a different email provider

### Debug Mode
Enable debug logging:
```bash
DEBUG=splitwise:* npm start
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Splitwise for the user experience design
- Built with love for the open-source community
- Thanks to all contributors and testers

## 📞 Support

- **Documentation**: [Wiki](https://github.com/yourusername/splitwise-clone/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/splitwise-clone/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/splitwise-clone/discussions)
- **Email**: support@yourproject.com

## 🗺️ Roadmap

### Upcoming Features
- [ ] Mobile app (React Native)
- [ ] Expense scanning with OCR
- [ ] Advanced analytics and insights
- [ ] Group expense budgets
- [ ] Payment integration (PayPal, Venmo)
- [ ] Multi-language support
- [ ] Offline mode support
- [ ] Advanced notification scheduling
- [ ] Expense approval workflows
- [ ] Custom expense categories

### Version History
- **v1.0.0** - Initial release with core features
- **v1.1.0** - Added recurring expenses and CSV export
- **v1.2.0** - Multi-currency support and real-time updates
- **v1.3.0** - Enhanced UI and mobile responsiveness

---

Made with ❤️ by the open-source community. Star ⭐ this project if you find it useful!