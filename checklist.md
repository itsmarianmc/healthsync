# Security Checklist for AI Assistant

This checklist provides specific instructions for an AI assistant to perform security checks on a codebase or project. For each item, the AI should examine the relevant files, configurations, code patterns, and deployment settings to verify the absence of the issue. The AI should search through the project files, configuration files, scripts, and any accessible documentation.

## How to Use This Checklist

As an AI assistant, you should:
1. Examine the project structure and files
2. Look for patterns, configurations, and code snippets that indicate potential security issues
3. Check configuration files (like .env, config files, deployment configs)
4. Review source code for insecure patterns
5. Examine build logs, deployment scripts, and any exposed endpoints if available
6. Mark each item as checked and note any findings

**Note**: Some checks may require access to running systems or specific environments that may not be available in a static code review. For those checks, note the limitation and what would be needed to perform a complete check.

## Checks

- [ ] **Exposed database credentials**: Search for database credentials in environment files (.env, .env.local, etc.), configuration files (config.json, settings.py, etc.), and code. Look for patterns like `DB_PASSWORD`, `DB_USER`, `DATABASE_URL`, `connection strings`, `jdbc:`, `mongodb://`, `postgres://`, etc. Ensure they are not committed to version control and are stored securely (e.g., using secret managers, environment variables in production).

- [ ] **Public env files**: Verify that environment files (.env, .env.local, .env.production, etc.) are not publicly accessible (e.g., not in web root, not served by web server). Check .gitignore to ensure they are ignored. Look for any accidental commits of env files in the repository history.

- [ ] **Hardcoded API keys**: Search for API keys hardcoded in source code, configuration files, or scripts. Look for patterns like `api_key`, `apikey`, `key=`, `token=`, `secret`, `AKIA`, `SK`, etc. Common services include AWS, Google Cloud, Stripe, Twilio, SendGrid, etc. Ensure keys are loaded from environment variables or secure vaults.

- [ ] **Weak or missing authentication**: Check authentication mechanisms for weakness. Look for: hardcoded credentials, default passwords, lack of password complexity requirements, missing multi-factor authentication, authentication bypass vulnerabilities, weak session tokens, or absence of authentication on protected endpoints.

- [ ] **No authorization checks**: Verify that endpoints, functions, or UI components properly check user permissions before allowing access to resources or performing actions. Look for missing role-based access control (RBAC), missing permission checks, or overly permissive access controls.

- [ ] **Users able to access other users' data**: Test for Insecure Direct Object References (IDOR) by checking if user IDs, object references, or keys in requests can be manipulated to access other users' data. Look for direct references to database keys, file names, or object identifiers in URLs, form parameters, or API endpoints without proper authorization checks.

- [ ] **Open database read/write permissions**: Examine database configurations for excessive permissions. Check if database users have unnecessary privileges (like DELETE, DROP, GRANT on production databases). Review database connection strings and user definitions for least privilege principle.

- [ ] **Misconfigured Firebase / Supabase / S3 buckets**: For Firebase: check rules in firebase.rules or console for overly permissive read/write rules. For Supabase: review row level security (RLS) policies. For AWS S3: examine bucket policies and ACLs for public read/write access. Look for configuration files or infrastructure-as-code (Terraform, CloudFormation) that define these services.

- [ ] **Admin routes left unprotected**: Identify administrative endpoints (like /admin, /manage, /wp-admin, etc.) and verify they are protected by authentication and authorization. Check middleware, route guards, or server configurations that should restrict access to admin-only users.

- [ ] **Debug pages exposed in production**: Search for debug endpoints, consoles, or pages that should only be available in development (like /debug, /console, /phpinfo, /env, /healthcheck with verbose info, etc.). Check if these are accessible in production builds or deployments.

- [ ] **Build logs leaking secrets**: Examine build logs, CI/CD logs, or deployment outputs for accidental leakage of secrets, tokens, or passwords. Look for echo commands, verbose flags that might print environment variables, or misconfigured logging.

- [ ] **Verbose error messages leaking stack traces**: Check error handling mechanisms. Look for stack traces, internal file paths, database queries, or system information returned in error responses to users. Ensure generic error messages are shown in production, while detailed logs are kept internally.

- [ ] **Leaked GitHub repos or commit history**: Search for accidental exposure of private repositories, commit history containing secrets, or pushed sensitive data. Check for patterns like accidental commits of .env files, keys, or passwords in public repositories.

- [ ] **Secrets included in frontend JavaScript**: Examine frontend JavaScript files (embedded in HTML, separate .js files, or bundled) for hardcoded secrets, API keys, tokens, or sensitive data. Remember that anything in frontend code is visible to users.

- [ ] **Client-side-only security checks**: Identify security validations that only exist on the client side (JavaScript validation) without corresponding server-side checks. Look for form validation, authentication checks, or authorization logic that can be bypassed by disabling JavaScript or modifying client-side code.

- [ ] **Missing input validation**: Check for lack of validation on user inputs. Look for direct use of user input in queries, file system commands, or output without sanitization, length checks, type checking, or whitelisting of allowed values.

- [ ] **SQL injection**: Search for concatenation of user input into SQL queries without parameterization or escaping. Look for patterns like `statement.execute(query + userInput)`, `cursor.execute("SELECT * FROM users WHERE id = '" + userId + "'")`, or similar string building in database queries.

- [ ] **NoSQL injection**: For NoSQL databases (MongoDB, CouchDB, etc.), check for user input directly used in query objects without sanitization. Look for patterns where user input can modify query operators (like `$ne`, `$where`) due to improper handling.

- [ ] **Cross-site scripting, or XSS**: Examine output of user-controlled data in HTML, JavaScript contexts, or attribute values without proper escaping. Look for `.innerHTML`, `document.write()`, `eval()`, or template rendering that doesn't sanitize user input. Check for missing HTTP-only cookies and proper Content Security Policy headers.

- [ ] **Cross-site request forgery, or CSRF**: Verify that state-changing operations (POST, PUT, DELETE, PATCH) require CSRF tokens. Check for missing CSRF protection middleware, tokens in forms/sessions, or SameSite cookie attributes.

- [ ] **Insecure file uploads**: Examine file upload functionality for: lack of file type validation, lack of file size limits, storage of uploaded files in web-accessible directories, execution of uploaded files, or insufficient sanitization of filenames. Look for whitelisting of allowed extensions, virus scanning, and storage outside web root.

- [ ] **Path traversal bugs**: Check for user input used in file paths without proper sanitization. Look for patterns like `../../etc/passwd` being possible via filename parameters, download functions, or include statements. Ensure path normalization and validation against allowed directories.

- [ ] **Server-side request forgery, or SSRF**: Examine outgoing requests made by the server based on user input. Look for patterns where user-controlled URLs or parameters are used in functions like `curl`, `file_get_contents`, `http.request`, etc., without validation or restriction to internal networks.

- [ ] **Broken password reset flows**: Check password reset functionality for: lack of rate limiting, token leakage in URLs or logs, token predictability, missing expiration, or allowing reset without proper authentication. Ensure tokens are cryptographically secure, single-use, and expire quickly.

- [ ] **Weak session management**: Examine session handling for: use of predictable session IDs, lack of expiration, missing HttpOnly and Secure flags on cookies, session fixation vulnerabilities, or storing sensitive data in client-side tokens.

- [ ] **JWT secrets that are weak, leaked, or reused**: Check JWT implementation for: weak secrets (short, common), secrets exposed in code or config, same secret used across multiple services, or lack of proper algorithm validation (e.g., accepting 'none' algorithm).

- [ ] **Overly permissive CORS**: Review Cross-Origin Resource Sharing (CORS) headers for: allowing any origin (`Access-Control-Allow-Origin: *`) with credentials, or overly broad origins that should be restricted to trusted domains.

- [ ] **Rate limits missing on login, signup, APIs, and AI endpoints**: Check for absence of rate limiting on authentication endpoints (login, signup), API endpoints, and AI-related endpoints. Look for missing middleware, headers (like `Retry-After`), or implementation that would prevent brute force attacks or abuse.

- [ ] **Public test or staging environments**: Verify that test, staging, or development environments are not publicly accessible without authentication. Check for exposed internal services, admin panels, or debug tools on non-production environments.

- [ ] **Default credentials left unchanged**: Search for default usernames/passwords in configurations, scripts, or documentation (like admin/admin, root/password, etc.) that should have been changed in production.

- [ ] **Webhook endpoints without signature verification**: Examine webhook endpoints (for services like GitHub, Stripe, PayPal, etc.) for missing verification of signatures or tokens to ensure requests genuinely come from the expected source.

- [ ] **Payment or subscription checks only done on the frontend**: Verify that payment validation, subscription checks, or access to paid features are enforced on the backend, not solely reliant on frontend JavaScript or client-side checks.

- [ ] **Insecure direct object references, or IDOR**: (Duplicate of item 6, but keeping for completeness) Check if direct references to objects (like `/invoice/123`) can be manipulated to access unauthorized data without additional authorization checks.

- [ ] **API endpoints that trust user-controlled IDs or parameters**: Examine API endpoints for trust in user-provided identifiers without verifying ownership or permissions. Look for endpoints that use user IDs from tokens/sessions but also accept user-provided IDs in parameters without validation.

- [ ] **Logs containing tokens, emails, passwords, or private user data**: Search application logs, error logs, or audit trails for accidental logging of sensitive information. Look for patterns where user input, authentication tokens, or PII is logged at debug or info levels.

- [ ] **Source maps exposed in production**: Check for source map files (.map) being served in production builds, which can expose original source code and make debugging easier for attackers. Ensure source maps are disabled or restricted in production.

- [ ] **Dependency vulnerabilities**: Review project dependencies (package.json, requirements.txt, Pom.xml, etc.) for known vulnerabilities using tools like npm audit, yarn audit, pip-audit, or checking against vulnerability databases. Look for outdated versions with security issues.

- [ ] **Outdated packages**: Check for dependencies that are behind current versions and may contain unpatched security flaws. Look for version specifications that allow insecure ranges or lack of updating process.

- [ ] **Prompt injection in AI features**: For applications using LLMs or AI features, check for vulnerability to prompt injection where user input can override system prompts or cause unintended behavior. Look for lack of input sanitization, prompt separation, or output validation.

- [ ] **AI tools/actions allowed to access data without permission checks**: Examine AI integrations, tools, or plugins for missing authorization checks before accessing data or performing actions. Ensure AI components respect user permissions and data access rules.

- [ ] **Excessive database permissions for the app user**: Verify that the database user used by the application has only necessary permissions (SELECT, INSERT, UPDATE, DELETE on needed tables) and not excessive rights like DROP, CREATE, GRANT, or access to unrelated databases.

- [ ] **No audit logs**: Check for lack of logging of security-relevant events (logins, permission changes, data access, configuration changes). Ensure audit trails are maintained for forensic analysis.

- [ ] **No monitoring or alerting**: Verify absence of monitoring for security anomalies, unusual access patterns, failed login attempts, or other indicators of compromise. Check for lack of alerting mechanisms on critical events.

- [ ] **No backup or restore plan**: Look for missing backup strategies, absence of restore procedures, or unverified backups for critical data and configuration.

- [ ] **Publicly exposed internal**: Check for internal systems, APIs, or services that should be internal-only but are exposed to the public internet (e.g., internal APIs, admin interfaces, database ports).

- [ ] **Missing security headers**: Examine HTTP response headers for absence of security headers like: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`.

- [ ] **Cookies missing HttpOnly, Secure, or SameSite**: Check session and authentication cookies for missing HttpOnly flag (accessible via JavaScript), missing Secure flag (not HTTPS-only), or missing SameSite attribute (vulnerable to CSRF).

- [ ] **Unencrypted sensitive data**: Verify that sensitive data (passwords, PII, payment info) is encrypted at rest and in transit. Look for storage of plaintext passwords, lack of TLS/HTTPS, or weak encryption algorithms.

- [ ] **Poor tenant isolation in multi-user apps**: For multi-tenant applications, check for data leakage between tenants, insufficient isolation of resources, or ability for one tenant to access another tenant's data due to shared resources or flawed isolation mechanisms.

- [ ] **Over-trusting generated code without review**: Examine usage of AI-generated code, low-code platforms, or code generators for lack of manual review, security testing, or validation before deployment. Ensure generated code undergoes the same security scrutiny as manually written code.

## Completion Notes

After performing these checks, document any findings, prioritize fixes based on risk, and provide recommendations for remediation. Some checks may require manual penetration testing or dynamic analysis for complete verification.

---
*This checklist is designed for AI assistants to perform systematic security reviews. Adjust based on project specifics and available access.*