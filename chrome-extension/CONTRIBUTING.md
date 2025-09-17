# Contributing to FoundersHub Chrome Extension

Thank you for your interest in contributing to the FoundersHub Chrome Extension! This document provides guidelines and instructions for contributors.

## 🚀 Getting Started

### Prerequisites

- Chrome browser (latest version)
- Basic knowledge of JavaScript, HTML, and CSS
- Familiarity with Chrome Extension development

### Development Setup

1. Clone the repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project directory
5. Make your changes and test them

## 📋 Development Guidelines

### Code Style

- Use consistent indentation (2 spaces)
- Follow ESLint rules (run `npm run lint`)
- Use meaningful variable and function names
- Add comments for complex logic

### File Organization

- `manifest.json` - Extension configuration
- `background.js` - Service worker for background tasks
- `popup/` - Extension popup interface
- `content-scripts/` - Scripts injected into web pages
- `services/` - API communication and storage utilities
- `utils/` - Helper functions and data processing

### Testing

- Test on multiple websites (LinkedIn, Twitter, GitHub, Flipkart, Myntra)
- Verify data extraction accuracy
- Check error handling
- Test authentication flow

## 🐛 Bug Reports

When reporting bugs, please include:

- Chrome version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console error messages (if any)
- Screenshots (if applicable)

## 💡 Feature Requests

For new features:

- Describe the use case
- Explain the expected behavior
- Consider backward compatibility
- Discuss potential implementation approach

## 🔧 Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages
6. Push to your fork
7. Open a pull request

### Pull Request Guidelines

- Provide clear description of changes
- Reference related issues
- Include screenshots for UI changes
- Ensure all tests pass
- Follow the existing code style

## 📝 Commit Message Format

Use conventional commit messages:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Maintenance tasks

Example: `feat: add support for Instagram profile scraping`

## 🏗️ Architecture

### Data Flow

1. User clicks extension icon
2. Popup loads and authenticates user
3. User navigates to supported website
4. Content script detects page and shows scraper UI
5. User clicks "Scrape All Data"
6. Data is extracted and normalized
7. Background script sends data to FoundersHub API

### Key Components

- **Authentication**: JWT-based login with workspace selection
- **Data Extraction**: Site-specific and generic scrapers
- **Schema Mapping**: Normalizes data to standard fields
- **API Integration**: Secure communication with FoundersHub backend

## 🛡️ Security Guidelines

- Never log sensitive data
- Use secure storage for tokens
- Validate all user inputs
- Follow Chrome extension security best practices
- Keep dependencies updated

## 📞 Support

For questions or help:

- Check existing issues
- Read the documentation
- Contact the maintainers

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
