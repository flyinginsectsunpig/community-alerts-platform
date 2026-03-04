# Input Sanitization Guidelines

This document outlines the standard procedures for handling user inputs to prevent injection attacks (XSS, SQLi, NoSQLi) within the Community Alerts platform.

## 1. Frontend (Next.js / React)

React inherently protects against XSS by automatically escaping string variables rendered in JSX. However, certain practices must be avoided:

*   **NEVER use `dangerouslySetInnerHTML`** unless rendering pre-sanitized Markdown from a trusted source.
*   **Validate input on the client:** Use HTML5 validation attributes (`required`, `pattern`, `maxLength`) to provide immediate feedback to the user before submission.
*   **Check uploaded files:** Ensure the Admin portal's Excel upload only accepts `.xlsx` or `.csv` files.

## 2. Backend (Java Spring Boot)

The API is the final line of defense. Never trust client-side validation.

### SQL Injection Prevention
*   **Use Spring Data JPA / Hibernate:** Always use repository methods (`findBy...`) or parameterized `@Query` annotations.
*   **Never concatenate strings for JPQL/SQL:** 
    ```java
    // ❌ DANGEROUS:
    em.createQuery("SELECT i FROM Incident i WHERE i.title = '" + userInput + "'");
    
    // ✅ SAFE:
    em.createQuery("SELECT i FROM Incident i WHERE i.title = :title")
      .setParameter("title", userInput);
    ```

### XSS & Data Integrity Validation
*   **Use `jakarta.validation` (`@Valid`, `@NotBlank`, `@Size`):** Enforce strict constraints on all incoming DTOs manually before they reach the controller logic.
*   **Sanitize Rich Text:** If users submit markdown/HTML for forum posts, use a server-side library like `OWASP Java HTML Sanitizer` to strip `<script>` and `on*` attributes before saving to the database.

## 3. Webhooks & Messaging (RabbitMQ / .NET)

*   **Treat Queue Payloads as Untrusted:** The .NET consumer must validate the structure and content of the JSON message received from RabbitMQ before parsing and sending emails.
*   **Prevent SMTP Injection:** Ensure user-provided strings (like suburb names or incident titles) do not contain CRLF characters (`\r\n`) before inserting them into email subjects or headers.
