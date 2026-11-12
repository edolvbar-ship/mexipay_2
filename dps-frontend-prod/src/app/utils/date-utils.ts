export class DateUtils {
  /**
   * Creates a date in local timezone (not UTC)
   */
  static createLocalDate(
    year: number,
    month: number, // 0-indexed (0 = January)
    day: number,
    hour: number = 0,
    minute: number = 0,
    second: number = 0,
    ms: number = 0
  ): Date {
    return new Date(year, month, day, hour, minute, second, ms);
  }

  /**
   * Parses a date string (YYYY-MM-DD) to local date
   */
  static parseLocalDate(dateString: string): Date {
    const parts = dateString.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }

  /**
   * Gets local start of day (midnight in local timezone)
   */
  static getStartOfDay(date: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0
    );
  }

  /**
   * Gets local end of day (23:59:59.999 in local timezone)
   */
  static getEndOfDay(date: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23, 59, 59, 999
    );
  }

  /**
   * Converts a date to ISO string but ensures local time is preserved
   */
  static toLocalISOString(date: Date): string {
    // Create a new date with local time components
    const localDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    );
    return localDate.toISOString();
  }
}
