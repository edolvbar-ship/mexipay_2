import { DatePipe } from '@angular/common';
import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';

registerLocaleData(localeEsMx);

export function transformedDate(date: string): string | null {
    const datePipe = new DatePipe('es-MX');
    return datePipe.transform(date, 'dd/MM/yyyy');
}

export function transformedTime(date: string): string | null {
    const datePipe = new DatePipe('es-MX');
    return datePipe.transform(date, 'HH:mm');
}

export function getDateRangeOfLast24Hours(): Date[] {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return [yesterday, now];
}

export function formatDateRangeToISO(event: { initial: string | Date; final: string | Date }): string {
    if (!event.initial || !event.final) {
        throw new Error("Las fechas no pueden estar vacías.");
    }

    // Parse dates
    const initialDate = event.initial instanceof Date ? new Date(event.initial) : new Date(event.initial);
    const finalDate = event.final instanceof Date ? new Date(event.final) : new Date(event.final);

    // Limit date range to maximum 90 days
    const maxDays = 90;
    const maxDate = new Date(initialDate);
    maxDate.setDate(initialDate.getDate() + maxDays);
    
    if (finalDate > maxDate) {
        console.warn(`Date range exceeds ${maxDays} days. Limiting to ${maxDays} days from start date.`);
        finalDate.setDate(initialDate.getDate() + maxDays - 1);
    }

    // Set time to start/end of day for full day coverage
    initialDate.setUTCHours(0, 0, 0, 0);
    finalDate.setUTCHours(23, 59, 59, 999);

    // Format dates to match backend's expected format: YYYY-MM-DDTHH:mm:ss.SSSZ
    const formatDate = (date: Date) => {
        const pad = (num: number, size: number = 2) => num.toString().padStart(size, '0');
        
        const year = date.getUTCFullYear();
        const month = pad(date.getUTCMonth() + 1);
        const day = pad(date.getUTCDate());
        const hours = pad(date.getUTCHours());
        const minutes = pad(date.getUTCMinutes());
        const seconds = pad(date.getUTCSeconds());
        const milliseconds = pad(date.getUTCMilliseconds(), 3);
        
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
    };

    const startDateStr = formatDate(initialDate);
    const endDateStr = formatDate(finalDate);

    // Return the two dates separated by a space
    return `${startDateStr} ${endDateStr}`;
}
