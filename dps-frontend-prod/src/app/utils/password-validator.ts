export function validatePassword(password: string): boolean {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const isValidLength = password.length >= 6;
    const hasInvalidSymbols = /[<>#!?]/.test(password);
    return hasUpperCase && hasNumber && isValidLength && !hasInvalidSymbols;
}