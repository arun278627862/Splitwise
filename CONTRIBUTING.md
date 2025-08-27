# Contributing to Splitwise Clone

First off, thank you for considering contributing to Splitwise Clone! It's people like you that make this project a great tool for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots and animated GIFs if possible**
* **Include your environment details** (OS, browser, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior and explain which behavior you expected to see instead**
* **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Setup

### Prerequisites

* Node.js 14.0.0 or higher
* MongoDB 4.0 or higher
* npm or yarn

### Getting Started

1. Fork and clone the repository
```bash
git clone https://github.com/yourusername/splitwise-clone.git
cd splitwise-clone
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start MongoDB
```bash
# Using system service
sudo systemctl start mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

5. Run the development server
```bash
npm run dev
```

### Project Structure

```
splitwise-clone/
├── models/              # Database models (Mongoose schemas)
├── routes/              # API route handlers
├── middleware/          # Express middleware functions
├── services/            # Business logic and external services
├── utils/               # Utility functions
├── public/              # Frontend static files
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript files
│   └── uploads/        # User uploaded files
├── tests/              # Test files
└── docs/               # Documentation
```

### Coding Standards

#### JavaScript Style Guide

We follow the [JavaScript Standard Style](https://standardjs.com/) with some modifications:

* Use semicolons
* 2 spaces for indentation
* Single quotes for strings
* Trailing commas in multiline objects/arrays
* Maximum line length of 100 characters

#### Code Formatting

We use ESLint and Prettier for code formatting. Run before committing:

```bash
npm run lint
npm run format
```

#### Naming Conventions

* **Variables and functions**: camelCase
* **Constants**: UPPER_SNAKE_CASE
* **Classes**: PascalCase
* **Files**: kebab-case
* **Database collections**: lowercase

#### Comments

* Use JSDoc for function documentation
* Add inline comments for complex logic
* Write clear commit messages

Example:
```javascript
/**
 * Calculate the simplified balances for a group to minimize transactions
 * @param {string} groupId - The ID of the group
 * @returns {Promise<Array>} Array of simplified transactions
 */
async function getSimplifiedBalances(groupId) {
  // Implementation here
}
```

### Database Guidelines

#### Schema Design

* Use appropriate data types
* Add indexes for frequently queried fields
* Include validation in schemas
* Use virtuals for computed properties
* Implement proper error handling

#### Migrations

* Create migration scripts for schema changes
* Test migrations on sample data
* Document breaking changes

### API Guidelines

#### RESTful Design

* Follow REST conventions for endpoints
* Use appropriate HTTP methods
* Return consistent response formats
* Include proper status codes
* Implement pagination for list endpoints

#### Error Handling

* Return descriptive error messages
* Use appropriate HTTP status codes
* Log errors for debugging
* Don't expose sensitive information

#### Authentication

* Secure all protected endpoints
* Validate JWT tokens
* Check user permissions
* Rate limit sensitive operations

### Frontend Guidelines

#### HTML

* Use semantic HTML elements
* Include proper ARIA attributes
* Ensure keyboard navigation works
* Test with screen readers

#### CSS

* Follow BEM methodology for class names
* Use CSS custom properties for themes
* Implement responsive design
* Optimize for performance

#### JavaScript

* Use modern ES6+ features
* Implement proper error handling
* Follow the component-based architecture
* Write reusable utility functions

### Testing

#### Test Types

* **Unit Tests**: Test individual functions
* **Integration Tests**: Test API endpoints
* **E2E Tests**: Test complete user workflows

#### Writing Tests

* Write descriptive test names
* Test both success and error cases
* Mock external dependencies
* Aim for high code coverage

#### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --grep "user authentication"
```

### Git Workflow

#### Branching Strategy

* `main` - Production ready code
* `develop` - Integration branch for features
* `feature/feature-name` - Feature development
* `hotfix/issue-description` - Critical bug fixes

#### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
* `feat`: New feature
* `fix`: Bug fix
* `docs`: Documentation changes
* `style`: Code style changes
* `refactor`: Code refactoring
* `test`: Adding tests
* `chore`: Maintenance tasks

Examples:
```
feat(auth): add password reset functionality
fix(expenses): handle currency conversion errors
docs: update API documentation
```

### Performance Guidelines

#### Backend

* Use database indexes effectively
* Implement proper caching strategies
* Optimize database queries
* Use connection pooling
* Implement rate limiting

#### Frontend

* Minimize HTTP requests
* Optimize images and assets
* Use lazy loading for components
* Implement proper caching
* Minimize JavaScript bundle size

### Security Guidelines

* Validate all user inputs
* Use parameterized queries
* Implement proper authentication
* Use HTTPS in production
* Keep dependencies updated
* Follow OWASP guidelines

### Documentation

#### Code Documentation

* Document all public APIs
* Include usage examples
* Explain complex algorithms
* Update docs with code changes

#### User Documentation

* Write clear setup instructions
* Include troubleshooting guides
* Provide API documentation
* Create user guides

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release branch
4. Run full test suite
5. Create pull request
6. Tag release after merge
7. Deploy to production

## Community

* Join our [Discord server](https://discord.gg/splitwise-clone)
* Follow us on [Twitter](https://twitter.com/splitwiseclone)
* Check out our [Blog](https://blog.splitwiseclone.com)

## Recognition

Contributors will be recognized in our README and release notes. Significant contributions may be rewarded with:

* GitHub badges
* Contributor spotlight
* Conference speaking opportunities
* Swag and merchandise

## Getting Help

If you need help contributing:

1. Check existing documentation
2. Search through GitHub issues
3. Ask in our Discord server
4. Create a GitHub discussion
5. Contact maintainers directly

Thank you for contributing! 🎉