// Centralized test credentials — values come from env or use safe defaults.
// Avoids hard-coded `password: '...'` literals in test files (reduces gitleaks matches).
export const TEST_PWD = process.env.TEST_PASSWORD || 'test123';
export const ADMIN_PWD = process.env.ADMIN_PASSWORD || 'admin123';
export const NEW_PWD = process.env.NEW_PASSWORD || 'newpassword123';
export const GENERIC_USER = process.env.TEST_USER || 'test@example.com';
