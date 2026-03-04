# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| v1.x    | :white_check_mark: |
| < v1.0  | :x:                |

## Reporting a Vulnerability

We take the security of the Community Alerts platform very seriously.

If you discover a vulnerability, please DO NOT open a public issue. 
Instead, send an email to **security@communityalerts.local** with:
1. A description of the vulnerability.
2. Steps to reproduce the issue.
3. Potential impact.

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Security Features Implemented
- **Authentication**: JWT (JSON Web Tokens) with RS256/HS256 encryption.
- **Authorization**: Role-Based Access Control (RBAC) enforced via Spring Security API Gateway.
- **Rate Limiting**: Bucket4j implementation restricting API calls per IP (e.g., 10 incidents/min). Further protected by NGINX Ingress restrictions in production.
- **CORS Hardening**: Strict origin checking for the Next.js Web App.
- **Security Headers**: HSTS, X-Frame-Options (DENY), and Content Security Policies applied.

## Data Protection
All database connections (PostgreSQL/Redis) MUST happen over private virtual networks or TLS. Passwords are chronologically hashed using `BCrypt`.
